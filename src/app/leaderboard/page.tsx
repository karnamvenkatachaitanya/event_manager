"use client";

import React from "react";
import { Trophy } from "lucide-react";
import { isStoreReady, useStore } from "@/lib/store";

const PUBLIC_STATUSES = new Set(["submitted", "under_review", "evaluated"]);

export default function LeaderboardPage() {
  const store = useStore();
  const ready = isStoreReady();

  // Only submitted/evaluated entries are public; scored entries first (by total), then unscored.
  // Staff sessions also receive drafts and private links in the cache, so filter and never render links here.
  const submissions = store.submissions
    .filter((s) => PUBLIC_STATUSES.has(s.status))
    .sort((a, b) => (b.scores?.total ?? -1) - (a.scores?.total ?? -1));

  // Competition ranking ("1, 2, 2, 4"); unscored entries have no rank.
  const ranks = new Map<string, number>();
  submissions.forEach((s, i) => {
    if (!s.scores) return;
    const prev = submissions[i - 1];
    ranks.set(s.id, prev?.scores && prev.scores.total === s.scores.total ? ranks.get(prev.id)! : i + 1);
  });

  return (
    <div className="min-h-screen py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header: the identity plane */}
        <header className="plane-navy frame p-6 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="page-title text-white text-3xl sm:text-4xl">Build Challenge Leaderboard</h1>
            <p className="mt-3 text-sm sm:text-base text-[rgba(255,255,255,0.7)] max-w-2xl">
              Prompt to Production – Paytm AI Workshop. Scores evaluated across Innovation, AI Prompting, Tech
              Execution, and Live Defense.
            </p>
          </div>
          <p className="flex items-center gap-2 text-sm font-bold text-white flex-shrink-0">
            <Trophy className="w-5 h-5" aria-hidden="true" />
            <span>Live Hackathon Standings</span>
          </p>
        </header>

        {/* Detailed Full Standings Table */}
        <section className="frame bg-paper" aria-labelledby="standings-heading">
          <div className="px-5 py-4 rule-b flex items-center justify-between gap-3">
            <h2 id="standings-heading" className="text-xl font-semibold wide text-ink">
              Full Challenge Standings
            </h2>
            <span className="font-mono text-xs text-ink-3">Live Sync</span>
          </div>

          <div className="overflow-x-auto">
            <table className="table-planes">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team Name</th>
                  <th>Project Title</th>
                  <th className="text-right">Innovation (10)</th>
                  <th className="text-right">Tools &amp; Tech (20)</th>
                  <th className="text-right">UI &amp; UX (10)</th>
                  <th className="text-right">Production Ready (10)</th>
                  <th className="text-right">Total Score (50)</th>
                </tr>
              </thead>
              <tbody>
                {!ready && (
                  <tr>
                    <td colSpan={8} className="text-center text-ink-2 py-8" aria-busy="true">
                      Loading standings...
                    </td>
                  </tr>
                )}
                {ready && submissions.map((sub) => (
                  <tr key={sub.id}>
                    <td className="num font-semibold text-ink">{ranks.has(sub.id) ? `#${ranks.get(sub.id)}` : "-"}</td>
                    <td className="font-bold text-ink whitespace-nowrap">{sub.team_name}</td>
                    <td className="text-ink-2">{sub.project_name}</td>
                    <td className="num text-right text-ink-2">{sub.scores?.innovation ?? "-"}</td>
                    <td className="num text-right text-ink-2">{sub.scores?.tools_tech ?? sub.scores?.ai_prompting ?? "-"}</td>
                    <td className="num text-right text-ink-2">{sub.scores?.ui_ux ?? sub.scores?.tech_execution ?? "-"}</td>
                    <td className="num text-right text-ink-2">{sub.scores?.production_ready ?? sub.scores?.presentation ?? "-"}</td>
                    <td className="text-right">
                      {sub.scores ? (
                        <span className="num text-base font-semibold text-accent">{sub.scores.total}</span>
                      ) : (
                        <span className="tag tag-pending">Under Review</span>
                      )}
                    </td>
                  </tr>
                ))}
                {ready && submissions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-ink-2 py-8">
                      No projects have been submitted yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
