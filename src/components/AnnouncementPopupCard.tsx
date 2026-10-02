"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";
import { Announcement } from "@/lib/types";
import {
  parseAnnouncementContent,
  THEME_STYLES,
  AnnouncementStyling,
} from "@/lib/announcements";

interface AnnouncementPopupCardProps {
  announcement: Announcement | null;
  overrideStyling?: AnnouncementStyling;
  overrideHtml?: string;
  overrideTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  previewMode?: boolean;
  previewDevice?: "desktop" | "mobile";
  onDontShowToday?: () => void;
}

export default function AnnouncementPopupCard({
  announcement,
  overrideStyling,
  overrideHtml,
  overrideTitle,
  isOpen,
  onClose,
  previewMode = false,
  previewDevice = "desktop",
  onDontShowToday,
}: AnnouncementPopupCardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || (!announcement && !overrideHtml && !overrideTitle)) return null;

  const parsed = announcement
    ? parseAnnouncementContent(announcement.content, announcement.priority)
    : null;

  const styling: AnnouncementStyling =
    overrideStyling ||
    parsed?.styling || {
      theme: "paper",
      position: "center",
      showPopup: true,
      badgeText: "Event Update",
    };

  const html = overrideHtml !== undefined ? overrideHtml : (parsed?.html || "");
  const title =
    overrideTitle !== undefined
      ? overrideTitle
      : (announcement?.title || "Event Announcement");
  const theme = THEME_STYLES[styling.theme] || THEME_STYLES.paper;
  const isUrgent = announcement?.priority === "urgent";

  const cardContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="popup-card-title"
      className={`relative w-full overflow-hidden rounded-[22px] border shadow-2xl transition-all duration-300 flex flex-col ${theme.cardBg} ${theme.borderColor}`}
      style={{
        maxHeight: previewMode ? "100%" : "calc(88vh - 2rem)",
      }}
    >
      {/* Top Banner Accent Line */}
      <div className={`h-1.5 w-full ${theme.accentLine}`} />

      {/* Header Bar */}
      <div className="p-4 sm:p-5 flex items-center justify-between gap-3 border-b border-inherit/15 shrink-0">
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <span
            className={`px-2.5 py-0.5 text-xs font-mono font-bold uppercase tracking-wider rounded-full border ${theme.badgeBg}`}
          >
            {styling.badgeText || (isUrgent ? "Urgent Alert" : "Live Announcement")}
          </span>
          <span className="cell-label hidden sm:inline text-inherit opacity-70">
            · {announcement?.category || "Official Broadcast"}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-full border border-inherit/25 flex items-center justify-center opacity-75 hover:opacity-100 hover:bg-inherit/10 transition-all shrink-0 cursor-pointer"
          aria-label="Close announcement popup"
        >
          <X className="w-4 h-4 text-inherit" aria-hidden="true" />
        </button>
      </div>

      {/* Optional Inset Hero Image */}
      {styling.imageUrl && styling.imageUrl.trim() !== "" && (
        <div className="w-full px-4 sm:px-6 pt-4 shrink-0">
          <div className="w-full h-40 sm:h-52 overflow-hidden rounded-xl border border-inherit/20 bg-inherit/5 relative shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={styling.imageUrl}
              alt={title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLElement).parentElement!.style.display = "none";
              }}
            />
          </div>
        </div>
      )}

      {/* Scrollable Content Body */}
      <div className="p-5 sm:p-6 overflow-y-auto space-y-3 leading-relaxed flex-1">
        <h3
          id="popup-card-title"
          className="wide text-lg sm:text-2xl font-bold tracking-tight text-inherit leading-snug"
        >
          {title}
        </h3>

        {/* HTML Template Render Container */}
        {html ? (
          <div
            className="announcement-html-content text-sm sm:text-base space-y-3"
            style={{ color: "inherit" }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="text-sm opacity-80">No announcement details provided.</p>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 sm:p-5 bg-inherit/5 border-t border-inherit/15 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {onDontShowToday && (
            <button
              type="button"
              onClick={onDontShowToday}
              className="text-xs opacity-75 hover:opacity-100 underline transition-opacity cursor-pointer"
            >
              Don&apos;t show again today
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {styling.ctaText && styling.ctaLink && (
            <Link
              href={styling.ctaLink}
              onClick={onClose}
              className={`btn btn-sm ${theme.ctaBtnClass} flex items-center gap-1.5`}
            >
              <span>{styling.ctaText}</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}

          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  // If in admin preview mode inside a container
  if (previewMode) {
    const isMobile = previewDevice === "mobile";
    return (
      <div
        className={`mx-auto transition-all duration-300 ${
          isMobile
            ? "max-w-[360px] rounded-[32px] shadow-2xl p-2.5 bg-slate-900 border-4 border-slate-700"
            : "max-w-xl w-full"
        }`}
      >
        {isMobile && (
          <div className="h-4 w-28 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-slate-700" />
          </div>
        )}
        {cardContent}
      </div>
    );
  }

  if (!mounted) return null;

  // Floating Corner Card Position
  if (styling.position === "bottom-right") {
    return (
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-3 sm:right-5 lg:bottom-6 lg:right-6 z-50 max-w-sm sm:max-w-md w-[calc(100vw-1.5rem)] animate-in fade-in slide-in-from-bottom-5 duration-300">
        {cardContent}
      </div>
    );
  }

  // Top Position
  if (styling.position === "top") {
    return (
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[calc(100vw-1.5rem)] animate-in fade-in slide-in-from-top-5 duration-300">
        {cardContent}
      </div>
    );
  }

  // Default Center Modal with Backdrop Dim
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pb-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 max-w-lg w-full max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        {cardContent}
      </div>
    </div>
  );
}
