export type AnnouncementTheme =
  | "paper"
  | "sun"
  | "ink"
  | "paytm"
  | "ok"
  | "alert";

export type AnnouncementPosition = "center" | "bottom-right" | "top";

export interface AnnouncementStyling {
  theme: AnnouncementTheme;
  position: AnnouncementPosition;
  imageUrl?: string;
  ctaText?: string;
  ctaLink?: string;
  badgeText?: string;
  showPopup: boolean;
  showBroadcast?: boolean;
}

export interface ParsedAnnouncement {
  styling: AnnouncementStyling;
  html: string;
  plainText: string;
}

const CONFIG_REGEX = /<!--popup-config:([\s\S]*?)-->/;

export const DEFAULT_ANNOUNCEMENT_STYLING: AnnouncementStyling = {
  theme: "paper",
  position: "center",
  showPopup: true,
  showBroadcast: true,
  badgeText: "Event Update",
};

export const THEME_STYLES: Record<
  AnnouncementTheme,
  {
    name: string;
    description: string;
    cardBg: string;
    textColor: string;
    accentColor: string;
    badgeBg: string;
    borderColor: string;
    ctaBtnClass: string;
    accentLine: string;
    previewRing: string;
  }
> = {
  paper: {
    name: "Editorial Paper (Default)",
    description: "Matches the website's crisp white cards and warm dark ink",
    cardBg: "bg-paper text-ink",
    textColor: "text-ink",
    accentColor: "text-accent",
    badgeBg: "bg-field-2 text-ink-2 border-line",
    borderColor: "border-line",
    ctaBtnClass: "btn-primary",
    accentLine: "bg-gradient-to-r from-sun via-amber-400 to-[#111113]",
    previewRing: "bg-paper border-ink",
  },
  sun: {
    name: "Paytm Gold & Amber",
    description: "Matches the hero section & 1st place gold podium",
    cardBg: "bg-sun text-ink",
    textColor: "text-ink",
    accentColor: "text-[#7a4a12]",
    badgeBg: "bg-[#7a4a12]/15 text-[#7a4a12] border-[#7a4a12]/30",
    borderColor: "border-[#f1cf98]",
    ctaBtnClass: "btn-primary",
    accentLine: "bg-[#7a4a12]",
    previewRing: "bg-sun border-[#7a4a12]",
  },
  ink: {
    name: "Midnight Black",
    description: "Dark editorial card matching the top navigation bar",
    cardBg: "bg-[#111113] text-white",
    textColor: "text-white",
    accentColor: "text-sun",
    badgeBg: "bg-white/10 text-white border-white/20",
    borderColor: "border-neutral-800",
    ctaBtnClass: "bg-sun hover:bg-[#f3d49e] text-ink font-semibold border-none shadow-md",
    accentLine: "bg-sun",
    previewRing: "bg-[#111113] border-sun",
  },
  paytm: {
    name: "Paytm Corporate Navy",
    description: "Paytm signature deep blue with electric sky blue trim",
    cardBg: "bg-[#002e6e] text-white",
    textColor: "text-white",
    accentColor: "text-[#00baf2]",
    badgeBg: "bg-[#00baf2]/20 text-[#00baf2] border-[#00baf2]/40",
    borderColor: "border-[#00baf2]/30",
    ctaBtnClass: "bg-[#00baf2] hover:bg-[#009fd0] text-[#002e6e] font-bold border-none shadow-md",
    accentLine: "bg-[#00baf2]",
    previewRing: "bg-[#002e6e] border-[#00baf2]",
  },
  ok: {
    name: "Campus Emerald",
    description: "Soft mint and verified green for achievements and confirm notes",
    cardBg: "bg-[#f7fbf8] text-ink",
    textColor: "text-ink",
    accentColor: "text-[#15803d]",
    badgeBg: "bg-ok-soft text-ok border-ok/25",
    borderColor: "border-[#bbf7d0]",
    ctaBtnClass: "bg-[#15803d] hover:bg-[#166534] text-white font-medium border-none shadow-sm",
    accentLine: "bg-[#15803d]",
    previewRing: "bg-[#15803d] border-[#bbf7d0]",
  },
  alert: {
    name: "Urgent Crimson",
    description: "Soft alert red for urgent schedule updates and critical alerts",
    cardBg: "bg-[#fff7f7] text-ink",
    textColor: "text-ink",
    accentColor: "text-[#c62828]",
    badgeBg: "bg-alert-soft text-alert border-alert/25",
    borderColor: "border-[#fecaca]",
    ctaBtnClass: "bg-[#c62828] hover:bg-[#b91c1c] text-white font-medium border-none shadow-sm",
    accentLine: "bg-[#c62828]",
    previewRing: "bg-[#c62828] border-[#fecaca]",
  },
};

export const HTML_TEMPLATE_PRESETS = [
  {
    id: "welcome",
    name: "🚀 Event Kickoff & Details",
    description: "Event highlights, venue, session schedule, and credentials",
    html: `<div class="space-y-3.5">
  <div class="p-3.5 rounded-xl bg-field border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
    <div>
      <span class="cell-label block text-ink-3">Event Date & Venue</span>
      <strong class="text-sm font-semibold text-ink">Wednesday, 30 Sep 2026 · Auditorium A, EEE Block</strong>
    </div>
    <span class="tag tag-ok self-start sm:self-auto font-mono text-xs">Confirmed Event</span>
  </div>

  <p class="text-sm text-ink-2 leading-relaxed">
    Welcome to <strong>Prompt to Production</strong>: A hands-on, fast-paced GenAI workshop and hackathon. Join 50+ student developer teams building real-world AI applications.
  </p>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
    <div class="p-3 rounded-lg bg-field border border-line">
      <span class="cell-label block text-ink-3 mb-1">Morning Session</span>
      <span class="font-bold text-ink text-sm">9:00 AM – 1:30 PM</span>
      <p class="text-ink-2 mt-0.5">Foundations, prompt chaining & API sandboxes</p>
    </div>
    <div class="p-3 rounded-lg bg-field border border-line">
      <span class="cell-label block text-ink-3 mb-1">Build Challenge</span>
      <span class="font-bold text-accent text-sm">1:30 PM – 4:00 PM</span>
      <p class="text-ink-2 mt-0.5">Live hackathon, judging & leaderboard reveal</p>
    </div>
  </div>

  <div class="p-3 rounded-lg bg-sun-soft border border-sun text-xs text-ink flex items-center justify-between">
    <span>💡 <strong>Wi-Fi:</strong> NBKRIST-CAMPUS-5G</span>
    <span class="font-mono text-ink-2">Pass: Prompt2Prod@2026</span>
  </div>
</div>`,
    styling: {
      theme: "paper" as AnnouncementTheme,
      position: "center" as AnnouncementPosition,
      badgeText: "🚀 Workshop Kickoff",
      ctaText: "View Full Schedule",
      ctaLink: "/#schedule",
      showPopup: true,
    },
  },
  {
    id: "schedule",
    name: "⏰ Milestone & Cutoff Alert",
    description: "Timeline checkpoints and submission countdown",
    html: `<div class="space-y-3">
  <p class="text-sm text-ink-2 leading-relaxed">
    Please note the milestone checkpoints for today's AI Build Challenge. Teams must push code to GitHub before the cutoff:
  </p>
  <div class="space-y-2 text-xs">
    <div class="p-3 rounded-lg bg-field border border-line flex items-start gap-3">
      <span class="tag tag-ok shrink-0 font-mono">1:30 PM</span>
      <div>
        <strong class="text-sm text-ink block">Challenge Problem Statement Released</strong>
        <span class="text-ink-2">Pick your challenge track and start architecture design.</span>
      </div>
    </div>
    <div class="p-3 rounded-lg bg-field border border-line flex items-start gap-3">
      <span class="tag tag-alert shrink-0 font-mono">3:45 PM</span>
      <div>
        <strong class="text-sm text-ink block">Submission Portal Cutoff</strong>
        <span class="text-ink-2">Team leader must submit project repo URL and live demo link.</span>
      </div>
    </div>
  </div>
</div>`,
    styling: {
      theme: "sun" as AnnouncementTheme,
      position: "center" as AnnouncementPosition,
      badgeText: "⏰ Schedule Alert",
      ctaText: "Open Submission Portal",
      ctaLink: "/dashboard/submission",
      showPopup: true,
    },
  },
  {
    id: "wifi",
    name: "📶 Wi-Fi & Sandbox Keys",
    description: "Network details and technical setup instructions",
    html: `<div class="space-y-3">
  <p class="text-sm text-ink-2">Dedicated high-speed workshop Wi-Fi has been configured for all participants:</p>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
    <div class="p-3 rounded-lg bg-field border border-line">
      <span class="cell-label block text-ink-3 mb-1">Network SSID</span>
      <strong class="text-sm text-ink font-semibold">NBKRIST-HACKATHON-5G</strong>
    </div>
    <div class="p-3 rounded-lg bg-field border border-line">
      <span class="cell-label block text-ink-3 mb-1">Wi-Fi Password</span>
      <strong class="text-sm text-accent font-semibold">Prompt2Prod@2026</strong>
    </div>
  </div>
  <p class="text-xs text-ink-3">
    Student coordinators wearing navy badges are stationed at the help desk for connectivity assistance.
  </p>
</div>`,
    styling: {
      theme: "paper" as AnnouncementTheme,
      position: "bottom-right" as AnnouncementPosition,
      badgeText: "📶 Connectivity Info",
      ctaText: "Need Help Desk Support",
      ctaLink: "/dashboard/support",
      showPopup: true,
    },
  },
  {
    id: "winners",
    name: "🏆 Winner & Merit Announcement",
    description: "Celebratory gold notice for winners and merit certificates",
    html: `<div class="space-y-3 text-center">
  <div class="w-12 h-12 rounded-full bg-sun border border-[#f1cf98] text-ink text-2xl flex items-center justify-center mx-auto shadow-sm">
    🏆
  </div>
  <h4 class="text-lg font-bold text-ink wide">Build Challenge Champions Declared!</h4>
  <p class="text-sm text-ink-2 leading-relaxed">
    Congratulations to all student teams who built and demonstrated functional AI applications. Jury scoring has concluded and the official leaderboard is live.
  </p>
  <div class="p-3 rounded-lg bg-sun-soft border border-sun text-xs text-ink font-medium">
    Merit and participation certificates can be downloaded from your participant dashboard.
  </div>
</div>`,
    styling: {
      theme: "sun" as AnnouncementTheme,
      position: "center" as AnnouncementPosition,
      badgeText: "🏆 Winners Declared",
      ctaText: "Check Live Standings",
      ctaLink: "/leaderboard",
      showPopup: true,
    },
  },
];

export function parseAnnouncementContent(
  content: string,
  fallbackPriority: string = "normal"
): ParsedAnnouncement {
  if (!content) {
    return {
      styling: {
        ...DEFAULT_ANNOUNCEMENT_STYLING,
        theme: fallbackPriority === "urgent" ? "alert" : "paper",
      },
      html: "",
      plainText: "",
    };
  }

  const match = content.match(CONFIG_REGEX);
  let styling: AnnouncementStyling = {
    ...DEFAULT_ANNOUNCEMENT_STYLING,
    theme: fallbackPriority === "urgent" ? "alert" : "paper",
  };
  let html = content;

  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      // Normalize legacy theme names
      if (parsed.theme === "navy") parsed.theme = "paytm";
      if (parsed.theme === "clean") parsed.theme = "paper";
      if (parsed.theme === "crimson") parsed.theme = "alert";
      if (parsed.theme === "emerald") parsed.theme = "ok";
      styling = { ...styling, ...parsed };
    } catch {
      // ignore JSON parse error
    }
    html = content.replace(CONFIG_REGEX, "").trim();
  }

  // Extract clean plain text for text tickers & summaries
  const plainText = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  return { styling, html, plainText };
}

export function serializeAnnouncementContent(
  html: string,
  styling: AnnouncementStyling
): string {
  return `<!--popup-config:${JSON.stringify(styling)}-->\n${html.trim()}`;
}
