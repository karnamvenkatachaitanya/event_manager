"use client";

import React, { useState } from "react";
import {
  Plus,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Pencil,
  Trash2,
  CheckCircle2,
  Sparkles,
  Eye,
  Smartphone,
  Monitor,
  Image as ImageIcon,
  Link as LinkIcon,
  Tag,
  Layout,
  Code2,
  Info,
  X,
} from "lucide-react";
import {
  useStore,
  saveAnnouncement,
  setAnnouncementPublished,
  deleteAnnouncement,
} from "@/lib/store";
import { Announcement } from "@/lib/types";
import {
  AnnouncementStyling,
  AnnouncementTheme,
  AnnouncementPosition,
  DEFAULT_ANNOUNCEMENT_STYLING,
  THEME_STYLES,
  HTML_TEMPLATE_PRESETS,
  parseAnnouncementContent,
  serializeAnnouncementContent,
} from "@/lib/announcements";
import AnnouncementPopupCard from "@/components/AnnouncementPopupCard";

type Draft = {
  id?: string;
  title: string;
  content: string;
  priority: Announcement["priority"];
  category: Announcement["category"];
  published: boolean;
  styling: AnnouncementStyling;
};

const emptyDraft = (): Draft => ({
  title: "",
  content: "",
  priority: "normal",
  category: "general",
  published: true,
  styling: { ...DEFAULT_ANNOUNCEMENT_STYLING, showPopup: true, showBroadcast: true },
});

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      });
};

export default function AdminAnnouncementsPage() {
  const { announcements } = useStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // Responsive Live Preview State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewItem, setPreviewItem] = useState<Announcement | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    setNotice(null);
    try {
      await fn();
      setNotice({ ok: true, text: success });
      return true;
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Request failed." });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const fullContent = serializeAnnouncementContent(draft.content, draft.styling);
    const ok = await run(
      "save",
      () =>
        saveAnnouncement({
          ...(draft.id ? { id: draft.id } : {}),
          title: draft.title.trim(),
          content: fullContent,
          priority: draft.priority,
          category: draft.category,
          published: draft.published,
        }),
      draft.id
        ? "Announcement updated successfully."
        : draft.published
        ? "Announcement published successfully."
        : "Announcement saved as draft."
    );
    if (ok) setDraft(null);
  };

  const handleEdit = (item: Announcement) => {
    const parsed = parseAnnouncementContent(item.content, item.priority);
    setDraft({
      id: item.id,
      title: item.title,
      content: parsed.html,
      priority: item.priority,
      category: item.category,
      published: item.published,
      styling: {
        ...parsed.styling,
        showPopup: parsed.styling.showPopup,
        showBroadcast: parsed.styling.showBroadcast !== false,
      },
    });
  };

  // Individual toggle for Home Page Popup Modal
  const handleTogglePopup = async (item: Announcement) => {
    const parsed = parseAnnouncementContent(item.content, item.priority);
    const isCurrentlyActive = Boolean(item.published && parsed.styling.showPopup);
    const nextPopupState = !isCurrentlyActive;
    const currentBroadcast = parsed.styling.showBroadcast !== false;

    const newStyling: AnnouncementStyling = {
      ...parsed.styling,
      showPopup: nextPopupState,
      showBroadcast: currentBroadcast,
    };
    const newContent = serializeAnnouncementContent(parsed.html, newStyling);
    const newPublished = nextPopupState || (currentBroadcast && item.published);

    await run(
      `popup:${item.id}`,
      () =>
        saveAnnouncement({
          id: item.id,
          title: item.title,
          content: newContent,
          priority: item.priority,
          category: item.category,
          published: newPublished,
        }),
      nextPopupState ? "Home Page Popup activated." : "Home Page Popup disabled."
    );
  };

  // Individual toggle for Live Ticker Broadcasting
  const handleToggleBroadcast = async (item: Announcement) => {
    const parsed = parseAnnouncementContent(item.content, item.priority);
    const isCurrentlyActive = Boolean(item.published && parsed.styling.showBroadcast !== false);
    const nextBroadcastState = !isCurrentlyActive;
    const currentPopup = Boolean(parsed.styling.showPopup);

    const newStyling: AnnouncementStyling = {
      ...parsed.styling,
      showPopup: currentPopup,
      showBroadcast: nextBroadcastState,
    };
    const newContent = serializeAnnouncementContent(parsed.html, newStyling);
    const newPublished = nextBroadcastState || (currentPopup && item.published);

    await run(
      `broadcast:${item.id}`,
      () =>
        saveAnnouncement({
          id: item.id,
          title: item.title,
          content: newContent,
          priority: item.priority,
          category: item.category,
          published: newPublished,
        }),
      nextBroadcastState ? "Live Ticker Broadcasting activated." : "Live Ticker Broadcasting disabled."
    );
  };

  const handleDelete = (item: Announcement) => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    run(`del:${item.id}`, () => deleteAnnouncement(item.id), "Announcement deleted.");
  };

  const handleOpenDraftPreview = () => {
    setPreviewItem(null);
    setPreviewOpen(true);
  };

  const handleOpenItemPreview = (item: Announcement) => {
    setPreviewItem(item);
    setPreviewOpen(true);
  };

  const insertSnippet = (snippet: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      content: draft.content ? `${draft.content}\n${snippet}` : snippet,
    });
  };

  const applyTemplatePreset = (preset: (typeof HTML_TEMPLATE_PRESETS)[0]) => {
    if (!draft) return;
    setDraft({
      ...draft,
      content: preset.html,
      styling: {
        ...draft.styling,
        ...preset.styling,
      },
      title: draft.title || preset.name.replace(/^[^\s]+\s*/, ""),
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <header className="frame bg-paper p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="page-title text-ink">Event Announcements &amp; Live Ticker</h1>
            <span className="tag tag-ok">Popup Card Enabled</span>
          </div>
          <p className="mt-2 text-sm text-ink-2">
            Publish live announcements, customize popup card styling with HTML templates and images, and preview live on mobile and desktop.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setDraft(draft && !draft.id ? null : emptyDraft())}
            aria-expanded={!!draft && !draft.id}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>New Announcement</span>
          </button>
        </div>
      </header>

      {notice && (
        <div
          role={notice.ok ? "status" : "alert"}
          className={`frame p-4 text-sm flex items-center gap-2 ${
            notice.ok ? "bg-ok-soft text-ink" : "bg-alert-soft text-alert font-semibold"
          }`}
        >
          {notice.ok && <CheckCircle2 className="w-4 h-4 text-ok flex-shrink-0" aria-hidden="true" />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Announcement Creation / Edit Form */}
      {draft && (
        <form onSubmit={handleSave} className="frame bg-paper space-y-6">
          <div className="px-5 sm:px-6 py-4 rule-b flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold wide text-ink">
                {draft.id ? "Edit Announcement & Popup Card" : "Create Broadcast & Popup Card"}
              </h2>
              <p className="text-xs text-ink-3 mt-0.5">
                Customize appearance, theme colors, HTML template, and image banner.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenDraftPreview}
              className="btn btn-sm btn-primary flex items-center gap-1.5"
            >
              <Eye className="w-4 h-4" aria-hidden="true" />
              <span>Preview Popup Card</span>
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-6">
            {/* Row 1: Headline, Priority, Category */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-6">
                <label htmlFor="ann-title" className="field-label">
                  Headline Title *
                </label>
                <input
                  id="ann-title"
                  type="text"
                  required
                  maxLength={150}
                  placeholder="e.g. Build Challenge Kickoff & Sandbox Distribution"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="field"
                />
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="ann-priority" className="field-label">
                  Priority
                </label>
                <select
                  id="ann-priority"
                  value={draft.priority}
                  onChange={(e) =>
                    setDraft({ ...draft, priority: e.target.value as Announcement["priority"] })
                  }
                  className="field"
                >
                  <option value="normal">Normal (Live Update)</option>
                  <option value="urgent">Urgent / Alert (High Priority)</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="ann-category" className="field-label">
                  Category
                </label>
                <select
                  id="ann-category"
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value as Announcement["category"] })
                  }
                  className="field"
                >
                  <option value="general">General</option>
                  <option value="schedule">Schedule</option>
                  <option value="challenge">Challenge</option>
                  <option value="wifi">Wi-Fi &amp; Tech</option>
                  <option value="certificate">Certificates</option>
                </select>
              </div>
            </div>

            {/* Styling Customization Section */}
            <div className="p-4 sm:p-5 border-2 border-line bg-field-2 space-y-4 rounded-sm">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Layout className="w-4 h-4 text-accent" aria-hidden="true" />
                  <span className="font-bold text-sm text-ink">Popup Card Styling &amp; Display</span>
                </div>
                <span className="text-xs text-ink-3">Live custom themes for Home Page popup</span>
              </div>

              {/* Theme Palette Buttons */}
              <div>
                <label className="field-label block mb-2">Card Theme Palette</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {(Object.keys(THEME_STYLES) as AnnouncementTheme[]).map((thmKey) => {
                    const thm = THEME_STYLES[thmKey];
                    const selected = draft.styling.theme === thmKey;
                    return (
                      <button
                        key={thmKey}
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            styling: { ...draft.styling, theme: thmKey },
                          })
                        }
                        className={`p-2.5 rounded text-left border transition-all flex flex-col justify-between gap-2 ${
                          selected
                            ? "border-accent ring-2 ring-accent bg-paper shadow-sm"
                            : "border-line bg-paper hover:border-ink-3"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`w-4 h-4 rounded-full border ${thm.previewRing}`}
                          />
                          {selected && (
                            <span className="text-[10px] font-bold text-accent">ACTIVE</span>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-ink leading-tight">{thm.name}</div>
                          <div className="text-[10px] text-ink-3 line-clamp-1 mt-0.5">
                            {thm.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Popup Position & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="ann-position" className="field-label">
                    Popup Position on Home Page
                  </label>
                  <select
                    id="ann-position"
                    value={draft.styling.position}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        styling: {
                          ...draft.styling,
                          position: e.target.value as AnnouncementPosition,
                        },
                      })
                    }
                    className="field text-sm"
                  >
                    <option value="center">Center Modal (Dialog Backdrop)</option>
                    <option value="bottom-right">Bottom-Right Floating Card</option>
                    <option value="top">Top Slide-in Card</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ann-badge" className="field-label">
                    Custom Badge Label
                  </label>
                  <input
                    id="ann-badge"
                    type="text"
                    maxLength={30}
                    placeholder="e.g. 🚀 Workshop Kickoff"
                    value={draft.styling.badgeText || ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        styling: { ...draft.styling, badgeText: e.target.value },
                      })
                    }
                    className="field text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="ann-image" className="field-label">
                    Header Banner Image URL (Optional)
                  </label>
                  <input
                    id="ann-image"
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={draft.styling.imageUrl || ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        styling: { ...draft.styling, imageUrl: e.target.value },
                      })
                    }
                    className="field text-sm"
                  />
                </div>
              </div>

              {/* CTA Action Button Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label htmlFor="ann-cta-text" className="field-label">
                    Call To Action Button Label (Optional)
                  </label>
                  <input
                    id="ann-cta-text"
                    type="text"
                    placeholder="e.g. View Full Schedule or Open Discord"
                    value={draft.styling.ctaText || ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        styling: { ...draft.styling, ctaText: e.target.value },
                      })
                    }
                    className="field text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="ann-cta-link" className="field-label">
                    Button Target URL / Route
                  </label>
                  <input
                    id="ann-cta-link"
                    type="text"
                    placeholder="e.g. /#schedule, /dashboard, or https://..."
                    value={draft.styling.ctaLink || ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        styling: { ...draft.styling, ctaLink: e.target.value },
                      })
                    }
                    className="field text-sm"
                  />
                </div>
              </div>
            </div>

            {/* HTML Template & Content Section */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label htmlFor="ann-content" className="field-label">
                    Announcement Details &amp; HTML Template *
                  </label>
                  <span className="text-xs text-ink-3">
                    Supports full HTML templates, images, links, tables, and styled divs.
                  </span>
                </div>

                {/* Preset Templates Quick Select */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-ink-2">Insert Template:</span>
                  {HTML_TEMPLATE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyTemplatePreset(preset)}
                      className="px-2 py-1 text-xs font-semibold border border-line bg-paper hover:bg-paper-2 rounded text-ink transition-colors"
                      title={preset.description}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick HTML Snippet Helper Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-field-2 border border-line rounded-sm text-xs font-mono">
                <span className="text-[11px] font-sans font-bold text-ink-3 mr-1">Quick Insert:</span>
                <button
                  type="button"
                  onClick={() =>
                    insertSnippet(
                      `<img src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1000&auto=format&fit=crop&q=80" alt="Banner" class="w-full h-44 object-cover rounded-sm border border-white/10 my-2" />`
                    )
                  }
                  className="px-2 py-1 bg-paper hover:bg-paper-2 border border-line rounded flex items-center gap-1 text-ink"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-accent" />
                  <span>&lt;img&gt; Image</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertSnippet(
                      `<a href="/dashboard" class="underline font-bold text-sky-400 hover:text-sky-300">Click here to learn more &rarr;</a>`
                    )
                  }
                  className="px-2 py-1 bg-paper hover:bg-paper-2 border border-line rounded flex items-center gap-1 text-ink"
                >
                  <LinkIcon className="w-3.5 h-3.5 text-accent" />
                  <span>&lt;a&gt; Link</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertSnippet(
                      `<div class="p-3 rounded-sm bg-white/5 border border-white/10 text-xs"><strong>Notice:</strong> High-speed Wi-Fi network SSID: NBKRIST-AI</div>`
                    )
                  }
                  className="px-2 py-1 bg-paper hover:bg-paper-2 border border-line rounded flex items-center gap-1 text-ink"
                >
                  <Tag className="w-3.5 h-3.5 text-accent" />
                  <span>Callout Box</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertSnippet(
                      `<span class="px-2 py-0.5 rounded font-mono font-bold text-xs bg-white/10 text-accent">1:30 PM Cutoff</span>`
                    )
                  }
                  className="px-2 py-1 bg-paper hover:bg-paper-2 border border-line rounded flex items-center gap-1 text-ink"
                >
                  <Code2 className="w-3.5 h-3.5 text-accent" />
                  <span>Badge Tag</span>
                </button>
              </div>

              {/* Main Content Textarea */}
              <textarea
                id="ann-content"
                rows={7}
                required
                maxLength={25000}
                placeholder="Enter announcement message or paste HTML template..."
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                className="field font-mono text-xs sm:text-sm leading-relaxed"
              />
            </div>

            {/* Distribution Channels: Home Popup & Live Ticker */}
            <div className="p-4 bg-field-2 border border-line rounded-lg space-y-3">
              <span className="cell-label block text-ink-3">Distribution Channels</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-start gap-3 p-3 bg-paper border border-line rounded-md text-sm font-semibold text-ink cursor-pointer hover:border-accent transition-colors">
                  <input
                    type="checkbox"
                    checked={draft.styling.showPopup}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        styling: { ...draft.styling, showPopup: e.target.checked },
                      })
                    }
                    className="w-5 h-5 accent-accent mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="block font-semibold">Home Page Popup Modal</span>
                    <span className="block text-xs font-normal text-ink-2 mt-0.5">
                      Displays full card modal to visitors opening the home page
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-paper border border-line rounded-md text-sm font-semibold text-ink cursor-pointer hover:border-ok transition-colors">
                  <input
                    type="checkbox"
                    checked={draft.styling.showBroadcast !== false}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        styling: { ...draft.styling, showBroadcast: e.target.checked },
                      })
                    }
                    className="w-5 h-5 accent-ok mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="block font-semibold">Live Ticker Broadcast</span>
                    <span className="block text-xs font-normal text-ink-2 mt-0.5">
                      Broadcasts single-line ticker at top of website
                    </span>
                  </div>
                </label>
              </div>

              <label className="inline-flex items-center gap-2.5 pt-1 text-xs font-semibold text-ink-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.published}
                  onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
                  className="w-4 h-4 accent-sky cursor-pointer"
                />
                <span>Active &amp; Published (if unchecked, saved as inactive draft)</span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 rule-t bg-field">
            <button
              type="button"
              onClick={handleOpenDraftPreview}
              className="btn btn-sm flex items-center gap-1.5"
            >
              <Eye className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Preview Popup Card</span>
            </button>

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setDraft(null)} className="btn">
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy === "save"}
                aria-busy={busy === "save"}
                className="btn btn-primary"
              >
                {busy === "save"
                  ? "Saving…"
                  : draft.id
                  ? "Save Changes"
                  : draft.published
                  ? "Broadcast Now"
                  : "Save Draft"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Announcements List */}
      <section className="frame bg-paper" aria-labelledby="announcements-heading">
        <div className="px-5 py-4 rule-b flex items-center justify-between gap-3">
          <h2 id="announcements-heading" className="text-base font-semibold wide text-ink">
            Active Broadcasts &amp; Popup Cards ({announcements.length})
          </h2>
          <span className="text-xs text-ink-3">Live Sync with Home Page &amp; Ticker</span>
        </div>

        <ul className="divide-y divide-rule">
          {announcements.map((item) => {
            const parsed = parseAnnouncementContent(item.content, item.priority);
            const theme = THEME_STYLES[parsed.styling.theme] || THEME_STYLES.paper;
            const isPopupActive = Boolean(item.published && parsed.styling.showPopup);
            const isBroadcastActive = Boolean(item.published && parsed.styling.showBroadcast !== false);

            return (
              <li
                key={item.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-paper-2 transition-colors"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.priority === "urgent" ? (
                      <span className="tag tag-alert flex items-center gap-1 font-bold">
                        <AlertCircle className="w-3 h-3" aria-hidden="true" />
                        {item.priority}
                      </span>
                    ) : (
                      <span className="tag">{item.priority}</span>
                    )}

                    <span className="tag tag-info">{item.category}</span>

                    {/* Theme badge */}
                    <span className="tag flex items-center gap-1 font-mono text-[11px]">
                      <span className={`w-2 h-2 rounded-full ${theme.previewRing}`} />
                      {theme.name}
                    </span>

                    {/* Home Popup Badge */}
                    <span
                      className={`tag ${
                        isPopupActive ? "tag-ok font-semibold" : "opacity-60"
                      }`}
                    >
                      {isPopupActive ? "Home Popup: ON" : "Home Popup: OFF"}
                    </span>

                    {/* Broadcasting Badge */}
                    <span
                      className={`tag ${
                        isBroadcastActive ? "tag-ok font-semibold" : "opacity-60"
                      }`}
                    >
                      {isBroadcastActive ? "Broadcasting: ON" : "Broadcasting: OFF"}
                    </span>

                    <span className="font-mono text-xs text-ink-3">
                      {formatDate(item.created_at)}
                    </span>
                  </div>

                  <h3 className="font-semibold text-ink text-base">{item.title}</h3>
                  <p className="text-sm text-ink-2 line-clamp-2">{parsed.plainText}</p>
                </div>

                {/* Card Actions with Individual Buttons */}
                <div className="flex flex-wrap items-center gap-2 flex-shrink-0 self-start sm:self-auto">
                  {/* Preview Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenItemPreview(item)}
                    className="btn btn-sm min-h-11 flex items-center gap-1.5"
                    aria-label={`Preview popup for ${item.title}`}
                  >
                    <Eye className="w-4 h-4 text-accent" aria-hidden="true" />
                    <span>Preview</span>
                  </button>

                  {/* Individual Home Popup Button */}
                  <button
                    type="button"
                    onClick={() => handleTogglePopup(item)}
                    disabled={busy === `popup:${item.id}`}
                    aria-busy={busy === `popup:${item.id}`}
                    aria-pressed={isPopupActive}
                    className={`btn btn-sm min-h-11 flex items-center gap-1.5 ${
                      isPopupActive
                        ? "border-accent/40 bg-accent/10 text-accent font-semibold"
                        : "text-ink-2 hover:text-ink"
                    }`}
                    title={
                      isPopupActive
                        ? "Click to disable Home Page Popup"
                        : "Click to enable Home Page Popup"
                    }
                    aria-label={`Toggle Home Popup for ${item.title}`}
                  >
                    {isPopupActive ? (
                      <ToggleRight className="w-5 h-5 text-accent" aria-hidden="true" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-ink-3" aria-hidden="true" />
                    )}
                    <span>Home Popup</span>
                  </button>

                  {/* Individual Broadcasting Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleBroadcast(item)}
                    disabled={busy === `broadcast:${item.id}`}
                    aria-busy={busy === `broadcast:${item.id}`}
                    aria-pressed={isBroadcastActive}
                    className={`btn btn-sm min-h-11 flex items-center gap-1.5 ${
                      isBroadcastActive
                        ? "border-ok/40 bg-ok/10 text-ok font-semibold"
                        : "text-ink-2 hover:text-ink"
                    }`}
                    title={
                      isBroadcastActive
                        ? "Click to disable Live Ticker Broadcast"
                        : "Click to enable Live Ticker Broadcast"
                    }
                    aria-label={`Toggle Broadcasting for ${item.title}`}
                  >
                    {isBroadcastActive ? (
                      <ToggleRight className="w-5 h-5 text-ok" aria-hidden="true" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-ink-3" aria-hidden="true" />
                    )}
                    <span>Broadcasting</span>
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => handleEdit(item)}
                    className="btn btn-sm min-h-11"
                    aria-label={`Edit ${item.title}`}
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                    <span>Edit</span>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={busy === `del:${item.id}`}
                    aria-busy={busy === `del:${item.id}`}
                    className="btn btn-sm btn-danger min-h-11"
                    aria-label={`Delete ${item.title}`}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                </div>
              </li>
            );
          })}
          {announcements.length === 0 && (
            <li className="p-8 text-center text-sm text-ink-2">
              No announcements created yet. Click &quot;New Announcement&quot; to publish your first broadcast and popup card.
            </li>
          )}
        </ul>
      </section>

      {/* Responsive Live Preview Modal */}
      {previewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            className="fixed inset-0"
            onClick={() => setPreviewOpen(false)}
            aria-hidden="true"
          />

          <div className="relative z-10 w-full max-w-4xl bg-paper border-2 border-line shadow-2xl rounded-sm flex flex-col max-h-[92vh] overflow-hidden">
            {/* Preview Modal Header */}
            <div className="p-4 sm:p-5 rule-b bg-field-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-bold text-ink">
                    Popup Card Responsive Preview
                  </h3>
                  <p className="text-xs text-ink-3">
                    Testing appearance across mobile and desktop devices.
                  </p>
                </div>
              </div>

              {/* Viewport Switcher */}
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-sm p-1 bg-paper border border-line">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                      previewDevice === "desktop"
                        ? "bg-accent text-white"
                        : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Desktop (600px)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                      previewDevice === "mobile"
                        ? "bg-accent text-white"
                        : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Mobile (360px)</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="p-2 text-ink-2 hover:text-ink rounded hover:bg-paper transition-colors"
                  aria-label="Close preview"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Preview Viewport Canvas */}
            <div className="p-4 sm:p-8 overflow-y-auto bg-slate-950/40 flex items-center justify-center min-h-[350px]">
              {previewItem ? (
                <AnnouncementPopupCard
                  announcement={previewItem}
                  isOpen={true}
                  onClose={() => setPreviewOpen(false)}
                  previewMode={true}
                  previewDevice={previewDevice}
                />
              ) : draft ? (
                <AnnouncementPopupCard
                  announcement={null}
                  overrideTitle={draft.title || "Announcement Title"}
                  overrideHtml={draft.content || "<p>Your announcement body HTML will appear here.</p>"}
                  overrideStyling={draft.styling}
                  isOpen={true}
                  onClose={() => setPreviewOpen(false)}
                  previewMode={true}
                  previewDevice={previewDevice}
                />
              ) : null}
            </div>

            {/* Preview Footer Info */}
            <div className="p-3 sm:p-4 rule-t bg-field text-xs text-ink-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-accent" aria-hidden="true" />
                <span>
                  This preview renders actual HTML tags, image links, styling themes, and button actions.
                </span>
              </span>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="btn btn-sm"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
