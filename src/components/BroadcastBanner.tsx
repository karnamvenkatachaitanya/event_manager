"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, ExternalLink } from "lucide-react";
import { useStore } from "@/lib/store";
import { parseAnnouncementContent } from "@/lib/announcements";
import AnnouncementPopupCard from "@/components/AnnouncementPopupCard";

export default function BroadcastBanner() {
  // Public/participant state already holds only published announcements; staff state holds all of them.
  const announcements = useStore().announcements.filter((a) => {
    if (!a.published) return false;
    const parsed = parseAnnouncementContent(a.content, a.priority);
    return parsed.styling.showBroadcast !== false;
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [announcements.length]);

  if (dismissed || announcements.length === 0) return null;

  const current = announcements[currentIndex % announcements.length];
  const isUrgent = current.priority === "urgent";
  const parsed = parseAnnouncementContent(current.content, current.priority);

  return (
    <>
      <div className="relative z-50 plane-ink text-white print:hidden" role="status" aria-live="polite">
        <div className="max-w-[1280px] mx-auto pl-4 sm:pl-6 pr-1 sm:pr-3 min-h-10 flex items-center justify-between gap-3">
          <div
            onClick={() => setPopupOpen(true)}
            className="flex items-center gap-2.5 flex-1 min-w-0 py-2 cursor-pointer group"
          >
            <span className="w-2.5 h-2.5 bg-sun shrink-0 animate-pulse" aria-hidden="true" />
            <span className="shrink-0 px-1.5 py-px text-[0.6875rem] font-bold uppercase tracking-[0.08em] border-[1.5px] border-sun text-accent">
              {parsed.styling.badgeText || (isUrgent ? "Live" : "Update")}
            </span>
            <p className="truncate text-sm text-white group-hover:text-accent transition-colors">
              <strong className="font-bold">{current.title}</strong>
              <span className="hidden md:inline text-[#d4d5d8]"> · {parsed.plainText}</span>
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* View Popup Card Button */}
            <button
              type="button"
              onClick={() => setPopupOpen(true)}
              className="px-2.5 py-1 text-xs font-semibold bg-sun/20 hover:bg-sun/30 text-sun border border-sun/40 rounded-sm flex items-center gap-1 transition-all active:scale-95"
              aria-label="View announcement popup card"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">View Announcement</span>
              <span className="sm:hidden">Details</span>
            </button>

            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="w-9 h-9 flex items-center justify-center text-white/80 hover:text-white hover:bg-[#26272b] transition-colors rounded-sm"
              aria-label="Dismiss announcement ticker"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Popup Card */}
      <AnnouncementPopupCard
        announcement={current}
        isOpen={popupOpen}
        onClose={() => setPopupOpen(false)}
      />
    </>
  );
}
