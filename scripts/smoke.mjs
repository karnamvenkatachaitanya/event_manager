// End-to-end smoke test against the running app + real Supabase.
// Usage: ADMIN_PW=... COORD_PW=... node --env-file=.env.local scripts/smoke.mjs [baseUrl]
// Creates throwaway participants (roll numbers SMK*, emails smoke+*@example.com) and removes them at the end.
import { createClient } from "@supabase/supabase-js";

const BASE = process.argv[2] || "http://localhost:3400";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const run = Date.now().toString(36).toUpperCase();
let pass = 0, fail = 0;
const ok = (cond, label, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); } else { fail++; console.log(`  ✗ ${label} ${extra}`); }
};
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

async function token(email, password) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return data.session.access_token;
}
async function act(tok, action, payload = {}) {
  const r = await fetch(`${BASE}/api/action`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: JSON.stringify({ action, payload }),
  });
  return { status: r.status, ...(await r.json()) };
}
async function state(tok) {
  const r = await fetch(`${BASE}/api/state`, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} });
  return (await r.json()).data;
}
async function register(p, { withProof = true } = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries(p)) f.append(k, String(v));
  if (withProof) f.append("proof", new Blob([PNG], { type: "image/png" }), "proof.png");
  const r = await fetch(`${BASE}/api/register`, { method: "POST", body: f });
  return { status: r.status, ...(await r.json()) };
}
async function resubmit(tok, utr) {
  const f = new FormData();
  f.append("utr", utr);
  f.append("proof", new Blob([PNG], { type: "image/png" }), "proof2.png");
  const r = await fetch(`${BASE}/api/payment/resubmit`, { method: "POST", body: f, headers: { Authorization: `Bearer ${tok}` } });
  return { status: r.status, ...(await r.json()) };
}
const utr = (n) => (Date.now().toString().slice(-9) + String(n).padStart(3, "0")).slice(-12);
const person = (n, extra = {}) => ({
  name: `Smoke Student ${n}`, email: `smoke+${run.toLowerCase()}${n}@example.com`, password: `Smoke-pass-${n}!`,
  mobile: "9876543210", rollNumber: `SMK${run}${n}`, year: "3rd Year", branch: "AI & DS", section: "A",
  isteMember: n === 1 ? "true" : "false", isteSmNumber: n === 1 ? "SM123456" : "", hasLaptop: "true", utr: utr(n), ...extra,
});

const created = [];
const cfgBefore = (await admin.from("event_config").select("event_end_at,submission_deadline_at").single()).data;
// Registration needs a UPI ID configured; use a test one for the run and restore afterwards.
const SMOKE_UPI = (await admin.from("event_config").select("upi_id").single()).data?.upi_id ?? "";
if (!SMOKE_UPI) await admin.from("event_config").update({ upi_id: "smoke.test@okaxis" }).eq("id", 1);
try {
  const ADMIN = await token("admin@nbkrist.org", process.env.ADMIN_PW);
  const COORD = await token("coordinator@nbkrist.org", process.env.COORD_PW);

  console.log("\n1. Public + registration");
  const pub = await state(null);
  ok(pub?.state?.eventConfig?.capacity > 0 && pub.state.users.length === 0, "anonymous state exposes event config but no user data");
  const A = person(1), B = person(2), C = person(3);
  const rA = await register(A); ok(rA.ok && rA.data.fee === 50, "student A (ISTE) registers, fee ₹50", JSON.stringify(rA));
  const rB = await register(B); ok(rB.ok && rB.data.fee === 100, "student B (non-ISTE) registers, fee ₹100", JSON.stringify(rB));
  const rC = await register(C); ok(rC.ok, "student C registers", JSON.stringify(rC));
  created.push(A.email, B.email, C.email);
  ok((await register(person(4, { utr: A.utr }))).status === 409, "duplicate UTR is rejected");
  ok((await register(person(5, { rollNumber: A.rollNumber }))).status === 409, "duplicate roll number is rejected");
  ok((await register(person(6, { utr: "12345" }))).status === 400, "malformed UTR is rejected");
  ok((await register(person(7), { withProof: false })).status === 400, "registration without payment screenshot is rejected");
  ok((await register(person(8, { email: A.email, rollNumber: `SMK${run}8B` }))).status === 409, "duplicate email is rejected");
  for (const e of [4, 5, 6, 7, 8]) created.push(person(e).email);

  const TA = await token(A.email, A.password), TB = await token(B.email, B.password), TC = await token(C.email, C.password);
  const sA = await state(TA);
  const regA = sA.state.registrations[0];
  ok(regA?.payment_status === "pending" && sA.state.tickets.length === 0, "new registration is PENDING with no ticket");
  ok(sA.state.users.length === 1 && sA.state.profiles.length === 1, "participant sees only their own records");

  console.log("\n2. Rules before payment verification");
  ok((await act(TA, "createTeam", { name: "Too Early" })).status === 409, "unverified participant cannot create a team");
  const early = await act(COORD, "checkIn", { query: regA.registration_number });
  ok(early.ok && early.data.status === "invalid", "gate refuses an unverified registration", JSON.stringify(early.data));
  ok((await act(TA, "reviewPayment", { registrationId: regA.id, decision: "approve" })).status === 403, "participant cannot approve their own payment");
  ok((await act(null, "reviewPayment", { registrationId: regA.id, decision: "approve" })).status === 401, "anonymous cannot call staff actions");

  console.log("\n3. Payment verification");
  const proof = await act(COORD, "paymentProofUrl", { registrationId: regA.id });
  ok(proof.ok && (await fetch(proof.data.url)).status === 200, "coordinator can open the payment screenshot (signed URL)");
  const staffState = await state(COORD);
  const regB = staffState.state.registrations.find((r) => r.registration_number === rB.data.registrationNumber);
  const regC = staffState.state.registrations.find((r) => r.registration_number === rC.data.registrationNumber);
  ok((await act(COORD, "reviewPayment", { registrationId: regA.id, decision: "approve" })).ok, "coordinator approves A");
  ok((await act(ADMIN, "reviewPayment", { registrationId: regB.id, decision: "approve" })).ok, "admin approves B");
  ok((await act(COORD, "reviewPayment", { registrationId: regA.id, decision: "approve" })).status === 409, "a payment cannot be approved twice");
  ok((await act(COORD, "reviewPayment", { registrationId: regC.id, decision: "reject" })).status === 400, "rejection requires a reason");
  ok((await act(COORD, "reviewPayment", { registrationId: regC.id, decision: "reject", reason: "UTR not found in bank statement" })).ok, "coordinator rejects C with a reason");
  const sC = await state(TC);
  ok(sC.state.registrations[0].payment_status === "failed" && sC.state.registrations[0].rejection_reason, "C sees the rejection reason");
  ok((await resubmit(TC, utr(33))).ok, "C resubmits a new UTR + screenshot");
  ok((await act(COORD, "reviewPayment", { registrationId: regC.id, decision: "approve" })).ok, "coordinator approves C's resubmission");
  const sA2 = await state(TA);
  const ticketA = sA2.state.tickets[0];
  ok(sA2.state.registrations[0].registration_status === "confirmed" && ticketA?.qr_token?.includes("&k="), "A is confirmed and has a signed QR ticket");

  console.log("\n4. Gate check-in");
  const ci = await act(COORD, "checkIn", { query: ticketA.qr_token });
  ok(ci.ok && ci.data.status === "verified", "scanning A's QR checks them in", JSON.stringify(ci.data));
  const again = await act(COORD, "checkIn", { query: ticketA.qr_token });
  ok(again.data?.status === "already_checked_in", "second scan reports already checked in");
  const forged = await act(COORD, "checkIn", { query: `ticket_id=${regB.registration_number}&k=forged` });
  ok(forged.data?.status === "invalid", "forged QR token is refused");
  const noTok = await act(COORD, "checkIn", { query: `ticket_id=${regB.registration_number}` });
  ok(noTok.data?.status === "invalid", "QR without its security token is refused");
  ok((await act(COORD, "checkIn", { query: regB.registration_number })).data?.status === "verified", "B checked in by manual registration number");
  ok((await act(TA, "checkIn", { query: regB.registration_number })).status === 403, "participant cannot check people in");
  // C is intentionally NOT checked in (absent)

  console.log("\n5. Teams + submission");
  const team = await act(TA, "createTeam", { name: `Smoke Team ${run}` });
  ok(team.ok && /^P2P-/.test(team.data.inviteCode), "A creates a team and gets an invite code");
  ok((await act(TA, "createTeam", { name: "Second team" })).status === 409, "A cannot create a second team");
  ok((await act(TB, "joinTeam", { inviteCode: team.data.inviteCode })).ok, "B joins with the invite code");
  ok((await act(TB, "joinTeam", { inviteCode: team.data.inviteCode })).status === 409, "B cannot join twice");
  ok((await act(TA, "saveSubmission", { projectName: "Smoke Project", status: "submitted" })).status === 400, "final submit without details/links is rejected");
  ok((await act(TA, "saveSubmission", { projectName: "Smoke Project", status: "draft" })).ok, "draft saves");
  ok((await act(ADMIN, "scoreSubmission", { submissionId: (await state(ADMIN)).state.submissions.find((s) => s.team_id === team.data.teamId).id, innovation: 10, tools_tech: 20, ui_ux: 10, production_ready: 10 })).status === 409, "drafts cannot be scored");
  ok((await act(TB, "saveSubmission", {
    projectName: "Smoke Project", problemStatement: "Gate queues are slow.", description: "QR check-in with AI triage.",
    technologies: ["Next.js", "Supabase"], githubUrl: "https://github.com/example/smoke", status: "submitted",
  })).ok, "B submits the final project");
  ok((await act(TC, "joinTeam", { inviteCode: team.data.inviteCode })).status === 409, "team roster is locked after submission");
  const subId = (await state(ADMIN)).state.submissions.find((s) => s.team_id === team.data.teamId).id;
  ok((await act(ADMIN, "scoreSubmission", { submissionId: subId, innovation: 11, tools_tech: 20, ui_ux: 10, production_ready: 10 })).status === 400, "scores above criteria limit are rejected");
  ok((await act(COORD, "scoreSubmission", { submissionId: subId, innovation: 10, tools_tech: 20, ui_ux: 10, production_ready: 10 })).status === 403, "coordinator cannot judge");
  ok((await act(ADMIN, "scoreSubmission", { submissionId: subId, innovation: 9, tools_tech: 18, ui_ux: 9, production_ready: 10, feedback: "Excellent." })).ok, "admin scores the submission (46/50)");
  ok((await act(TA, "saveSubmission", { projectName: "Edit after judging", status: "draft" })).status === 409, "evaluated submission is locked");
  const board = (await state(null)).state.submissions.find((s) => s.team_id === team.data.teamId);
  ok(board && board.scores?.total === 46 && !board.github_url && !board.scores?.feedback, "public leaderboard shows the score without links or feedback");

  console.log("\n6. Certificates");
  const early2 = await act(ADMIN, "issueCertificates");
  ok(early2.status === 409, "certificates cannot be issued before the event ends");
  await admin.from("event_config").update({ event_end_at: new Date(Date.now() - 60000).toISOString() }).eq("id", 1);
  const issue = await act(ADMIN, "issueCertificates");
  ok(issue.ok, "admin issues certificates after the event", JSON.stringify(issue));
  const skippedC = issue.data?.skipped?.find((s) => s.registration === rC.data.registrationNumber);
  ok(skippedC?.reason === "not checked in", "absent student C is skipped with reason 'not checked in'", JSON.stringify(skippedC));
  const certsA = (await state(TA)).state.certificates;
  ok(certsA.some((c) => c.type === "participation"), "A (paid + attended) receives a participation certificate");
  const certsB = (await state(TB)).state.certificates;
  ok(certsB.some((c) => c.type === "participation"), "B receives a participation certificate");
  ok((await state(TC)).state.certificates.length === 0, "C receives no certificate");
  const hadMerit = certsA.some((c) => c.type === "winner" || c.type === "runner_up");
  ok(hadMerit, "A's team (top score) receives a merit certificate", JSON.stringify(certsA.map((c) => c.type)));
  const again2 = await act(ADMIN, "issueCertificates");
  ok(again2.ok && !(again2.data.skipped || []).some((s) => s.registration === rA.data.registrationNumber), "re-issuing is idempotent (no duplicates)");
  const regCrow = (await admin.from("registrations").select("id").eq("registration_number", rC.data.registrationNumber).single()).data;
  const direct = await admin.from("certificates").insert({ certificate_id: `CERT-SMOKE-${run}`, registration_id: regCrow.id, type: "participation" });
  ok(!!direct.error && /not checked in/.test(direct.error.message), "database itself refuses a certificate for an absent student");
  const v = await act(null, "verifyCertificate", { certificateId: certsA[0].certificate_id });
  ok(v.ok && v.data.certificate?.participant_name === A.name && !v.data.revoked, "public verification finds A's certificate");
  ok((await act(ADMIN, "revokeCertificate", { certificateId: certsA[0].certificate_id })).ok, "admin can revoke a certificate");
  const v2 = await act(null, "verifyCertificate", { certificateId: certsA[0].certificate_id });
  ok(v2.data.revoked === true, "revoked certificate verifies as revoked");
  ok((await act(null, "verifyCertificate", { certificateId: "CERT-P2P-2026-NOPE" })).data.certificate === null, "unknown certificate ID is not found");
} catch (e) {
  fail++;
  console.log("  ✗ smoke test crashed:", e.message);
} finally {
  if (!SMOKE_UPI) await admin.from("event_config").update({ upi_id: "" }).eq("id", 1);
  await admin.from("event_config").update(cfgBefore).eq("id", 1);
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const ids = list.users.filter((u) => created.includes(u.email)).map((u) => u.id);
  const { data: profs } = await admin.from("participant_profiles").select("id").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  if (profs?.length) await admin.from("teams").delete().in("leader_id", profs.map((p) => p.id));
  const files = (await admin.storage.from("payment-proofs").list("", { limit: 1000 })).data || [];
  for (const id of ids) {
    const inner = (await admin.storage.from("payment-proofs").list(id)).data || [];
    if (inner.length) await admin.storage.from("payment-proofs").remove(inner.map((f) => `${id}/${f.name}`));
    await admin.auth.admin.deleteUser(id);
  }
  void files;
  console.log(`\n${pass} passed, ${fail} failed (test data cleaned up)`);
  process.exit(fail ? 1 : 0);
}
