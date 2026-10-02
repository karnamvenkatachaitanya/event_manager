import "server-only";
import { db, PROOF_BUCKET } from "./supabase";
import { ApiError, dbError } from "./errors";
import { Caller, clearCallerCache, requirePermission, requireRole } from "./auth";
import { newCertificateId, newInviteCode, newQrToken } from "./ids";
import { fmtIST, getEventConfig, verifyCertificate } from "./state";
import type { CoordinatorPermission } from "@/lib/types";

type P = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const str = (v: unknown, field: string, max = 500, required = true): string => {
  const s = typeof v === "string" ? v.trim() : "";
  if (required && !s) throw new ApiError(400, `${field} is required.`);
  if (s.length > max) throw new ApiError(400, `${field} is too long.`);
  return s;
};
const int = (v: unknown, field: string, min: number, max: number): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new ApiError(400, `${field} must be between ${min} and ${max}.`);
  return n;
};
const url = (v: unknown, field: string): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  if (!/^https?:\/\/\S+$/i.test(s)) throw new ApiError(400, `${field} must be a valid http(s) link.`);
  return s;
};
const check = <T>(res: { data: T; error: { message?: string; code?: string } | null }): T => {
  if (res.error) throw dbError(res.error);
  return res.data;
};

async function registrationOf(profileId: string | null) {
  if (!profileId) throw new ApiError(400, "No participant profile found for this account.");
  const r = await db().from("registrations").select("*").eq("participant_id", profileId).maybeSingle();
  return check(r);
}
async function requireConfirmed(profileId: string | null) {
  const reg = await registrationOf(profileId);
  if (!reg || reg.registration_status !== "confirmed" || reg.payment_status !== "success") {
    throw new ApiError(409, "Your payment has not been verified yet.");
  }
  return reg;
}
async function teamOf(profileId: string) {
  const m = check(await db().from("team_members").select("*").eq("participant_id", profileId).maybeSingle());
  return m;
}

// ------------------------------------------------------------------ participant
const participant = {
  async updateProfile(c: Caller | null, p: P) {
    const me = requireRole(c, "user");
    const name = str(p.name, "Name", 80);
    const phone = str(p.mobile, "Mobile number", 20);
    const linkedin = url(p.linkedinPortfolio, "LinkedIn / portfolio");
    check(await db().from("app_users").update({ name, phone }).eq("id", me.id));
    check(await db().from("participant_profiles").update({
      certificate_name: str(p.certificateName ?? p.name, "Certificate name", 80),
      mobile: phone, linkedin_portfolio: linkedin, has_laptop: Boolean(p.hasLaptop),
    }).eq("user_id", me.id));
  },

  async createTeam(c: Caller | null, p: P) {
    const me = requireRole(c, "user");
    await requireConfirmed(me.profileId);
    if (await teamOf(me.profileId!)) throw new ApiError(409, "You are already in a team.");
    const name = str(p.name, "Team name", 60);
    const team = check(await db().from("teams").insert({ name, invite_code: newInviteCode(), leader_id: me.profileId }).select().single());
    const res = await db().from("team_members").insert({ team_id: team.id, participant_id: me.profileId, is_leader: true });
    if (res.error) {
      await db().from("teams").delete().eq("id", team.id);
      throw dbError(res.error);
    }
    return { teamId: team.id, inviteCode: team.invite_code };
  },

  async joinTeam(c: Caller | null, p: P) {
    const me = requireRole(c, "user");
    await requireConfirmed(me.profileId);
    const codeStr = str(p.inviteCode, "Invite code", 20).toUpperCase();
    const team = check(await db().from("teams").select("*").eq("invite_code", codeStr).maybeSingle());
    if (!team) throw new ApiError(404, "No team found with this invite code.");
    if (await teamOf(me.profileId!)) throw new ApiError(409, "You are already in a team. Leave it first to join another.");
    const sub = check(await db().from("submissions").select("status").eq("team_id", team.id).maybeSingle());
    if (sub && sub.status !== "draft") throw new ApiError(409, "This team has already submitted its project; the roster is locked.");
    check(await db().from("team_members").insert({ team_id: team.id, participant_id: me.profileId, is_leader: false }));
    return { teamId: team.id };
  },

  async leaveTeam(c: Caller | null) {
    const me = requireRole(c, "user");
    const m = await teamOf(me.profileId!);
    if (!m) throw new ApiError(404, "You are not in a team.");
    const sub = check(await db().from("submissions").select("status").eq("team_id", m.team_id).maybeSingle());
    if (sub && sub.status !== "draft") throw new ApiError(409, "Your team has already submitted; teams are locked.");
    if (m.is_leader) {
      const { count } = await db().from("team_members").select("id", { count: "exact", head: true }).eq("team_id", m.team_id);
      if ((count ?? 0) > 1) throw new ApiError(409, "The team leader can leave only after the other members have left.");
      check(await db().from("teams").delete().eq("id", m.team_id));
    } else {
      check(await db().from("team_members").delete().eq("id", m.id));
    }
  },

  async saveSubmission(c: Caller | null, p: P) {
    const me = requireRole(c, "user");
    await requireConfirmed(me.profileId);
    const m = await teamOf(me.profileId!);
    if (!m) throw new ApiError(409, "Create or join a team before submitting.");
    const cfg = await getEventConfig();
    if (cfg.submission_deadline_at && Date.now() > new Date(cfg.submission_deadline_at).getTime()) {
      throw new ApiError(409, "The submission deadline has passed.");
    }
    const existing = check(await db().from("submissions").select("*").eq("team_id", m.team_id).maybeSingle());
    if (existing && existing.status === "evaluated") throw new ApiError(409, "This submission has already been evaluated and is locked.");
    const status = p.status === "submitted" ? "submitted" : "draft";
    const row = {
      team_id: m.team_id,
      project_name: str(p.projectName, "Project name", 120),
      problem_statement: str(p.problemStatement, "Problem statement", 2000, status === "submitted"),
      description: str(p.description, "Description", 5000, status === "submitted"),
      technologies: Array.isArray(p.technologies) ? p.technologies.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 20) : [],
      github_url: url(p.githubUrl, "GitHub link"), demo_url: url(p.demoUrl, "Demo link"),
      presentation_url: url(p.presentationUrl, "Presentation link"), file_url: url(p.fileUrl, "File link"),
      status, updated_at: new Date().toISOString(),
      ...(status === "submitted" ? { submitted_at: new Date().toISOString() } : {}),
    };
    if (status === "submitted" && !row.github_url && !row.demo_url) {
      throw new ApiError(400, "Add a GitHub or demo link before final submission.");
    }
    check(await db().from("submissions").upsert(row, { onConflict: "team_id" }));
  },

  async createSupportTicket(c: Caller | null, p: P) {
    const me = requireRole(c, "user", "coordinator", "admin");
    const reg = me.profileId ? await registrationOf(me.profileId) : null;
    const t = check(await db().from("support_tickets").insert({
      user_id: me.id, registration_id: reg?.id ?? null, category: str(p.category, "Category", 40),
      subject: str(p.subject, "Subject", 150), message: str(p.message, "Message", 4000),
      attachment_url: url(p.attachmentUrl, "Attachment link"),
    }).select("ticket_code").single());
    return { ticketCode: t!.ticket_code };
  },
};

// ------------------------------------------------------------------ staff
const staff = {
  async reviewPayment(c: Caller | null, p: P) {
    const me = requirePermission(c, "REGISTRATION_VERIFY");
    const reg = check(await db().from("registrations").select("*").eq("id", str(p.registrationId, "Registration")).maybeSingle());
    if (!reg) throw new ApiError(404, "Registration not found.");
    if (reg.payment_status !== "pending") throw new ApiError(409, `This payment is already ${reg.payment_status}.`);

    if (p.decision === "reject") {
      const reason = str(p.reason, "Rejection reason", 300);
      check(await db().from("registrations").update({
        payment_status: "failed", registration_status: "reserved", rejection_reason: reason, verified_by: me.id, verified_at: new Date().toISOString(),
      }).eq("id", reg.id).eq("payment_status", "pending"));
      check(await db().from("payments").insert({ registration_id: reg.id, amount: reg.fee, status: "failed", utr_number: reg.utr_number }));
      return { status: "rejected" };
    }
    if (p.decision !== "approve") throw new ApiError(400, "Decision must be approve or reject.");
    check(await db().from("registrations").update({
      payment_status: "success", registration_status: "confirmed", rejection_reason: null, verified_by: me.id, verified_at: new Date().toISOString(),
    }).eq("id", reg.id).eq("payment_status", "pending"));
    check(await db().from("payments").insert({ registration_id: reg.id, amount: reg.fee, status: "success", utr_number: reg.utr_number }));
    check(await db().from("tickets").upsert({
      registration_id: reg.id, ticket_number: reg.registration_number, qr_token: newQrToken(), status: "active",
    }, { onConflict: "registration_id" }));
    return { status: "approved", ticketNumber: reg.registration_number };
  },

  async paymentProofUrl(c: Caller | null, p: P) {
    requirePermission(c, "REGISTRATION_VERIFY");
    const reg = check(await db().from("registrations").select("payment_proof_path").eq("id", str(p.registrationId, "Registration")).maybeSingle());
    if (!reg?.payment_proof_path) throw new ApiError(404, "No payment screenshot uploaded.");
    const s = await db().storage.from(PROOF_BUCKET).createSignedUrl(reg.payment_proof_path, 300);
    if (s.error) throw new ApiError(500, s.error.message);
    return { url: s.data.signedUrl };
  },

  async checkIn(c: Caller | null, p: P): Promise<P> {
    const me = requirePermission(c, "CHECKIN_MANAGE");
    const raw = str(p.query, "Ticket", 200);
    // QR payload is "ticket_id=<REG>&k=<token>"; manual entry is the registration number.
    const params = new URLSearchParams(raw.includes("=") ? raw : "");
    const regNo = (params.get("ticket_id") || raw).trim().toUpperCase();
    const token = params.get("k");
    if (raw.includes("ticket_id=") && !token) return { status: "invalid", message: "QR code is missing its security token. Possible forged ticket." };
    const reg = check(await db().from("registrations").select("*").eq("registration_number", regNo).maybeSingle());
    if (!reg) return { status: "invalid", message: "Ticket not found." };
    const ticket = check(await db().from("tickets").select("*").eq("registration_id", reg.id).maybeSingle());
    if (token && ticket && token !== ticket.qr_token) return { status: "invalid", message: "QR code signature does not match. Possible forged ticket." };
    const profile = check(await db().from("participant_profiles").select("*").eq("id", reg.participant_id).single());
    const person = {
      name: profile.certificate_name, registrationNumber: reg.registration_number, rollNumber: profile.roll_number,
      branch: profile.branch, year: profile.year, section: profile.section, isteMember: profile.iste_member,
    };
    if (reg.registration_status !== "confirmed" || reg.payment_status !== "success" || !ticket) {
      return { status: "invalid", message: `Payment not verified (status: ${reg.payment_status}). Send to the registration desk.`, participant: { ...person, checkInTime: "" } };
    }
    const prior = check(await db().from("attendance").select("*").eq("registration_id", reg.id).maybeSingle());
    if (prior) {
      const t = fmtIST(prior.check_in_at);
      return { status: "already_checked_in", message: `Already checked in at ${t} by ${prior.checked_in_by_name}.`, participant: { ...person, checkInTime: t, firstCheckInTime: t } };
    }
    const ins = await db().from("attendance").insert({
      registration_id: reg.id, ticket_id: ticket.id, checked_in_by: me.id, checked_in_by_name: me.name,
    }).select().single();
    if (ins.error) {
      if (ins.error.code === "23505") return staff.checkIn(c, p); // concurrent scan: report the duplicate
      throw dbError(ins.error);
    }
    check(await db().from("tickets").update({ status: "used" }).eq("id", ticket.id));
    return { status: "verified", message: "Check-in verified.", participant: { ...person, checkInTime: fmtIST(ins.data.check_in_at) } };
  },

  async replySupportTicket(c: Caller | null, p: P) {
    const me = requireRole(c, "user", "coordinator", "admin");
    if (me.role !== "user") requirePermission(me, "SUPPORT_REPLY"); // authorise before touching data
    const ticket = check(await db().from("support_tickets").select("*").eq("id", str(p.ticketId, "Ticket")).maybeSingle());
    if (!ticket) throw new ApiError(404, "Support ticket not found.");
    if (me.role === "user" && ticket.user_id !== me.id) throw new ApiError(403, "Not your ticket.");
    check(await db().from("support_messages").insert({
      ticket_id: ticket.id, sender_id: me.id, sender_name: me.name, sender_role: me.role, message: str(p.message, "Message", 4000),
    }));
    const status = me.role === "user" ? (ticket.status === "resolved" ? "open" : ticket.status) : "in_progress";
    check(await db().from("support_tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", ticket.id));
  },

  async setSupportStatus(c: Caller | null, p: P) {
    requirePermission(c, "SUPPORT_REPLY");
    const status = str(p.status, "Status", 20);
    if (!["open", "in_progress", "resolved", "closed"].includes(status)) throw new ApiError(400, "Invalid status.");
    check(await db().from("support_tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", str(p.ticketId, "Ticket")));
  },
};

// ------------------------------------------------------------------ admin
const PERMS: CoordinatorPermission[] = ["CHECKIN_VIEW", "CHECKIN_MANAGE", "PARTICIPANT_VIEW", "REGISTRATION_VERIFY", "SUPPORT_VIEW", "SUPPORT_REPLY"];

const admin = {
  async updateEventConfig(c: Caller | null, p: P) {
    requireRole(c, "admin");
    const patch: P = {};
    const text = ["name", "subtitle", "organized_by", "associated_with", "date_formatted", "time", "venue", "description", "upi_payee_name"];
    for (const k of text) if (k in p) patch[k] = str(p[k], k, 2000);
    if ("upi_id" in p) {
      const upi = str(p.upi_id, "UPI ID", 60, false);
      if (upi && !/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/.test(upi)) throw new ApiError(400, "UPI ID must look like name@bank (e.g. nbkrist@okaxis).");
      patch.upi_id = upi;
    }
    if ("support_contact_name" in p) patch.support_contact_name = str(p.support_contact_name, "Contact name", 80, false);
    if ("support_whatsapp" in p) {
      const digits = String(p.support_whatsapp ?? "").replace(/\D/g, "");
      if (digits && (digits.length < 10 || digits.length > 15)) throw new ApiError(400, "WhatsApp number must be 10 digits, or include the country code (e.g. 919876543210).");
      patch.support_whatsapp = digits.length === 10 ? `91${digits}` : digits;
    }
    if ("date" in p) patch.date = str(p.date, "date", 20);
    if ("capacity" in p) patch.capacity = int(p.capacity, "Capacity", 1, 5000);
    if ("iste_fee" in p) patch.iste_fee = int(p.iste_fee, "ISTE fee", 0, 100000);
    if ("non_iste_fee" in p) patch.non_iste_fee = int(p.non_iste_fee, "Non-ISTE fee", 0, 100000);
    if ("max_team_size" in p) patch.max_team_size = int(p.max_team_size, "Max team size", 1, 10);
    if ("registration_open" in p) patch.registration_open = Boolean(p.registration_open);
    for (const k of ["event_end_at", "submission_deadline_at"]) {
      if (k in p) {
        const d = new Date(String(p[k]));
        if (isNaN(d.getTime())) throw new ApiError(400, `${k} must be a valid date-time.`);
        patch[k] = d.toISOString();
      }
    }
    patch.updated_at = new Date().toISOString();
    check(await db().from("event_config").update(patch).eq("id", 1));
  },

  async createCoordinator(c: Caller | null, p: P) {
    requireRole(c, "admin");
    const email = str(p.email, "Email", 120).toLowerCase();
    const password = str(p.password, "Password", 72);
    if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters.");
    const created = await db().auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw new ApiError(409, created.error.message);
    const id = created.data.user.id;
    const u = await db().from("app_users").insert({ id, name: str(p.name, "Name", 80), email, phone: str(p.phone, "Phone", 20, false), role: "coordinator" });
    if (u.error) { await db().auth.admin.deleteUser(id); throw dbError(u.error); }
    const perms = Array.isArray(p.permissions) ? p.permissions.filter((x: string) => PERMS.includes(x as CoordinatorPermission)) : undefined;
    check(await db().from("coordinators").insert({ user_id: id, employee_or_student_id: str(p.employeeId, "ID", 40, false), ...(perms ? { permissions: perms } : {}) }));
  },

  async setCoordinatorPermission(c: Caller | null, p: P) {
    requireRole(c, "admin");
    const perm = str(p.permission, "Permission", 40) as CoordinatorPermission;
    if (!PERMS.includes(perm)) throw new ApiError(400, "Unknown permission.");
    const row = check(await db().from("coordinators").select("permissions").eq("id", str(p.coordinatorId, "Coordinator")).single());
    const current: string[] = row?.permissions ?? [];
    const has = current.includes(perm);
    const next = (p.enabled ?? !has) ? Array.from(new Set([...current, perm])) : current.filter((x) => x !== perm);
    check(await db().from("coordinators").update({ permissions: next }).eq("id", p.coordinatorId));
    clearCallerCache();
  },

  async setCoordinatorStatus(c: Caller | null, p: P) {
    requireRole(c, "admin");
    const status = p.status === "disabled" ? "disabled" : "active";
    check(await db().from("coordinators").update({ status }).eq("id", str(p.coordinatorId, "Coordinator")));
    clearCallerCache();
  },

  async saveResource(c: Caller | null, p: P) {
    const me = requireRole(c, "admin");
    const type = str(p.resource_type, "Type", 20);
    if (!["pdf", "guide", "code", "presentation", "video", "link"].includes(type)) throw new ApiError(400, "Invalid resource type.");
    const row = {
      title: str(p.title, "Title", 150), description: str(p.description, "Description", 1000, false), resource_type: type,
      file_url: url(p.file_url, "Link") ?? (() => { throw new ApiError(400, "Link is required."); })(),
      file_size: str(p.file_size, "Size", 20, false) || null, published: p.published !== false, created_by: me.name,
    };
    if (p.id) check(await db().from("resources").update(row).eq("id", p.id));
    else check(await db().from("resources").insert(row));
  },
  async setResourcePublished(c: Caller | null, p: P) {
    requireRole(c, "admin");
    check(await db().from("resources").update({ published: Boolean(p.published) }).eq("id", str(p.id, "Resource")));
  },
  async deleteResource(c: Caller | null, p: P) {
    requireRole(c, "admin");
    check(await db().from("resources").delete().eq("id", str(p.id, "Resource")));
  },

  async saveAnnouncement(c: Caller | null, p: P) {
    requireRole(c, "admin");
    const row = {
      title: str(p.title, "Title", 150), content: str(p.content, "Content", 25000),
      priority: p.priority === "urgent" ? "urgent" : "normal",
      category: ["general", "schedule", "challenge", "wifi", "certificate"].includes(p.category) ? p.category : "general",
      published: p.published !== false,
    };
    if (p.id) check(await db().from("announcements").update(row).eq("id", p.id));
    else check(await db().from("announcements").insert(row));
  },
  async setAnnouncementPublished(c: Caller | null, p: P) {
    requireRole(c, "admin");
    check(await db().from("announcements").update({ published: Boolean(p.published) }).eq("id", str(p.id, "Announcement")));
  },
  async deleteAnnouncement(c: Caller | null, p: P) {
    requireRole(c, "admin");
    check(await db().from("announcements").delete().eq("id", str(p.id, "Announcement")));
  },

  async scoreSubmission(c: Caller | null, p: P) {
    const me = requireRole(c, "admin");
    const sub = check(await db().from("submissions").select("*").eq("id", str(p.submissionId, "Submission")).maybeSingle());
    if (!sub) throw new ApiError(404, "Submission not found.");
    if (sub.status === "draft") throw new ApiError(409, "Drafts cannot be scored; the team has not submitted yet.");
    check(await db().from("submissions").update({
      score_innovation: int(p.innovation, "Innovation", 0, 10),
      score_ai_prompting: int(p.tools_tech ?? p.ai_prompting, "Tools & Tech", 0, 20),
      score_tech_execution: int(p.ui_ux ?? p.tech_execution, "UI & UX", 0, 10),
      score_presentation: int(p.production_ready ?? p.presentation, "Production Ready", 0, 10),
      feedback: str(p.feedback, "Feedback", 2000, false) || null, status: "evaluated", evaluated_by: me.id, updated_at: new Date().toISOString(),
    }).eq("id", sub.id));
  },

  /** Issue participation certificates to everyone eligible, plus merit for ranks 1 and 2. Idempotent. */
  async issueCertificates(c: Caller | null) {
    const me = requireRole(c, "admin");
    const cfg = await getEventConfig();
    if (cfg.event_end_at && Date.now() < new Date(cfg.event_end_at).getTime()) {
      throw new ApiError(409, `Certificates can be issued only after the event ends (${fmtIST(cfg.event_end_at)}).`);
    }
    const regs = check(await db().from("registrations").select("*"));
    const att = new Set((check(await db().from("attendance").select("registration_id").eq("status", "checked_in")) as P[]).map((a) => a.registration_id));
    const existing = new Set((check(await db().from("certificates").select("registration_id,type")) as P[]).map((x) => `${x.registration_id}:${x.type}`));
    const members = check(await db().from("team_members").select("team_id,participant_id")) as P[];
    const subs = (check(await db().from("submissions").select("*").eq("status", "evaluated")) as P[])
      .map((s) => ({ team: s.team_id, total: s.score_innovation + s.score_ai_prompting + s.score_tech_execution + s.score_presentation, at: s.submitted_at }))
      .sort((a, b) => b.total - a.total || a.at.localeCompare(b.at));
    const rankOfTeam = new Map(subs.map((s, i) => [s.team, i + 1]));

    const issued: string[] = [];
    const skipped: { registration: string; reason: string }[] = [];
    for (const r of regs as P[]) {
      if (r.registration_status !== "confirmed" || r.payment_status !== "success") {
        skipped.push({ registration: r.registration_number, reason: `payment ${r.payment_status}` });
        continue;
      }
      if (!att.has(r.id)) {
        skipped.push({ registration: r.registration_number, reason: "not checked in" });
        continue;
      }
      const wanted: { type: string; rank?: string }[] = [{ type: "participation" }];
      const team = members.find((m) => m.participant_id === r.participant_id)?.team_id;
      const rk = team ? rankOfTeam.get(team) : undefined;
      if (rk === 1) wanted.push({ type: "winner", rank: "1st Place" });
      if (rk === 2) wanted.push({ type: "runner_up", rank: "2nd Place" });
      for (const w of wanted) {
        if (existing.has(`${r.id}:${w.type}`)) continue;
        const res = await db().from("certificates").insert({
          certificate_id: newCertificateId(), registration_id: r.id, type: w.type, rank: w.rank ?? null, issued_by: me.id,
        });
        if (res.error) skipped.push({ registration: r.registration_number, reason: dbError(res.error).message });
        else issued.push(`${r.registration_number}:${w.type}`);
      }
    }
    return { issued: issued.length, skipped };
  },

  async revokeCertificate(c: Caller | null, p: P) {
    requireRole(c, "admin");
    check(await db().from("certificates").update({ status: "revoked" }).eq("certificate_id", str(p.certificateId, "Certificate")));
  },
};

const pub = {
  async verifyCertificate(_c: Caller | null, p: P) {
    const cert = await verifyCertificate(str(p.certificateId, "Certificate ID", 40));
    return { certificate: cert, revoked: cert?.status === "revoked" };
  },
};

export const ACTIONS: Record<string, (c: Caller | null, p: P) => Promise<unknown>> = {
  ...participant, ...staff, ...admin, ...pub,
};
