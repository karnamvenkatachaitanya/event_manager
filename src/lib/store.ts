"use client";

import { useEffect, useState } from "react";
import type {
  Announcement, AttendanceRecord, Certificate, CoordinatorInfo, CoordinatorPermission, EventConfig, EventResource,
  ParticipantProfile, Payment, ProjectSubmission, Registration, SupportTicket, Team, Ticket, User,
} from "./types";
import { initialEventConfig } from "./data/eventDefaults";
import { accessToken } from "./supabaseBrowser";

/**
 * Client cache of the server state. The server (/api/state) returns only what the
 * signed-in user's role may see. Every write goes through /api/action and then the
 * cache is refreshed. `loadStore()` stays synchronous so components can read it in render.
 */
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

const empty = (): StoreState => ({
  eventConfig: initialEventConfig, users: [], profiles: [], registrations: [], payments: [], tickets: [], attendance: [],
  coordinators: [], resources: [], teams: [], submissions: [], supportTickets: [], announcements: [], certificates: [], seatsTaken: 0,
});

let cache: StoreState = empty();
let ready = false;
let inflight: Promise<StoreState> | null = null;

export function loadStore(): StoreState {
  return cache;
}
export function isStoreReady(): boolean {
  return ready;
}
/** Install a state payload fetched elsewhere (AuthProvider) without a second request. */
export function applyState(state: StoreState) {
  cache = state;
  ready = true;
  if (typeof window !== "undefined") window.dispatchEvent(new Event("store_updated"));
}
export function clearStore() {
  cache = empty();
  ready = false;
  if (typeof window !== "undefined") window.dispatchEvent(new Event("store_updated"));
}

async function authHeaders(): Promise<Record<string, string>> {
  const t = await accessToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function refreshStore(): Promise<StoreState> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/state", { headers: await authHeaders(), cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      cache = json.data.state;
      ready = true;
      window.dispatchEvent(new Event("store_updated"));
      return cache;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** React hook: re-renders whenever the store refreshes. */
export function useStore(): StoreState {
  const [, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((n) => n + 1);
    window.addEventListener("store_updated", on);
    return () => window.removeEventListener("store_updated", on);
  }, []);
  return cache;
}

async function call<T = unknown>(action: string, payload: Record<string, unknown> = {}, refresh = true): Promise<T> {
  const res = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ action, payload }),
  });
  const json = await res.json().catch(() => ({ ok: false, error: "Network error" }));
  if (!json.ok) throw new Error(json.error || "Request failed");
  if (refresh) await refreshStore();
  return json.data as T;
}

async function postForm<T = unknown>(path: string, form: FormData): Promise<T> {
  const res = await fetch(path, { method: "POST", body: form, headers: await authHeaders() });
  const json = await res.json().catch(() => ({ ok: false, error: "Network error" }));
  if (!json.ok) throw new Error(json.error || "Request failed");
  return json.data as T;
}

// ------------------------------------------------------------------ registration & payment
/** Public. Fields: name,email,password,mobile,rollNumber,year,branch,section,isteMember,isteSmNumber,hasLaptop,linkedinPortfolio,utr + file "proof". */
export const registerParticipant = (form: FormData) =>
  postForm<{ registrationNumber: string; fee: number }>("/api/register", form);
/** Participant: new UTR + "proof" file after a rejected payment. */
export const resubmitPayment = async (form: FormData) => {
  await postForm("/api/payment/resubmit", form);
  await refreshStore();
};
export const reviewPayment = (registrationId: string, decision: "approve" | "reject", reason?: string) =>
  call<{ status: string; ticketNumber?: string }>("reviewPayment", { registrationId, decision, reason });
export const paymentProofUrl = (registrationId: string) =>
  call<{ url: string }>("paymentProofUrl", { registrationId }, false);

// ------------------------------------------------------------------ gate
export interface CheckInResult {
  status: "verified" | "already_checked_in" | "invalid";
  message: string;
  success?: boolean;
  participant?: {
    name: string; registrationNumber: string; rollNumber: string; branch: string; year: string; section: string;
    isteMember: boolean; checkInTime: string; firstCheckInTime?: string;
  };
}
export const processCheckIn = async (query: string): Promise<CheckInResult> => {
  const r = await call<CheckInResult>("checkIn", { query });
  return { ...r, success: r.status === "verified" };
};

// ------------------------------------------------------------------ participant
export const updateProfile = (p: { name: string; certificateName?: string; mobile: string; linkedinPortfolio?: string; hasLaptop: boolean }) =>
  call("updateProfile", p);
export const createTeam = (name: string) => call<{ teamId: string; inviteCode: string }>("createTeam", { name });
export const joinTeam = (inviteCode: string) => call<{ teamId: string }>("joinTeam", { inviteCode });
export const leaveTeam = () => call("leaveTeam");
export const saveProjectSubmission = (data: {
  projectName: string; problemStatement: string; description: string; technologies: string[];
  githubUrl?: string; demoUrl?: string; presentationUrl?: string; fileUrl?: string; status: "draft" | "submitted";
}) => call("saveSubmission", data);
export const createSupportTicket = (t: { category: string; subject: string; message: string; attachmentUrl?: string }) =>
  call<{ ticketCode: string }>("createSupportTicket", t);
export const replySupportTicket = (ticketId: string, message: string) => call("replySupportTicket", { ticketId, message });
export const setSupportStatus = (ticketId: string, status: SupportTicket["status"]) => call("setSupportStatus", { ticketId, status });

// ------------------------------------------------------------------ admin
export const updateEventConfig = (patch: Partial<EventConfig>) => call("updateEventConfig", patch as Record<string, unknown>);
export const createCoordinator = (c: { name: string; email: string; password: string; phone?: string; employeeId?: string; permissions?: CoordinatorPermission[] }) =>
  call("createCoordinator", c);
export const toggleCoordinatorPermission = (coordinatorId: string, permission: CoordinatorPermission, enabled?: boolean) =>
  call("setCoordinatorPermission", { coordinatorId, permission, enabled });
export const setCoordinatorStatus = (coordinatorId: string, status: "active" | "disabled") =>
  call("setCoordinatorStatus", { coordinatorId, status });
export const saveResource = (r: Partial<EventResource>) => call("saveResource", r as Record<string, unknown>);
export const setResourcePublished = (id: string, published: boolean) => call("setResourcePublished", { id, published });
export const deleteResource = (id: string) => call("deleteResource", { id });
export const saveAnnouncement = (a: Partial<Announcement>) => call("saveAnnouncement", a as Record<string, unknown>);
export const setAnnouncementPublished = (id: string, published: boolean) => call("setAnnouncementPublished", { id, published });
export const deleteAnnouncement = (id: string) => call("deleteAnnouncement", { id });
export const scoreSubmission = (
  submissionId: string,
  scores: {
    innovation: number;
    tools_tech?: number;
    ui_ux?: number;
    production_ready?: number;
    ai_prompting?: number;
    tech_execution?: number;
    presentation?: number;
    feedback?: string;
  },
) => call("scoreSubmission", { submissionId, ...scores });
export const issueCertificates = () =>
  call<{ issued: number; skipped: { registration: string; reason: string }[] }>("issueCertificates");
export const revokeCertificate = (certificateId: string) => call("revokeCertificate", { certificateId });

// ------------------------------------------------------------------ public
export const verifyCertificate = (certificateId: string) =>
  call<{ certificate: Certificate | null; revoked: boolean }>("verifyCertificate", { certificateId }, false);

/**
 * Export data to CSV
 */
export function generateCsvData(type: "participants" | "attendance" | "payments" | "submissions"): string {
  const store = loadStore();

  if (type === "participants") {
    const headers = [
      "Registration Number",
      "Full Name",
      "Roll Number",
      "Email",
      "Phone",
      "Year",
      "Branch",
      "Section",
      "ISTE Member",
      "ISTE SM Number",
      "Has Laptop",
      "Payment Status",
      "Fee (INR)",
    ];
    const rows = store.registrations.map((reg) => {
      const profile = store.profiles.find((p) => p.id === reg.participant_id);
      const user = store.users.find((u) => u.id === profile?.user_id);
      return [
        reg.registration_number,
        `"${profile?.certificate_name || user?.name || ""}"`,
        profile?.roll_number || "",
        user?.email || "",
        profile?.mobile || "",
        profile?.year || "",
        profile?.branch || "",
        profile?.section || "",
        profile?.iste_member ? "Yes" : "No",
        profile?.iste_sm_number || "N/A",
        profile?.has_laptop ? "Yes" : "No",
        reg.payment_status.toUpperCase(),
        reg.fee,
      ].join(",");
    });
    return [headers.join(","), ...rows].join("\n");
  }

  if (type === "attendance") {
    const headers = [
      "Registration Number",
      "Participant Name",
      "Roll Number",
      "Branch",
      "Year",
      "Section",
      "ISTE Member",
      "Checked In By",
      "Check In Time",
      "Status",
    ];
    const rows = store.attendance.map((att) =>
      [
        att.registration_number,
        `"${att.participant_name}"`,
        att.roll_number,
        att.branch,
        att.year,
        att.section,
        att.iste_member ? "Yes" : "No",
        `"${att.checked_in_by}"`,
        att.check_in_time,
        att.status.toUpperCase(),
      ].join(",")
    );
    return [headers.join(","), ...rows].join("\n");
  }

  if (type === "payments") {
    const headers = [
      "Payment ID",
      "Registration Number",
      "UTR",
      "Verified By",
      "Amount (INR)",
      "Payment Method",
      "Status",
      "Date",
    ];
    const rows = store.payments.map((p) => {
      const reg = store.registrations.find((r) => r.id === p.registration_id);
      return [
        p.id,
        reg?.registration_number || "N/A",
        `"${p.utr_number || ""}"`,
        `"${reg?.verified_by_name || ""}"`,
        p.amount,
        `"${p.payment_method || "Online"}"`,
        p.status.toUpperCase(),
        p.created_at,
      ].join(",");
    });
    return [headers.join(","), ...rows].join("\n");
  }

  if (type === "submissions") {
    const headers = [
      "Team Name",
      "Project Name",
      "Technologies",
      "Status",
      "Innovation (10)",
      "Tools & Tech (20)",
      "UI & UX (10)",
      "Production Ready (10)",
      "Total Score (50)",
      "GitHub Repo",
      "Demo URL",
    ];
    const rows = store.submissions.map((sub) =>
      [
        `"${sub.team_name}"`,
        `"${sub.project_name}"`,
        `"${sub.technologies.join("; ")}"`,
        sub.status.toUpperCase(),
        sub.scores?.innovation ?? "-",
        sub.scores?.tools_tech ?? sub.scores?.ai_prompting ?? "-",
        sub.scores?.ui_ux ?? sub.scores?.tech_execution ?? "-",
        sub.scores?.production_ready ?? sub.scores?.presentation ?? "-",
        sub.scores?.total ?? "-",
        sub.github_url || "",
        sub.demo_url || "",
      ].join(",")
    );
    return [headers.join(","), ...rows].join("\n");
  }

  return "";
}

export function triggerDownload(content: string, filename: string, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
