"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Send, CheckCircle2, AlertCircle, GitBranch, Globe, Presentation, FileCode, ArrowRight, Clock, Lock } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { useStore, saveProjectSubmission } from "@/lib/store";

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${String(s).padStart(2, "0")}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

const fmtIST = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  });

export default function SubmissionPage() {
  const { currentProfile, currentRegistration: reg } = useAuth();
  const store = useStore();
  const deadlineAt = store.eventConfig.submission_deadline_at;

  const profileId = currentProfile?.id;
  const team = profileId ? store.teams.find((t) => t.members.some((m) => m.participant_id === profileId)) ?? null : null;
  const submission = team ? store.submissions.find((s) => s.team_id === team.id) ?? null : null;
  const confirmed = !!reg && reg.registration_status === "confirmed" && reg.payment_status === "success";

  // Form State
  const [projectName, setProjectName] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [description, setDescription] = useState("");
  const [technologies, setTechnologies] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [presentationUrl, setPresentationUrl] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [triedFinal, setTriedFinal] = useState(false);
  const [busy, setBusy] = useState<"draft" | "submitted" | null>(null);

  // Deadline countdown
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadlineAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [deadlineAt]);
  const deadlineMs = deadlineAt ? new Date(deadlineAt).getTime() : null;
  const closed = deadlineMs !== null && now > deadlineMs;

  // Load the saved submission into the form once (not on every refresh, so edits are kept)
  if (submission && hydratedFor !== submission.id) {
    setProjectName(submission.project_name);
    setProblemStatement(submission.problem_statement || "");
    setDescription(submission.description || "");
    setTechnologies(submission.technologies.join(", "));
    setGithubUrl(submission.github_url || "");
    setDemoUrl(submission.demo_url || "");
    setPresentationUrl(submission.presentation_url || "");
    setFileUrl(submission.file_url || "");
    setHydratedFor(submission.id);
  }

  const handleSubmit = async (statusToSave: "draft" | "submitted") => {
    if (!team) return;
    setNotice(null);
    if (statusToSave === "submitted") {
      setTriedFinal(true);
      if (!projectName.trim() || !problemStatement.trim() || !description.trim()) {
        setNotice({ text: "Please fill in Project Name, Problem Statement, and Description.", type: "error" });
        return;
      }
      if (!githubUrl.trim() && !demoUrl.trim()) {
        setNotice({ text: "Add a GitHub or demo link before final submission.", type: "error" });
        return;
      }
    } else if (!projectName.trim()) {
      setNotice({ text: "Please enter a Project Name to save a draft.", type: "error" });
      return;
    }

    setBusy(statusToSave);
    try {
      await saveProjectSubmission({
        projectName: projectName.trim(),
        problemStatement: problemStatement.trim(),
        description: description.trim(),
        technologies: technologies.split(",").map((t) => t.trim()).filter(Boolean),
        githubUrl: githubUrl.trim() || undefined,
        demoUrl: demoUrl.trim() || undefined,
        presentationUrl: presentationUrl.trim() || undefined,
        fileUrl: fileUrl.trim() || undefined,
        status: statusToSave,
      });
      setNotice({
        text: statusToSave === "draft" ? "Draft saved." : "Project submitted for evaluation.",
        type: "success",
      });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "Could not save your submission.", type: "error" });
    } finally {
      setBusy(null);
    }
  };

  if (!confirmed) {
    return (
      <div className="max-w-2xl mx-auto frame bg-paper p-8 text-center space-y-4">
        <Lock className="w-10 h-10 text-ink-2 mx-auto" aria-hidden="true" />
        <h1 className="page-title text-ink">Submissions Open After Payment Verification</h1>
        <p className="text-sm text-ink-2">
          Only participants with a verified payment can join a team and submit a project.
        </p>
        <Link href="/dashboard" className="btn btn-primary">
          <span>Check Registration Status</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="max-w-2xl mx-auto frame bg-paper p-8 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-ink-2 mx-auto" aria-hidden="true" />
        <h1 className="page-title text-ink">No Team Joined Yet</h1>
        <p className="text-sm text-ink-2">
          Project submissions are team-based. Please create or join a team first to submit your Build Challenge prototype.
        </p>
        <Link href="/dashboard/team" className="btn btn-primary">
          <span>Go to Team Setup</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const isError = notice?.type === "error";
  const status = submission?.status || "not_started";
  const evaluated = status === "evaluated";
  const alreadySubmitted = status === "submitted" || status === "under_review";
  const locked = evaluated || closed;
  const statusTag =
    status === "submitted" || status === "evaluated"
      ? "tag-ok"
      : status === "draft" || status === "under_review"
        ? "tag-pending"
        : "";
  const invalid = (v: string) => (triedFinal && isError && !v.trim() ? true : undefined);

  const urlField = (
    id: string,
    label: string,
    placeholder: string,
    value: string,
    setValue: (v: string) => void,
    Icon: React.ComponentType<{ className?: string }>
  ) => (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <div className="relative">
        <input
          id={id}
          type="url"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={locked}
          className="field pl-10 font-mono text-sm"
        />
        <Icon className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="frame bg-paper px-5 py-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-ink">Project Submission</h1>
          <p className="text-sm text-ink-2 mt-2">
            Team: <strong className="text-ink">{team.name}</strong> · AI Build Challenge <span className="num">(1:45 PM – 3:15 PM)</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-2">Status:</span>
          <span className={`tag ${statusTag}`}>
            {submission?.status ? submission.status.replace("_", " ") : "Not Started"}
          </span>
        </div>
      </header>

      {/* Deadline */}
      <div
        className={`frame px-4 py-3 text-sm flex flex-wrap items-center gap-x-3 gap-y-1 ${
          closed ? "plane-field" : deadlineAt ? "plane-sun" : "bg-paper"
        }`}
      >
        <Clock className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        {!deadlineAt ? (
          <span>The submission deadline has not been announced yet.</span>
        ) : closed ? (
          <span>
            <strong>Submissions closed</strong> on {fmtIST(deadlineAt)}.
            {!submission || status === "draft" ? " Unsubmitted drafts were not entered for evaluation." : ""}
          </span>
        ) : (
          <span>
            Deadline {fmtIST(deadlineAt)} · <strong className="num" aria-live="off">{formatRemaining(deadlineMs! - now)}</strong> left
          </span>
        )}
      </div>

      {evaluated && (
        <div className="plane-field frame px-4 py-3 text-sm flex items-center gap-2">
          <Lock className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>This submission has been evaluated and is locked.</span>
        </div>
      )}

      {notice && (
        <div
          role={isError ? "alert" : "status"}
          className={`px-4 py-3 border text-sm text-ink flex items-center gap-2 ${
            isError ? "border-alert bg-alert-soft" : "border-ok bg-ok-soft"
          }`}
        >
          {isError ? (
            <AlertCircle className="w-5 h-5 text-alert flex-shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-ok flex-shrink-0" aria-hidden="true" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Jury Scores display if evaluated */}
      {submission?.scores && (
        <section aria-labelledby="scorecard" className="planes grid-cols-2 sm:grid-cols-4">
          <div className="col-span-full px-5 py-4 flex flex-wrap items-end justify-between gap-3">
            <h2 id="scorecard" className="text-xl font-semibold wide text-ink">Jury Evaluation &amp; Score Card</h2>
            <div>
              <span className="display num text-4xl text-ink">{submission.scores.total}</span>
              <span className="text-sm text-ink-2"> / 50 Points</span>
            </div>
          </div>

          <div className="p-4">
            <span className="cell-label block">Innovation</span>
            <span className="font-bold text-ink num">{submission.scores.innovation} / 10</span>
          </div>
          <div className="p-4">
            <span className="cell-label block">Tools &amp; Tech</span>
            <span className="font-bold text-ink num">{submission.scores.tools_tech ?? submission.scores.ai_prompting} / 20</span>
          </div>
          <div className="p-4">
            <span className="cell-label block">UI &amp; UX</span>
            <span className="font-bold text-ink num">{submission.scores.ui_ux ?? submission.scores.tech_execution} / 10</span>
          </div>
          <div className="p-4">
            <span className="cell-label block">Production Ready</span>
            <span className="font-bold text-ink num">{submission.scores.production_ready ?? submission.scores.presentation} / 10</span>
          </div>

          {submission.scores.feedback && (
            <p className="col-span-full px-5 py-4 text-sm text-ink-2">
              “{submission.scores.feedback}”
            </p>
          )}
        </section>
      )}

      {/* Main Form */}
      <div className="frame bg-paper">
        <div className="p-5 sm:p-6 space-y-5">

          <div>
            <label htmlFor="project-name" className="field-label">Project Name *</label>
            <input
              id="project-name"
              disabled={locked}
              type="text"
              placeholder="e.g. HealthGen AI Triage"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              aria-invalid={invalid(projectName)}
              className="field font-bold"
            />
          </div>

          <div>
            <label htmlFor="problem" className="field-label">Problem Statement *</label>
            <textarea
              id="problem"
              disabled={locked}
              rows={2}
              placeholder="What real-world challenge does your application solve?"
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              aria-invalid={invalid(problemStatement)}
              className="field"
            />
          </div>

          <div>
            <label htmlFor="description" className="field-label">Project Description &amp; Prompt Architecture *</label>
            <textarea
              id="description"
              disabled={locked}
              rows={4}
              placeholder="Describe your technical architecture, models utilized, and prompt engineering strategy..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-invalid={invalid(description)}
              className="field"
            />
          </div>

          <div>
            <label htmlFor="tech" className="field-label">Technologies Used (Comma separated)</label>
            <input
              id="tech"
              disabled={locked}
              type="text"
              placeholder="e.g. Next.js, OpenAI API, LangChain, Tailwind CSS"
              value={technologies}
              onChange={(e) => setTechnologies(e.target.value)}
              className="field"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
            {urlField("github-url", "GitHub Repository URL", "https://github.com/...", githubUrl, setGithubUrl, GitBranch)}
            {urlField("demo-url", "Live Demo URL (Vercel / Netlify / Render)", "https://...", demoUrl, setDemoUrl, Globe)}
            {urlField("slides-url", "Presentation / Slides URL (Google Slides / Canva)", "https://slides...", presentationUrl, setPresentationUrl, Presentation)}
            {urlField("file-url", "Project ZIP / Documentation Link", "Google Drive / Cloud storage link", fileUrl, setFileUrl, FileCode)}
          </div>

        </div>

        <div className="rule-t px-5 py-4 sm:px-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
          {locked ? (
            <p className="text-sm text-ink-2 sm:mr-auto flex items-center gap-2">
              <Lock className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {evaluated ? "Evaluated submissions cannot be changed." : "The submission deadline has passed."}
            </p>
          ) : (
            <>
              <p className="text-xs text-ink-3 sm:mr-auto">
                Final submission needs a GitHub or live demo link.
                {alreadySubmitted ? " You can update it until the deadline." : ""}
              </p>
              {!alreadySubmitted && (
                <button
                  type="button"
                  onClick={() => handleSubmit("draft")}
                  disabled={busy !== null}
                  aria-busy={busy === "draft"}
                  className="btn"
                >
                  {busy === "draft" ? "Saving…" : "Save as Draft"}
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSubmit("submitted")}
                disabled={busy !== null}
                aria-busy={busy === "submitted"}
                className="btn btn-primary"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                <span>
                  {busy === "submitted" ? "Submitting…" : alreadySubmitted ? "Update Submission" : "Submit for Evaluation"}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
