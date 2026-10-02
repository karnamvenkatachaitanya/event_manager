import "server-only";
import { db } from "./supabase";
import type { Caller } from "./auth";
import type {
  Announcement, AttendanceRecord, Certificate, CoordinatorInfo, EventConfig, EventResource,
  ParticipantProfile, Payment, ProjectSubmission, Registration, SupportTicket, Team, Ticket, User,
} from "@/lib/types";

export interface StoreState {
  eventConfig: EventConfig;
  users: User[];
  profiles: ParticipantProfile[];
  registrations: Registration[];
  payments: Payment[];
  tickets: Ticket[];
  attendance: AttendanceRecord[];
  coordinators: CoordinatorInfo[];
  resources: EventResource[];
  teams: Team[];
  submissions: ProjectSubmission[];
  supportTickets: SupportTicket[];
  announcements: Announcement[];
  certificates: Certificate[];
  seatsTaken: number;
}

const COLLEGE = "N.B.K.R. Institute of Science & Technology";

export const fmtIST = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  });

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function all(table: string, build?: (q: any) => any): Promise<Row[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = db().from(table).select("*");
  if (build) q = build(q);
  const { data, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

export async function getEventConfig(): Promise<EventConfig> {
  const [c] = await all("event_config");
  return {
    name: c.name, subtitle: c.subtitle, organized_by: c.organized_by, associated_with: c.associated_with,
    date: c.date, date_formatted: c.date_formatted, time: c.time, venue: c.venue, capacity: c.capacity,
    registration_open: c.registration_open, iste_fee: c.iste_fee, non_iste_fee: c.non_iste_fee,
    max_team_size: c.max_team_size, description: c.description, event_end_at: c.event_end_at,
    submission_deadline_at: c.submission_deadline_at, upi_id: c.upi_id, upi_payee_name: c.upi_payee_name,
    support_contact_name: c.support_contact_name, support_whatsapp: c.support_whatsapp,
  };
}

const mapUser = (u: Row): User => ({
  id: u.id, auth_id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, status: u.status, created_at: u.created_at,
});
const mapProfile = (p: Row): ParticipantProfile => ({
  id: p.id, user_id: p.user_id, certificate_name: p.certificate_name, mobile: p.mobile, roll_number: p.roll_number,
  year: p.year, branch: p.branch, section: p.section, iste_member: p.iste_member, iste_sm_number: p.iste_sm_number ?? undefined,
  has_laptop: p.has_laptop, linkedin_portfolio: p.linkedin_portfolio ?? undefined, created_at: p.created_at,
});
const mapReg = (r: Row, users?: Map<string, Row>): Registration => ({
  id: r.id, registration_number: r.registration_number, participant_id: r.participant_id, event_id: "p2p-2026",
  registration_type: r.registration_type, fee: r.fee, payment_status: r.payment_status,
  registration_status: r.registration_status, utr_number: r.utr_number ?? undefined,
  payment_proof_path: r.payment_proof_path ?? undefined, payment_submitted_at: r.payment_submitted_at ?? r.created_at,
  rejection_reason: r.rejection_reason ?? undefined, verified_at: r.verified_at ?? undefined,
  verified_by_name: r.verified_by ? users?.get(r.verified_by)?.name : undefined, created_at: r.created_at,
});
const mapPayment = (p: Row): Payment => ({
  id: p.id, registration_id: p.registration_id, razorpay_order_id: "", razorpay_payment_id: "", razorpay_signature: "",
  amount: p.amount, status: p.status, payment_method: p.payment_method, utr_number: p.utr_number ?? undefined, created_at: p.created_at,
});
const mapTicket = (t: Row): Ticket => ({
  id: t.id, registration_id: t.registration_id, ticket_number: t.ticket_number,
  qr_token: `ticket_id=${t.ticket_number}&k=${t.qr_token}`, wallet_pass_url: `/api/wallet/${t.ticket_number}`,
  status: t.status, created_at: t.created_at,
});

function mapAttendance(a: Row, regs: Map<string, Row>, profiles: Map<string, Row>): AttendanceRecord {
  const r = regs.get(a.registration_id);
  const p = r ? profiles.get(r.participant_id) : undefined;
  return {
    id: a.id, ticket_id: a.ticket_id ?? "", registration_number: r?.registration_number ?? "",
    participant_name: p?.certificate_name ?? "", roll_number: p?.roll_number ?? "", branch: p?.branch ?? "",
    year: p?.year ?? "", section: p?.section ?? "", iste_member: p?.iste_member ?? false,
    checked_in_by: a.checked_in_by_name, check_in_time: fmtIST(a.check_in_at), check_in_at: a.check_in_at, status: a.status,
  };
}

function mapTeams(teams: Row[], members: Row[], profiles: Map<string, Row>): Team[] {
  return teams.map((t) => {
    const ms = members.filter((m) => m.team_id === t.id);
    return {
      id: t.id, event_id: "p2p-2026", name: t.name, invite_code: t.invite_code, leader_id: t.leader_id,
      leader_name: profiles.get(t.leader_id)?.certificate_name ?? "", created_at: t.created_at,
      members: ms.map((m) => {
        const p = profiles.get(m.participant_id);
        return {
          id: m.id, team_id: t.id, participant_id: m.participant_id, name: p?.certificate_name ?? "Member",
          roll_number: p?.roll_number ?? "", branch: p?.branch ?? "", is_leader: m.is_leader, joined_at: m.joined_at,
        };
      }),
    };
  });
}

function mapSubmission(s: Row, teamName: string, includeFeedback: boolean): ProjectSubmission {
  const scored = s.score_innovation !== null && s.score_innovation !== undefined;
  return {
    id: s.id, team_id: s.team_id, team_name: teamName, project_name: s.project_name, problem_statement: s.problem_statement,
    description: s.description, technologies: s.technologies ?? [], github_url: s.github_url ?? undefined,
    demo_url: s.demo_url ?? undefined, presentation_url: s.presentation_url ?? undefined, file_url: s.file_url ?? undefined,
    status: s.status, submitted_at: s.submitted_at,
    scores: scored
      ? {
          innovation: s.score_innovation,
          tools_tech: s.score_ai_prompting,
          ui_ux: s.score_tech_execution,
          production_ready: s.score_presentation,
          ai_prompting: s.score_ai_prompting,
          tech_execution: s.score_tech_execution,
          presentation: s.score_presentation,
          total: s.score_innovation + s.score_ai_prompting + s.score_tech_execution + s.score_presentation,
          feedback: includeFeedback ? s.feedback ?? undefined : undefined,
        }
      : undefined,
  };
}

function mapCertificate(c: Row, regs: Map<string, Row>, profiles: Map<string, Row>): Certificate {
  const r = regs.get(c.registration_id);
  const p = r ? profiles.get(r.participant_id) : undefined;
  return {
    id: c.id, certificate_id: c.certificate_id, registration_id: c.registration_id,
    participant_name: p?.certificate_name ?? "", roll_number: p?.roll_number ?? "", branch: p?.branch ?? "",
    college_name: COLLEGE, type: c.type, rank: c.rank ?? undefined, issue_date: c.issue_date,
    verification_url: `/verify/${c.certificate_id}`, status: c.status,
  };
}

function mapSupport(t: Row, msgs: Row[], users: Map<string, Row>): SupportTicket {
  return {
    id: t.id, ticket_code: t.ticket_code, user_id: t.user_id, user_name: users.get(t.user_id)?.name ?? "",
    registration_id: t.registration_id ?? undefined, category: t.category, subject: t.subject, message: t.message,
    attachment_url: t.attachment_url ?? undefined, status: t.status,
    responses: msgs.filter((m) => m.ticket_id === t.id).map((m) => ({
      id: m.id, sender_name: m.sender_name, sender_role: m.sender_role, message: m.message, created_at: m.created_at,
    })),
    created_at: t.created_at, updated_at: t.updated_at,
  };
}

const byId = (rows: Row[]) => new Map(rows.map((r) => [r.id, r]));
const asc = (q: any) => q.order("created_at", { ascending: false }); // eslint-disable-line @typescript-eslint/no-explicit-any

/** Public leaderboard view of submissions (no feedback, no private links). */
function toBoard(subs: Row[], teams: Row[]): ProjectSubmission[] {
  const tmap = byId(teams);
  return subs
    .filter((x) => ["submitted", "under_review", "evaluated"].includes(x.status))
    .map((x) => ({
      ...mapSubmission(x, tmap.get(x.team_id)?.name ?? "Team", false),
      github_url: undefined, demo_url: undefined, presentation_url: undefined, file_url: undefined,
    }));
}

// Every query below runs in parallel: against a remote database each round-trip costs
// hundreds of milliseconds, so sequential awaits made a staff state load take >10s.
export async function buildState(caller: Caller | null): Promise<StoreState> {
  const isAdmin = caller?.role === "admin";
  const isStaff = caller?.role === "admin" || caller?.role === "coordinator";
  const can = (p: string) => isAdmin || (caller?.permissions ?? []).includes(p as never);

  const [eventConfig, seats, announcements, allSubs, allTeams] = await Promise.all([
    getEventConfig(),
    db().from("registrations").select("id", { count: "exact", head: true })
      .neq("registration_status", "cancelled").neq("payment_status", "failed"),
    all("announcements", (q) => (isAdmin ? asc(q) : asc(q.eq("published", true)))),
    all("submissions", (q) => q.order("submitted_at", { ascending: false })),
    all("teams", asc),
  ]);
  const base: StoreState = {
    eventConfig, users: [], profiles: [], registrations: [], payments: [], tickets: [], attendance: [],
    coordinators: [], resources: [], teams: [], submissions: toBoard(allSubs, allTeams), supportTickets: [],
    announcements: announcements as Announcement[], certificates: [], seatsTaken: seats.count ?? 0,
  };
  if (!caller) return base;

  // ---------------- participant: own records only
  if (!isStaff) {
    const [meRows, profileRows, resources, support] = await Promise.all([
      all("app_users", (q) => q.eq("id", caller.id)),
      all("participant_profiles", (q) => q.eq("user_id", caller.id)),
      all("resources", (q) => asc(q.eq("published", true))),
      all("support_tickets", (q) => asc(q.eq("user_id", caller.id))),
    ]);
    const me = meRows[0];
    const profile = profileRows[0];
    base.users = me ? [mapUser(me)] : [];
    base.resources = resources as EventResource[];
    const msgsP = support.length ? all("support_messages", (q) => q.in("ticket_id", support.map((t) => t.id)).order("created_at")) : Promise.resolve([]);
    if (!profile) {
      base.supportTickets = support.map((t) => mapSupport(t, [], new Map([[caller.id, me]])));
      return base;
    }
    const [regs, membership, msgs] = await Promise.all([
      all("registrations", (q) => q.eq("participant_id", profile.id)),
      all("team_members", (q) => q.eq("participant_id", profile.id)),
      msgsP,
    ]);
    const regIds = regs.map((r) => r.id);
    const teamIds = membership.map((m) => m.team_id);
    const none = Promise.resolve([] as Row[]);
    const [members, payments, tickets, attendance, certs] = await Promise.all([
      teamIds.length ? all("team_members", (q) => q.in("team_id", teamIds)) : none,
      regIds.length ? all("payments", (q) => q.in("registration_id", regIds)) : none,
      regIds.length ? all("tickets", (q) => q.in("registration_id", regIds)) : none,
      regIds.length ? all("attendance", (q) => q.in("registration_id", regIds)) : none,
      regIds.length ? all("certificates", (q) => q.in("registration_id", regIds).eq("status", "issued")) : none,
    ]);
    const mates = members.length
      ? await all("participant_profiles", (q) => q.in("id", members.map((m) => m.participant_id)))
      : [];
    const pmap = byId([profile, ...mates]);
    const rmap = byId(regs);
    const teams = allTeams.filter((t) => teamIds.includes(t.id));
    const tmap = byId(teams);
    base.profiles = [mapProfile(profile)];
    base.registrations = regs.map((r) => mapReg(r));
    base.payments = payments.map(mapPayment);
    base.tickets = tickets.map(mapTicket);
    base.attendance = attendance.map((a) => mapAttendance(a, rmap, pmap));
    base.certificates = certs.map((c) => mapCertificate(c, rmap, pmap));
    base.teams = mapTeams(teams, members, pmap);
    const own = allSubs.filter((x) => teamIds.includes(x.team_id)).map((x) => mapSubmission(x, tmap.get(x.team_id)?.name ?? "Team", true));
    base.submissions = [...own, ...base.submissions.filter((x) => !own.some((o) => o.id === x.id))];
    base.supportTickets = support.map((t) => mapSupport(t, msgs, new Map([[caller.id, me]])));
    return base;
  }

  // ---------------- staff (coordinator / admin)
  const seesPeople = isAdmin || can("PARTICIPANT_VIEW") || can("REGISTRATION_VERIFY") || can("CHECKIN_VIEW") || can("CHECKIN_MANAGE");
  const seesGate = isAdmin || can("CHECKIN_VIEW") || can("CHECKIN_MANAGE");
  const seesSupport = isAdmin || can("SUPPORT_VIEW") || can("SUPPORT_REPLY");
  const none = Promise.resolve([] as Row[]);
  const [users, profiles, regs, tickets, attendance, support, msgs, resources, coordRows, payments, members, certs] = await Promise.all([
    all("app_users", asc),
    all("participant_profiles", asc),
    all("registrations", asc),
    seesPeople ? all("tickets", asc) : none,
    seesGate ? all("attendance", (q) => q.order("check_in_at", { ascending: false })) : none,
    seesSupport ? all("support_tickets", asc) : none,
    seesSupport ? all("support_messages", (q) => q.order("created_at")) : none,
    all("resources", asc),
    all("coordinators", asc),
    isAdmin ? all("payments", asc) : none,
    isAdmin ? all("team_members") : none,
    isAdmin ? all("certificates", (q) => q.order("issue_date", { ascending: false })) : none,
  ]);
  const umap = byId(users);
  const pmap = byId(profiles);
  const rmap = byId(regs);
  if (seesPeople) {
    base.profiles = profiles.map(mapProfile);
    base.registrations = regs.map((r) => mapReg(r, umap));
    base.tickets = tickets.map(mapTicket);
    base.users = users.filter((u) => isAdmin || u.role === "user" || u.id === caller.id).map(mapUser);
  } else {
    base.users = users.filter((u) => u.id === caller.id).map(mapUser);
  }
  base.attendance = attendance.map((a) => mapAttendance(a, rmap, pmap));
  base.supportTickets = support.map((t) => mapSupport(t, msgs, umap));
  base.resources = resources as EventResource[];
  base.coordinators = coordRows
    .filter((c) => isAdmin || c.user_id === caller.id)
    .map((c) => ({
      id: c.id, user_id: c.user_id, name: umap.get(c.user_id)?.name ?? "", email: umap.get(c.user_id)?.email ?? "",
      employee_or_student_id: c.employee_or_student_id, status: c.status, permissions: c.permissions, created_at: c.created_at,
    }));
  if (isAdmin) {
    base.payments = payments.map(mapPayment);
    base.teams = mapTeams(allTeams, members, pmap);
    const tmap = byId(allTeams);
    base.submissions = allSubs.map((x) => mapSubmission(x, tmap.get(x.team_id)?.name ?? "Team", true));
    base.certificates = certs.map((c) => mapCertificate(c, rmap, pmap));
  }
  return base;
}

/** Public certificate lookup for /verify/[id]. */
export async function verifyCertificate(certificateId: string): Promise<Certificate | null> {
  const { data: c } = await db().from("certificates").select("*").eq("certificate_id", certificateId.trim().toUpperCase()).maybeSingle();
  if (!c) return null;
  const { data: r } = await db().from("registrations").select("*").eq("id", c.registration_id).single();
  const { data: p } = await db().from("participant_profiles").select("*").eq("id", r.participant_id).single();
  return mapCertificate(c, byId([r]), byId([p]));
}
