"use client";

import React, { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  Calendar,
  MapPin,
  ArrowRight,
  Code,
  Brain,
  Zap,
  Users,
  Laptop,
  Target,
  Layers,
  Gift,
  Maximize2,
  X,
  Plus,
  Minus,
  Heart,
  Download,
  ExternalLink,
} from "lucide-react";
import { useStore, isStoreReady, triggerDownload } from "@/lib/store";
import { generateQrDataUrl } from "@/lib/qr";
import { generateIcsContent } from "@/lib/ics";
import { parseAnnouncementContent } from "@/lib/announcements";
import AnnouncementPopupCard from "@/components/AnnouncementPopupCard";

function LinkedInIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.79v8.37H6.46v-8.37M7.86 6.3a1.5 1.5 0 0 0-1.5 1.5c0 .83.67 1.5 1.5 1.5a1.5 1.5 0 0 0 1.5-1.5c0-.83-.67-1.5-1.5-1.5Z" />
    </svg>
  );
}

type ScheduleTab = "morning" | "afternoon" | "finale";

type ScheduleItem = { time: string; title: string; category: string; desc: string };

const H2 =
  "wide text-[1.75rem] sm:text-4xl lg:text-[2.75rem] font-semibold tracking-tight leading-[1.05] text-balance";
const SECTION = "px-4 sm:px-6 py-7 sm:py-16 lg:py-24";
// Section intro copy: smaller on phones, unchanged from sm up
const INTRO = "text-sm sm:text-base text-ink-2 leading-relaxed";
const CONTAINER = "mx-auto w-full max-w-[1280px]";

const pad = (n: number) => String(n).padStart(2, "0");

/** Parse "9:00 AM" into 24h hours/minutes; null when it doesn't match. */
function parseClock(t: string | undefined): { h: number; m: number } | null {
  const match = t?.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return null;
  let h = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") h += 12;
  return { h, m: Number(match[2] ?? 0) };
}

/** Start/end clock times from eventConfig.time ("9:00 AM – 4:00 PM"), with the published defaults as fallback. */
function eventClock(time: string) {
  const [a, b] = time.split(/\s*[–—-]\s*/);
  return { start: parseClock(a) ?? { h: 9, m: 0 }, end: parseClock(b) ?? { h: 16, m: 0 } };
}

export default function HomePage() {
  const { eventConfig, seatsTaken, announcements } = useStore();
  const storeReady = isStoreReady();
  const seatsLeft = Math.max(0, eventConfig.capacity - seatsTaken);
  const { start: startClock, end: endClock } = eventClock(eventConfig.time);
  // Event start in IST (UTC+05:30), from eventConfig.date + the start of eventConfig.time
  const eventStartIso = `${eventConfig.date}T${pad(startClock.h)}:${pad(startClock.m)}:00+05:30`;
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [learnOpen, setLearnOpen] = useState<number | null>(null);
  const [schedOpen, setSchedOpen] = useState<string | null>(null);
  const [posterModalOpen, setPosterModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [scheduleTab, setScheduleTab] = useState<ScheduleTab>("morning");
  const closeRef = useRef<HTMLButtonElement>(null);

  // Announcement popup card state on home page
  const [homePopupOpen, setHomePopupOpen] = useState(false);
  const [pillDismissed, setPillDismissed] = useState(false);
  const publishedAnnouncements = (announcements || [])
    .filter((a) => a.published)
    .sort((a, b) => {
      if (a.priority === "urgent" && b.priority !== "urgent") return -1;
      if (b.priority === "urgent" && a.priority !== "urgent") return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const popupAnnouncement =
    publishedAnnouncements.find(
      (a) => parseAnnouncementContent(a.content, a.priority).styling.showPopup
    ) || null;

  useEffect(() => {
    if (!popupAnnouncement) {
      setHomePopupOpen(false);
      return;
    }

    // Check if the visitor explicitly clicked "Don't show again today"
    try {
      const todayStr = new Date().toDateString();
      const dismissedToday = localStorage.getItem(`dismiss_today_${popupAnnouncement.id}`);
      if (dismissedToday === todayStr) {
        return; // Suppressed for today only
      }
    } catch {
      // ignore storage access errors in private/iframe browsing
    }

    // Automatically open popup card when opening or refreshing the home page
    const timer = setTimeout(() => {
      setHomePopupOpen(true);
    }, 350);
    return () => clearTimeout(timer);
  }, [popupAnnouncement?.id]);

  const handleDontShowToday = () => {
    if (popupAnnouncement) {
      try {
        localStorage.setItem(`dismiss_today_${popupAnnouncement.id}`, new Date().toDateString());
      } catch {
        // ignore storage access errors
      }
    }
    setHomePopupOpen(false);
  };

  // Live countdown state
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    generateQrDataUrl("P2P-2026-00042").then(url => setQrDataUrl(url));
  }, []);

  useEffect(() => {
    const targetDate = new Date(eventStartIso).getTime();
    if (Number.isNaN(targetDate)) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance < 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [eventStartIso]);

  const handleDownloadIcs = () => {
    const ymd = eventConfig.date.replace(/-/g, "");
    const hms = (c: { h: number; m: number }) => `${pad(c.h)}${pad(c.m)}00`;
    const ics = generateIcsContent({
      title: `${eventConfig.name} – ${eventConfig.subtitle}`,
      description: eventConfig.description,
      location: `${eventConfig.venue}, NBKRIST`,
      startDate: `${ymd}T${hms(startClock)}`,
      endDate: `${ymd}T${hms(endClock)}`,
    });
    triggerDownload(ics, "prompt-to-production-2026.ics", "text/calendar;charset=utf-8");
  };

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [, mm, dd] = eventConfig.date.split("-").map(Number);
  const startLabel = `${dd} ${MONTHS[(mm || 1) - 1]}, ${startClock.h % 12 || 12}:${pad(startClock.m)} ${startClock.h >= 12 ? "PM" : "AM"}`;

  // Poster lightbox: Escape closes, focus the close control, lock page scroll
  useEffect(() => {
    if (!posterModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPosterModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [posterModalOpen]);

  // Schedule switcher: slide the content plane with a View Transition when available
  const selectScheduleTab = (next: ScheduleTab) => {
    if (next === scheduleTab) return;
    const doc = document as unknown as { startViewTransition?: (cb: () => void) => unknown };
    if (typeof doc.startViewTransition === "function") {
      doc.startViewTransition(() => {
        flushSync(() => setScheduleTab(next));
      });
    } else {
      setScheduleTab(next);
    }
  };

  const highlights = [
    { title: "Generative AI", desc: "Core foundation of LLMs, multimodal systems, and real-world architectures.", icon: Brain },
    { title: "Prompt Engineering", desc: "Few-shot, ReAct frameworks, structured JSON schemas & function calling.", icon: Code },
    { title: "AI-Assisted Dev", desc: "Copilots, agentic tooling, and accelerating prototype development 10x.", icon: Zap },
    { title: "Hands-on AI Build", desc: "Live 90-minute hackathon build challenge with mentor assistance.", icon: Laptop },
    { title: "Industry Interaction", desc: "Live sessions with engineering leadership from Paytm & Microsoft.", icon: Users },
    { title: "Team Collaboration", desc: "Form teams of up to 4 peers to brainstorm, build, and pitch solutions.", icon: Target },
    { title: "Project Demonstration", desc: "Showcase your functional AI application to faculty & peer audience.", icon: Layers },
    { title: "Surprise Prizes", desc: "Cash awards, merchandise, and certificates of merit for top teams.", icon: Gift },
  ];

  const learningTopics = [
    { title: "Generative AI Fundamentals", desc: "Understanding transformer architectures, tokenization, embeddings, and context windows." },
    { title: "Prompt Engineering Mastery", desc: "Zero-shot, Few-shot, Chain-of-Thought, and system prompt guardrailing techniques." },
    { title: "AI-Assisted Development", desc: "Utilizing modern AI developer environments, automated test generation, and refactoring." },
    { title: "Rapid Prototyping", desc: "Going from idea to running MVP within hours using modern full-stack frameworks." },
    { title: "AI Application Development", desc: "Integrating streaming LLM responses, vector search, and API integrations." },
    { title: "Team-Based Development", desc: "Collaborative Git workflows, task delegation, and effective sprint execution." },
    { title: "Project Demonstration", desc: "Structuring impactful tech pitches, live demo defense, and value articulation." },
    { title: "Production-Oriented AI", desc: "Latency optimization, cost management, safety guardrails, and model evaluation." },
  ];

  const scheduleDay1Morning: ScheduleItem[] = [
    { time: "9:00 – 9:15 AM", title: "Registration and Seating", category: "Check-in", desc: "Desk opens at 8:45 AM. QR badge verification and workshop kit distribution." },
    { time: "9:15 – 9:25 AM", title: "Welcome Address", category: "Inauguration", desc: "Opening remarks by Head of Department, IT & AI&DS, NBKRIST." },
    { time: "9:25 – 9:35 AM", title: "Prompt to Production Introduction", category: "Orientation", desc: "Overview of workshop goals, day agenda, and ISTE collaboration." },
    { time: "9:35 – 10:50 AM", title: "Expert Session – Mr. Suman Mandal", category: "Keynote 1", desc: "Program Lead, Paytm. AI as a Mentor: Building with Current AI Tools & Technologies and the Right Way to Use AI (1h 15m virtual masterclass)." },
    { time: "10:50 – 11:00 AM", title: "Interaction / Q&A", category: "Interactive", desc: "Open floor Q&A with Mr. Suman Mandal on industry practices, AI tools, and career pathways." },
    { time: "11:00 – 11:15 AM", title: "Tea Break & Networking", category: "Break", desc: "Refreshments provided in the foyer." },
    { time: "11:15 AM – 12:30 PM", title: "Expert Session – Mr. Shivam Behl", category: "Keynote 2", desc: "Software Engineer, Microsoft (ex-Zepto, Flipkart). Cracking Tier-1 Tech, Enterprise Production & Career Roadmap for Tier-3 Students (1h 15m masterclass)." },
    { time: "12:30 – 12:40 PM", title: "Q&A Session", category: "Interactive", desc: "Direct interactive discussion with Mr. Shivam Behl on hiring, enterprise systems, and engineering roadmaps." },
    { time: "12:40 – 1:30 PM", title: "Lunch Break", category: "Dining", desc: "Special lunch provided for all registered participants at New CSE Block dining hall." },
  ];

  const scheduleDay1Afternoon: ScheduleItem[] = [
    { time: "1:30 – 1:45 PM", title: "Build Challenge Introduction", category: "Hackathon", desc: "Problem statement reveal, judging criteria announcement, and sandbox API distribution." },
    { time: "1:45 – 3:15 PM", title: "Hands-on AI Build", category: "Hackathon", desc: "Intensive 90-minute hands-on build challenge in teams. Faculty and mentors on floor." },
    { time: "3:15 – 3:45 PM", title: "Project Demonstrations & Submissions", category: "Showcase", desc: "Live project demonstrations, testing, and team code repository submissions." },
    { time: "3:45 – 4:00 PM", title: "Day 1 Wrap-up & Briefing", category: "Wrap-up", desc: "Review of Day 1 code submissions and briefing for next day's Winner Announcement." },
  ];

  const scheduleDay2: ScheduleItem[] = [
    { time: "10:00 AM", title: "Winners Announcement", category: "Results", desc: "Official announcement of workshop and build challenge winners published in the WhatsApp group." },
    { time: "12:45 PM", title: "Prize Distribution & Felicitation", category: "Prize Distribution", desc: "Awarding surprise cash awards, certificates of merit, and closing remarks at Principal's Cabin, EEE Block." },
  ];

  const scheduleTabs: {
    id: ScheduleTab;
    day: string;
    part: string;
    heading: string;
    sub: string;
    count: string;
    items: ScheduleItem[];
  }[] = [
    {
      id: "morning",
      day: "Day 1",
      part: "Morning",
      heading: "Day 1: Wednesday, 30 September 2026 · 9:00 AM – 4:00 PM",
      sub: "Part 1 · 9:00 AM – 1:30 PM · Morning track: keynotes & masterclasses",
      count: "9 sessions",
      items: scheduleDay1Morning,
    },
    {
      id: "afternoon",
      day: "Day 1",
      part: "Afternoon",
      heading: "Day 1: Wednesday, 30 September 2026 · 9:00 AM – 4:00 PM",
      sub: "Part 2 · 1:30 PM – 4:00 PM · Afternoon track: AI Build hackathon & wrap-up",
      count: "4 sessions",
      items: scheduleDay1Afternoon,
    },
    {
      id: "finale",
      day: "Day 2",
      part: "Winner Announcement",
      heading: "Day 2 (next day): Thursday, 1 October 2026 · 10:00 AM & 12:45 PM",
      sub: "Winners announcement in WhatsApp group & prize distribution at Principal's Cabin, EEE Block",
      count: "Day 2",
      items: scheduleDay2,
    },
  ];
  const activeTab = scheduleTabs.find(t => t.id === scheduleTab) ?? scheduleTabs[0];

  const onRailKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const idx = scheduleTabs.findIndex(t => t.id === scheduleTab);
    const nextIdx = (idx + (e.key === "ArrowRight" ? 1 : -1) + scheduleTabs.length) % scheduleTabs.length;
    const next = scheduleTabs[nextIdx].id;
    selectScheduleTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  const speakers = [
    {
      org: "Paytm",
      name: "Mr. Suman Mandal",
      role: "Program Lead, Paytm · AI Learning & Campus Initiatives",
      img: "/images/suman_mandal.png",
      alt: "Mr. Suman Mandal - Program Lead, Paytm",
      topic: "AI as a Mentor: Building with Current AI Tools & Technologies and the Right Way to Use AI",
      tags: ["AI as a Mentor", "GenAI Tools", "AI Agents", "Prompt to Production"],
      bio: "Program Lead at Paytm driving AI Learning, campus initiatives, and user growth. His work spans computer vision, RAG, generative AI, and AI agents, empowering emerging talent and students to build practical applications and leverage modern AI tools responsibly.",
      session: "Day 1 · 9:35 AM – 10:50 AM",
      linkedin: "https://www.linkedin.com/in/suman-mandal-join/",
      navy: true,
    },
    {
      org: "Microsoft",
      name: "Mr. Shivam Behl",
      role: "Software Development Engineer II (SDE-II), Microsoft",
      img: "/images/shivam_behl.png",
      alt: "Mr. Shivam Behl - SDE-II, Microsoft",
      topic: "Cracking Tier-1 Tech (Microsoft), Enterprise Production & Career Roadmap for Tier-3 Students",
      tags: ["Tier-1 Tech", "Enterprise Production", "Production vs Scale", "Tier-3 Roadmap"],
      bio: "Software Development Engineer (SDE-II) at Microsoft with experience across leading tech companies including Microsoft, Zepto, and Flipkart. Spanning global tech and fast-paced startups, he mentors aspiring engineers on cracking tier-1 roles, building enterprise-ready scalable systems, and engineering roadmaps.",
      session: "Day 1 · 11:15 AM – 12:30 PM",
      linkedin: "https://www.linkedin.com/in/shivam1103/",
      navy: false,
    },
  ];

  const leadership = [
    { name: "Sri. N. Ramkumar", role: "Correspondent", org: "N.B.K.R. Institute of Science & Technology" },
    { name: "Dr. M. Sreenivasulu", role: "Principal (i/c)", org: "N.B.K.R. Institute of Science & Technology" },
    { name: "Dr. A. Narayana Rao", role: "HOD, Department of IT & AI&DS", org: "Program Convener" },
    { name: "Mr. M. Sivapratap Reddy", role: "Program Coordinator", org: "Department of IT & AI&DS" },
  ];

  const faqs = [
    {
      q: "Who is eligible to participate in the Prompt to Production workshop?",
      a: "Engineering students across all branches (AI&DS, IT, CSE, ECE, EEE, Mech, Civil) of NBKRIST are eligible. The content is tailored to bring beginners up to speed and provide advanced takeaways for experienced builders."
    },
    {
      q: "What are the registration fees for ISTE vs Non-ISTE members?",
      a: `ISTE Student Members pay a subsidized fee of ₹${eventConfig.iste_fee}. Non-ISTE participants pay ₹${eventConfig.non_iste_fee}. Verification of ISTE membership is verified using your Student Membership number.`
    },
    {
      q: "What should I bring to the workshop?",
      a: "Please bring your laptop with charger, extension board (optional), college ID card, and your digital event ticket (accessible on your phone or printed pass)."
    },
    {
      q: "How does the team formation work for the Build Challenge?",
      a: "Teams can have 1 to 4 members. You can create or join a team using an invite code directly from your participant dashboard before or during the lunch break."
    },
    {
      q: "Will I receive an official certificate?",
      a: "Yes! All verified participants receive an official Certificate of Participation recognized by NBKRIST and ISTE with online QR verification. Winners will receive Certificates of Merit along with surprise cash awards."
    },
    {
      q: "What happens after I pay by UPI?",
      a: "Enter your 12-digit UTR and upload the payment screenshot while registering, then set your password. An organizer verifies the payment, and once approved your digital QR ticket appears in your dashboard."
    },
  ];

  const countdown = [
    { value: timeLeft.days, unit: "Days" },
    { value: timeLeft.hours, unit: "Hrs" },
    { value: timeLeft.minutes, unit: "Min" },
    { value: timeLeft.seconds, unit: "Sec" },
  ];

  return (
    <div className="flex flex-col min-h-screen">

      {/* ============ HERO: one asymmetric plane grid ============ */}
      <section id="hero" className="px-4 sm:px-6 pt-3 sm:pt-6 pb-5 sm:pb-12 lg:pb-16">
        <div className={CONTAINER}>
          <div className="planes grid-cols-1 gap-2.5 sm:gap-3 lg:grid-cols-12">

            {/* Black identity plane: the title */}
            <div className="plane-navy slide-in order-1 lg:order-none lg:col-start-1 lg:col-span-7 lg:row-start-1 lg:row-span-2 flex flex-col justify-center gap-3.5 sm:gap-8 p-5 sm:p-8 lg:p-10">
              <div className="@container space-y-2.5 sm:space-y-5">
                <h1 className="display uppercase text-white text-[clamp(2rem,11.5cqi,6rem)]">
                  Prompt to Production
                </h1>
                <p className="wide text-lg sm:text-2xl font-semibold text-white">
                  Paytm AI Workshop
                </p>
                <p className="text-sm sm:text-lg leading-relaxed text-white max-w-[52ch] line-clamp-3 sm:line-clamp-none">
                  Learn Generative AI and prompt engineering directly from Paytm and Microsoft engineers, then build, collaborate and compete in a hands-on AI Build Challenge.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1.5 sm:gap-3 border-t-2 border-[#4a4b50] pt-3 sm:pt-5 text-xs sm:text-sm">
                <div className="space-y-1 sm:space-y-1.5">
                  <p className="font-semibold text-white">
                    NBKRIST · Dept. of IT &amp; AI&amp;DS · in association with ISTE
                  </p>
                  <p className="inline-flex items-center gap-1.5 text-[#d4d5d8]">
                    Conducted by <span className="font-bold text-white">Paytm</span>
                    <Heart className="w-4 h-4 text-alert fill-current" aria-label="loves" />
                    <span className="font-bold text-white">AI</span>
                  </p>
                </div>
                <p className="font-mono text-[0.6875rem] sm:text-xs text-[#d4d5d8] shrink-0">P2P-2026 · CAP {eventConfig.capacity}</p>
              </div>
            </div>

            {/* Gold register plane: the primary action, full width on desktop */}
            <Link
              href="/register"
              className="plane-sky group order-3 lg:order-none lg:col-start-1 lg:col-span-12 lg:row-start-4 flex flex-row flex-wrap lg:flex-nowrap items-center gap-x-4 gap-y-2 sm:gap-y-4 lg:gap-8 px-5 py-4 sm:p-8 transition-colors hover:!bg-[#ffd04d]"
            >
              <span className="display text-[2rem] sm:text-[clamp(2.25rem,5vw,4rem)] leading-none shrink-0">
                Register now
              </span>
              <span className="flex items-center flex-1 min-w-[4rem]" aria-hidden="true">
                <span className="edge-in h-[4px] flex-1 bg-on-accent" style={{ animationDelay: "320ms" }} />
                <ArrowRight className="-ml-3 w-8 h-8 sm:w-12 sm:h-12 shrink-0 stroke-[2.5] transition-transform duration-200 group-hover:translate-x-1.5" />
              </span>
              <span className="w-full lg:w-auto text-xs sm:text-base font-bold lg:text-right shrink-0 num">
                ₹{eventConfig.iste_fee} ISTE members · ₹{eventConfig.non_iste_fee} others
                <span className="sm:block font-semibold"><span className="sm:hidden"> · </span>Paid via UPI · {eventConfig.capacity} seats</span>
              </span>
            </Link>

            {/* Fact readouts */}
            <div className="order-2 lg:order-none lg:col-start-1 lg:col-span-12 lg:row-start-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1.5fr_1fr_1fr_1.35fr] gap-px !bg-line">
              <div className="bg-paper px-3.5 py-2.5 sm:p-5">
                <div className="cell-label">Date</div>
                <div className="mt-1 sm:mt-1.5 text-[0.9375rem] sm:text-lg lg:text-xl font-semibold num leading-tight">30 Sep 2026</div>
                <div className="text-xs sm:text-sm text-ink-2">Wednesday</div>
              </div>
              <div className="bg-paper px-3.5 py-2.5 sm:p-5">
                <div className="cell-label">Time</div>
                <div className="mt-1 sm:mt-1.5 text-[0.9375rem] sm:text-lg lg:text-xl font-semibold num leading-tight">9:00 AM</div>
                <div className="text-xs sm:text-sm text-ink-2 num">to 4:00 PM IST</div>
              </div>
              <div className="bg-paper px-3.5 py-2.5 sm:p-5">
                <div className="cell-label">Venue</div>
                <div className="mt-1 sm:mt-1.5 text-[0.9375rem] sm:text-lg lg:text-xl font-semibold leading-tight">Seminar Hall-1</div>
                <div className="text-xs sm:text-sm text-ink-2">New CSE Block, NBKRIST</div>
              </div>
              <div className="bg-paper px-3.5 py-2.5 sm:p-5">
                <div className="cell-label">Fee</div>
                <div className="mt-1 sm:mt-1.5 text-[0.9375rem] sm:text-lg lg:text-xl font-semibold num leading-tight">₹{eventConfig.iste_fee} ISTE</div>
                <div className="text-xs sm:text-sm text-ink-2 num">₹{eventConfig.non_iste_fee} others</div>
              </div>
              <div className="bg-paper px-3.5 py-2.5 sm:p-5">
                <div className="cell-label">Seats</div>
                <div className="mt-1 sm:mt-1.5 text-[0.9375rem] sm:text-lg lg:text-xl font-semibold num leading-tight">
                  {!storeReady ? "–" : !eventConfig.registration_open ? "Closed" : seatsLeft === 0 ? "Full" : `${seatsLeft} left`}
                </div>
                <div className="text-xs sm:text-sm text-ink-2 num">of {eventConfig.capacity}</div>
              </div>
              <div className="bg-paper px-3.5 py-2.5 sm:p-5 flex flex-col justify-between gap-1 sm:gap-3">
                <div>
                  <div className="cell-label">Day 2 · Winner Announcement</div>
                  <div className="mt-1 text-[0.9375rem] sm:text-sm font-semibold sm:font-bold num max-sm:leading-tight">1 Oct<span className="hidden sm:inline"> 2026</span> · 10:00 AM</div>
                </div>
                <a href="#schedule" className="sm:hidden inline-flex items-center gap-1 text-xs font-semibold text-ink underline underline-offset-4 decoration-line">
                  View schedule
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
                <a href="#schedule" className="btn btn-sm w-full min-h-11 hidden sm:inline-flex">
                  View schedule
                </a>
              </div>
            </div>

            {/* Gold countdown plane */}
            <div className="plane-sun order-4 lg:order-none lg:col-start-8 lg:col-span-5 lg:row-start-2 px-5 py-3.5 sm:p-7 space-y-2 sm:space-y-4">
              <div className="cell-label">Starts in · {startLabel} IST</div>
              <div className="grid grid-cols-4 gap-2 sm:gap-3" role="timer" aria-live="off">
                {countdown.map(c => (
                  <div key={c.unit} className="border-l-2 border-on-accent pl-2 sm:pl-2.5 first:border-l-0 first:pl-0">
                    <div className="display num text-[1.75rem] sm:text-5xl lg:text-[3.25rem] leading-none">{pad(c.value)}</div>
                    <div className="mt-1 sm:mt-2 text-[0.6875rem] sm:text-xs font-bold uppercase tracking-wider">{c.unit}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Poster plane */}
            <button
              type="button"
              onClick={() => setPosterModalOpen(true)}
              aria-label="View the full official poster"
              className="plane-ink group order-5 lg:order-none lg:col-start-8 lg:col-span-5 lg:row-start-1 flex flex-row sm:flex-col text-left cursor-pointer"
            >
              <span className="w-[46%] shrink-0 sm:shrink sm:flex-1 flex items-center sm:w-full">
                <span className="relative block w-full aspect-[16/9]">
                  <Image
                    src="/images/poster.jpg"
                    alt="Prompt to Production - Paytm AI Workshop Official Poster"
                    fill
                    sizes="(max-width: 1024px) 100vw, 520px"
                    priority
                    className="object-contain"
                  />
                </span>
              </span>
              <span className="flex-1 sm:flex-none sm:w-full flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-center sm:justify-between gap-x-3 gap-y-1.5 sm:gap-y-1 py-2 bg-paper text-ink border-l-2 sm:border-l-0 sm:border-t-2 border-line px-3.5 sm:px-5 sm:min-h-12 transition-colors group-hover:bg-sky-soft">
                <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold whitespace-nowrap">
                  Conducted by
                  <span className="font-semibold"><span className="text-paytm">Pay</span><span className="text-paytm-sky">tm</span></span>
                  <Heart className="w-3.5 h-3.5 text-alert fill-current" aria-label="loves" />
                  <span className="font-semibold">AI</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[0.8125rem] sm:text-sm font-bold whitespace-nowrap">
                  <Maximize2 className="w-4 h-4" aria-hidden="true" />
                  View full poster
                </span>
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ============ POSTER LIGHTBOX ============ */}
      {posterModalOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="poster-dialog-title"
            className="fixed inset-0 z-[70] flex flex-col bg-[#0b0b0c]"
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5 sm:px-5">
              <div className="min-w-0">
                <h3 id="poster-dialog-title" className="truncate text-sm font-semibold text-white sm:text-base">
                  Prompt to Production · Official poster
                </h3>
                <p className="hidden truncate text-xs text-white/60 sm:block">Wed, 30 Sep 2026 · 9:00 AM · Seminar Hall-1, New CSE Block</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <a
                  href="/images/poster.jpg"
                  download="P2P-Paytm-AI-Workshop-Poster.jpg"
                  aria-label="Download poster"
                  className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white sm:px-4"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Download</span>
                </a>
                <Link
                  href="/register"
                  onClick={() => setPosterModalOpen(false)}
                  className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-white/90"
                >
                  Register
                </Link>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setPosterModalOpen(false)}
                  aria-label="Close poster"
                  className="ml-1 flex h-10 w-10 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            {/* Poster fills the rest; click the dark area to close */}
            <div
              className="relative flex min-h-0 flex-1 p-2 sm:p-4"
              onClick={(e) => e.target === e.currentTarget && setPosterModalOpen(false)}
            >
              <div className="relative h-full w-full" onClick={(e) => e.target === e.currentTarget && setPosterModalOpen(false)}>
                <Image
                  src="/images/poster.jpg"
                  alt="Prompt to Production official poster"
                  fill
                  priority
                  sizes="100vw"
                  quality={100}
                  className="object-contain"
                />
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ============ EVENT HIGHLIGHTS ============ */}
      <section id="about" className={SECTION}>
        <div className={`${CONTAINER} space-y-4 sm:space-y-10`}>
          <div className="grid gap-2 sm:gap-4 lg:grid-cols-12 lg:items-end">
            <h2 className={`${H2} lg:col-span-7`}>Event highlights</h2>
            <p className={`lg:col-span-5 ${INTRO} max-w-[60ch]`}>
              Engineered to bridge classroom AI theory with production-grade engineering practice, in one day on campus.
            </p>
          </div>

          <div className="planes m-rail grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" aria-label="Event highlights, swipe for more">
            {highlights.map((item, idx) => {
              const IconComp = item.icon;
              if (idx === 0) {
                return (
                  <div
                    key={item.title}
                    className="plane-navy sm:col-span-2 lg:col-span-2 lg:row-span-2 flex flex-col justify-between gap-6 sm:gap-10 p-5 sm:p-8 lg:p-10"
                  >
                    <IconComp className="w-6 h-6 text-white" aria-hidden="true" />
                    <div className="space-y-2 sm:space-y-3">
                      <h3 className="display text-[2rem] sm:text-5xl">{item.title}</h3>
                      <p className="text-sm sm:text-lg text-white leading-relaxed max-w-[44ch]">{item.desc}</p>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={item.title}
                  className={`flex flex-col justify-between gap-6 lg:block p-5 sm:p-6 lg:space-y-2 transition-colors hover:bg-paper-2 ${idx === 7 ? "sm:col-span-2 lg:col-span-2" : ""}`}
                >
                  <IconComp className="w-6 h-6 text-ink-2 shrink-0 lg:hidden" aria-hidden="true" />
                  <div className="space-y-2">
                    <h3 className="flex items-center gap-2 font-semibold text-base">
                      <IconComp className="w-4 h-4 text-ink-2 shrink-0 hidden lg:block" aria-hidden="true" />
                      {item.title}
                    </h3>
                    <p className="text-sm text-ink-2 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ KEYNOTE SPEAKERS ============ */}
      <section id="speakers" className={`${SECTION} bg-field-2 rule-t rule-b`}>
        <div className={`${CONTAINER} space-y-4 sm:space-y-10`}>
          <div className="grid gap-2 sm:gap-4 lg:grid-cols-12 lg:items-end">
            <h2 className={`${H2} lg:col-span-7`}>Keynote speakers</h2>
            <p className={`lg:col-span-5 ${INTRO} max-w-[60ch]`}>
              Learn directly from engineering leaders driving AI development at Paytm and Microsoft.
            </p>
          </div>

          <div className="planes grid-cols-1 lg:grid-cols-2">
            {speakers.map(sp => (
              <article key={sp.name} className="flex flex-col gap-px !bg-line">
                <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-px bg-line">
                  {/* Portrait: a compact thumbnail beside the name on phones, a full plane from sm up */}
                  <div
                    className="relative bg-field min-h-[7.5rem] sm:aspect-auto sm:min-h-[22rem] select-none overflow-hidden"
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <Image
                      src={sp.img}
                      alt={sp.alt}
                      fill
                      sizes="(max-width: 640px) 104px, (max-width: 1024px) 42vw, 260px"
                      draggable={false}
                      className="object-cover object-top select-none pointer-events-none"
                    />
                    {/* Transparent protection layer */}
                    <div className="absolute inset-0" aria-hidden="true" />
                  </div>

                  {/* On phones this wrapper dissolves so the topic plane can span under the portrait */}
                  <div className="contents sm:flex sm:flex-col gap-px bg-line">
                    <div className={`${sp.navy ? "plane-navy" : "bg-paper"} relative flex flex-col justify-center p-4 sm:block sm:p-6 space-y-1`}>
                      {/* Phones: LinkedIn as a compact corner control */}
                      <a
                        href={sp.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`View ${sp.name.replace("Mr. ", "")} on LinkedIn`}
                        className={`sm:hidden absolute top-2 right-2 !mt-0 inline-flex w-9 h-9 items-center justify-center rounded-full border ${sp.navy ? "border-white/25 text-white" : "border-line text-ink"}`}
                      >
                        <LinkedInIcon className="w-4 h-4" />
                        <span className="sr-only">{sp.name} on LinkedIn</span>
                      </a>
                      <div className="cell-label">Keynote<span className="hidden sm:inline"> masterclass</span> · {sp.org}</div>
                      <h3 className="wide text-xl sm:text-[1.75rem] font-semibold leading-tight tracking-tight text-balance">
                        {sp.name}
                      </h3>
                      <p className={`text-xs sm:text-sm font-semibold max-sm:leading-snug ${sp.navy ? "text-[#d4d5d8]" : "text-ink-2"}`}>{sp.role}</p>
                    </div>
                    <div className="bg-paper col-span-2 p-4 sm:p-6 flex-1 space-y-3 sm:space-y-4">
                      <div className="space-y-1">
                        <div className="cell-label">Topic</div>
                        <p className="text-[0.9375rem] sm:text-base font-bold leading-snug text-balance">{sp.topic}</p>
                      </div>
                      <ul className="flex flex-wrap gap-1.5" aria-label="Expertise">
                        {sp.tags.map(tag => (
                          <li key={tag} className="tag">{tag}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Biography: collapsed behind a disclosure on phones, always open from sm up */}
                <details className="group bg-paper sm:hidden">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                    <span>
                      Read bio &amp; expertise<span className="sr-only">: {sp.name}</span>
                    </span>
                    <Plus className="w-4 h-4 text-ink-2 transition-transform duration-200 group-open:rotate-45" aria-hidden="true" />
                  </summary>
                  <div className="px-4 pb-4 space-y-3">
                    <p className="text-sm text-ink-2 leading-relaxed">{sp.bio}</p>
                  </div>
                </details>
                <div className="bg-paper p-5 sm:p-6 flex-1 space-y-1.5 hidden sm:block">
                  <div className="cell-label">Biography</div>
                  <p className="text-sm text-ink-2 leading-relaxed max-w-[72ch]">{sp.bio}</p>
                </div>

                <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_auto] gap-px bg-line">
                  <div className="bg-paper px-3 py-2.5 sm:p-4">
                    <div className="cell-label max-sm:!tracking-[0.08em]">Session</div>
                    <div className="mt-0.5 text-[0.8125rem] sm:text-sm num font-semibold">{sp.session}</div>
                  </div>
                  <div className="bg-paper px-3 py-2.5 sm:p-4">
                    <div className="cell-label max-sm:!tracking-[0.08em]">Format</div>
                    <div className="mt-0.5 text-[0.8125rem] sm:text-sm font-semibold">Virtual masterclass</div>
                  </div>
                  <div className="bg-paper px-3 py-2.5 sm:p-4">
                    <div className="cell-label max-sm:!tracking-[0.08em]">Duration</div>
                    <div className="mt-0.5 text-[0.8125rem] sm:text-sm font-semibold num">1h 15m</div>
                  </div>
                  <div className="bg-paper p-3 hidden sm:flex items-center">
                    <a
                      href={sp.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`View ${sp.name.replace("Mr. ", "")} on LinkedIn`}
                      className="btn btn-sm w-full min-h-11"
                    >
                      <LinkedInIcon className="w-4 h-4" />
                      <span>LinkedIn</span><span className="sr-only">: {sp.name}</span>
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ LEADERSHIP ============ */}
      <section id="leadership" className="px-4 sm:px-6 py-5 sm:py-12 lg:py-16">
        <div className={CONTAINER}>
          <div className="grid gap-5 lg:grid-cols-12 lg:gap-12 lg:items-center">
            <div className="lg:col-span-4 space-y-2">
              <h2 className={H2}>Patrons &amp; organising committee</h2>
              <p className={`${INTRO} max-w-[46ch]`}>
                Organised by the Department of IT and AI&amp;DS, N.B.K.R. Institute of Science &amp; Technology, in association with ISTE.
              </p>
            </div>
            <ul className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {leadership.map((p) => {
                const words = p.name.replace(/^(Sri|Dr|Mr|Mrs|Ms)\.\s*/i, "").split(/[\s.]+/).filter(Boolean);
                const initials = (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
                return (
                  <li key={p.name} className="frame bg-paper flex items-center gap-4 p-4 sm:p-5">
                    <span
                      aria-hidden="true"
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-white text-sm font-semibold tracking-wide"
                    >
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[0.9375rem] sm:text-base font-semibold leading-snug">{p.name}</h3>
                      <p className="text-sm text-ink-2 leading-snug">{p.role}</p>
                      <p className="text-xs text-ink-3 leading-snug mt-0.5 truncate">{p.org}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* ============ WHAT YOU WILL LEARN ============ */}
      <section id="learn" className={SECTION}>
        <div className={`${CONTAINER} grid gap-4 sm:gap-8 lg:grid-cols-12 lg:gap-12`}>
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28 space-y-2 sm:space-y-4">
              <h2 className={H2}>What you will learn</h2>
              <p className={`${INTRO} max-w-[48ch]`}>
                A progressive 8-tier curriculum taking you from foundational prompt mechanics to full production readiness.
              </p>
            </div>
          </div>
          <ol className="lg:col-span-8 frame bg-paper grid md:grid-cols-2 md:grid-rows-4 md:grid-flow-col">
            {learningTopics.map((topic, i) => {
              const open = learnOpen === i;
              return (
                <li
                  key={topic.title}
                  className={`relative flex items-baseline md:items-stretch gap-3.5 sm:gap-5 px-4 py-2 sm:p-6 border-rule ${i % 4 !== 3 ? "border-b" : "md:border-b-0 border-b"} ${i === 7 ? "!border-b-0" : ""} ${i >= 4 ? "md:border-l-2 md:border-l-line" : ""}`}
                >
                  <span className="display num text-xl sm:text-3xl text-ink w-7 sm:w-10 shrink-0" aria-hidden="true">
                    {pad(i + 1)}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="font-semibold text-[0.9375rem] sm:text-base pr-7 md:pr-0">{topic.title}</h3>
                    <p
                      id={`learn-d-${i}`}
                      className={`${open ? "block" : "hidden"} md:block text-[0.8125rem] sm:text-sm text-ink-2 leading-relaxed`}
                    >
                      {topic.desc}
                    </p>
                  </div>
                  {/* Phones: the whole row toggles its description */}
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`learn-d-${i}`}
                    onClick={() => setLearnOpen(open ? null : i)}
                    className="md:hidden absolute inset-0 flex items-start justify-end pt-2.5 pr-4 text-ink-3"
                  >
                    <span className="sr-only">{open ? "Hide" : "Show"} details: {topic.title}</span>
                    {open ? <Minus className="w-4 h-4" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ============ SCHEDULE: sliding-plane switcher ============ */}
      <section id="schedule" className={`${SECTION} bg-field-2 rule-t rule-b`}>
        <div className={`${CONTAINER} space-y-4 sm:space-y-8`}>
          <div className="grid gap-3 sm:gap-5 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8 space-y-2 sm:space-y-3">
              <h2 className={H2}>Event schedule</h2>
              <p className={`${INTRO} max-w-[70ch]`}>
                Day 1: Wednesday, 30 Sep (Seminar Hall-1, New CSE Block) · Day 2: Thursday, 1 Oct (Principal&apos;s Cabin, EEE Block)
              </p>
            </div>
            <div className="lg:col-span-4 lg:justify-self-end">
              <button type="button" onClick={handleDownloadIcs} className="btn max-sm:min-h-10 max-sm:text-sm">
                <Calendar className="w-4 h-4" aria-hidden="true" />
                Add to calendar (.ics)
              </button>
            </div>
          </div>

          <div className="frame bg-paper">
            <div
              role="tablist"
              aria-label="Schedule parts"
              onKeyDown={onRailKeyDown}
              className="rule-b grid grid-cols-3 bg-paper"
            >
              {scheduleTabs.map(t => {
                const active = t.id === scheduleTab;
                return (
                  <button
                    key={t.id}
                    id={`tab-${t.id}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls="schedule-panel"
                    tabIndex={active ? 0 : -1}
                    data-active={active ? "true" : undefined}
                    onClick={() => selectScheduleTab(t.id)}
                    className="rail-item !whitespace-normal justify-center text-center leading-tight min-h-12 sm:min-h-14 max-sm:text-sm px-2 sm:px-4 sm:justify-start sm:text-left border-r border-rule last:border-r-0"
                  >
                    <span>
                      {t.day}
                      <span className="hidden sm:inline"> · </span>
                      <br className="sm:hidden" />
                      {t.part}
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              id="schedule-panel"
              role="tabpanel"
              aria-labelledby={`tab-${activeTab.id}`}
              style={{ viewTransitionName: "plane-body" }}
            >
              <div className="rule-b px-4 py-3.5 sm:p-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2.5 sm:gap-3">
                <div className="space-y-1">
                  <h3 className="wide text-[0.9375rem] sm:text-xl font-semibold leading-snug text-balance">{activeTab.heading}</h3>
                  <p className="text-[0.8125rem] sm:text-sm text-ink-2">{activeTab.sub}</p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {activeTab.id !== "finale" && <span className="tag">13 sessions total</span>}
                  <span className="tag tag-info">{activeTab.count}</span>
                </div>
              </div>

              <ol>
                {activeTab.items.map(item => {
                  const isKeynote = item.category.includes("Keynote");
                  const isHackathon = item.category === "Hackathon";
                  const open = schedOpen === item.time;
                  return (
                    <li
                      key={item.time}
                      className={`relative grid sm:grid-cols-[11.5rem_minmax(0,1fr)] border-b border-rule last:border-b-0 ${
                        isHackathon ? "bg-sun-soft" : ""
                      }`}
                    >
                      <div className="px-4 pt-2.5 sm:py-5 sm:px-6 num font-semibold text-xs sm:text-sm text-ink flex items-center justify-between gap-3 sm:block">
                        {item.time}
                        {/* Phones: the category sits on the time line so the title never wraps under it */}
                        <span
                          className={`tag !text-[0.6875rem] !py-0 sm:!hidden ${isKeynote ? "tag-info" : ""} ${isHackathon ? "!bg-sun !text-on-accent !border-line" : ""}`}
                        >
                          {item.category}
                        </span>
                      </div>
                      <div className="px-4 pb-2.5 pt-0.5 sm:py-5 sm:px-6 space-y-0.5 sm:space-y-1.5">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <h4 className="font-semibold text-[0.9375rem] sm:text-base max-sm:leading-snug">{item.title}</h4>
                          <span
                            className={`tag max-sm:!hidden ${isKeynote ? "tag-info" : ""} ${isHackathon ? "!bg-sun !text-on-accent !border-line" : ""}`}
                          >
                            {item.category}
                          </span>
                        </div>
                        <p
                          id={`sched-d-${item.time}`}
                          className={`text-[0.8125rem] sm:text-sm text-ink-2 leading-snug sm:leading-relaxed max-w-[72ch] ${open ? "" : "line-clamp-1"} sm:line-clamp-none`}
                        >
                          {item.desc}
                        </p>
                      </div>
                      {/* Phones: tap a row to read its full description */}
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={`sched-d-${item.time}`}
                        onClick={() => setSchedOpen(open ? null : item.time)}
                        className="sm:hidden absolute inset-0"
                      >
                        <span className="sr-only">{open ? "Hide" : "Show"} details: {item.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>

              {activeTab.id === "afternoon" && (
                <div className="rule-t grid md:grid-cols-2 gap-px bg-line">
                  <div className="bg-paper px-4 py-3.5 sm:p-6 space-y-1.5 sm:space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-semibold text-[0.9375rem] sm:text-base">90-Minute Live Build Challenge</h4>
                      <span className="tag tag-info">Teams 1–4</span>
                    </div>
                    <p className="text-[0.8125rem] sm:text-sm text-ink-2 leading-relaxed">
                      Participants work in collaborative teams to architect and ship a functional Generative AI prototype with faculty and industry mentors providing active floor assistance.
                    </p>
                  </div>
                  <div className="bg-paper px-4 py-3.5 sm:p-6 space-y-1.5 sm:space-y-2">
                    <h4 className="font-semibold text-[0.9375rem] sm:text-base">Day 1 Wrap-up &amp; Code Freezing</h4>
                    <p className="text-[0.8125rem] sm:text-sm text-ink-2 leading-relaxed">
                      All team GitHub repositories and working links are registered by 4:00 PM for preliminary scoring before Thursday&apos;s Winner Announcement.
                    </p>
                  </div>
                </div>
              )}

              {activeTab.id === "finale" && (
                <div className="rule-t px-4 py-3.5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 bg-sun-soft">
                  <div className="space-y-1.5">
                    <h4 className="font-semibold text-[0.9375rem] sm:text-base">Awards, Cash Prizes &amp; Institutional Felicitation</h4>
                    <p className="text-[0.8125rem] sm:text-sm text-ink-2 leading-relaxed max-w-[72ch]">
                      Top performing student teams will receive cash prizes and certificates of merit presented by college dignitaries at Principal&apos;s Cabin, EEE Block.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <span className="tag">Cash awards</span>
                    <span className="tag">Certificates of merit</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ BUILD CHALLENGE & PRIZES ============ */}
      <section id="benefits" className={SECTION}>
        <div className={`${CONTAINER} space-y-4 sm:space-y-10`}>
          <div className="grid gap-2 sm:gap-4 lg:grid-cols-12 lg:items-end">
            <h2 className={`${H2} lg:col-span-7`}>Hands-on AI Build Challenge</h2>
            <p className={`lg:col-span-5 ${INTRO} max-w-[60ch]`}>
              Apply prompt engineering and generative agents live. Form a team of up to 4 peers, build a prototype within 90 minutes, and pitch to judges.
            </p>
          </div>

          <div className="planes m-rail grid-cols-1 md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,4fr)]" aria-label="Prizes, swipe for more">
            <div className="plane-sun p-5 sm:p-8 flex flex-col justify-between gap-4 sm:gap-10 lg:min-h-[16rem]">
              <span className="display num text-[2.75rem] sm:text-7xl">1st</span>
              <div className="space-y-1.5 sm:space-y-2">
                <h3 className="wide text-lg sm:text-2xl font-semibold">Winner - AI Build Challenge</h3>
                <p className="text-sm sm:text-base leading-relaxed">
                  Cash prize, 1st Place Certificate of Merit, and fast-track mentorship opportunities.
                </p>
              </div>
            </div>
            <div className="p-5 sm:p-8 flex flex-col justify-between gap-4 sm:gap-10">
              <span className="display num text-[2.75rem] sm:text-6xl">2nd</span>
              <div className="space-y-1.5 sm:space-y-2">
                <h3 className="wide text-lg sm:text-xl font-semibold">Runner Up</h3>
                <p className="text-sm text-ink-2 leading-relaxed">
                  Cash prize, 2nd Place Certificate of Merit, and official recognition from NBKRIST IT &amp; AI&amp;DS department.
                </p>
              </div>
            </div>
            <div className="plane-navy p-5 sm:p-8 flex flex-col justify-between gap-4 sm:gap-10">
              <span className="display text-[2.75rem] sm:text-6xl">All</span>
              <div className="space-y-1.5 sm:space-y-2">
                <h3 className="wide text-lg sm:text-xl font-semibold">Participation Credentials</h3>
                <p className="text-sm text-[#d4d5d8] leading-relaxed">
                  Every verified participant receives a tamper-evident digital certificate with unique verification QR recognized by ISTE.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className={`${SECTION} pt-0 lg:pt-0`}>
        <div className={`${CONTAINER} grid gap-4 sm:gap-8 lg:grid-cols-12 lg:gap-12`}>
          <div className="lg:col-span-4 space-y-2 sm:space-y-4">
            <h2 className={H2}>Frequently asked questions</h2>
            <p className={`${INTRO} max-w-[48ch]`}>
              Everything you need to know about registration, payment and the workshop day.
            </p>
          </div>

          <div className="lg:col-span-8 frame bg-paper">
            {faqs.map((faq, index) => {
              const isOpen = faqOpen === index;
              const Icon = isOpen ? Minus : Plus;
              return (
                <div key={faq.q} className="border-b border-rule last:border-b-0">
                  <h3>
                    <button
                      type="button"
                      id={`faq-q-${index}`}
                      aria-expanded={isOpen}
                      aria-controls={`faq-a-${index}`}
                      onClick={() => setFaqOpen(isOpen ? null : index)}
                      className={`w-full min-h-12 sm:min-h-14 text-left px-4 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between gap-3 sm:gap-4 font-semibold sm:font-bold text-[0.9375rem] sm:text-base leading-snug sm:leading-normal transition-colors hover:bg-paper-2 ${isOpen ? "bg-paper-2" : ""}`}
                    >
                      <span className="text-balance">{faq.q}</span>
                      <span className={`shrink-0 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center border ${isOpen ? "bg-sky border-line text-on-accent" : "bg-paper border-line"}`}>
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      </span>
                    </button>
                  </h3>
                  {isOpen && (
                    <div
                      id={`faq-a-${index}`}
                      role="region"
                      aria-labelledby={`faq-q-${index}`}
                      className="px-4 sm:px-6 pb-4 sm:pb-5 pt-1 bg-paper-2 text-sm sm:text-base text-ink-2 leading-relaxed"
                    >
                      <p className="max-w-[70ch]">{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ VENUE & CLOSE ============ */}
      <section id="contact" className="px-4 sm:px-6 pb-0 sm:pb-16 lg:pb-24">
        <div className={CONTAINER}>
          <div className="planes grid-cols-1 gap-2.5 sm:gap-3 lg:grid-cols-12">
            <div className="lg:col-span-7 flex flex-col gap-px !bg-line">
              <div className="bg-paper px-5 py-4 sm:p-8 lg:p-10 space-y-3 sm:space-y-5 flex-1">
                <div className="cell-label">Campus venue</div>
                <h2 className={H2}>Seminar Hall-1, New CSE Block</h2>
                <p className={`${INTRO} max-w-[60ch]`}>
                  Equipped with high-definition projection, multi-directional audio, dedicated charging docks for student laptops, and high-speed campus Wi-Fi network.
                </p>
                <ul className="space-y-2 sm:space-y-3 text-[0.8125rem] sm:text-base">
                  <li className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-ink-2 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>N.B.K.R. Institute of Science &amp; Technology, Vidyanagar - 524413, Tirupati District, A.P.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-ink-2 shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="num">Wednesday, 30 September 2026 (9:00 AM – 4:00 PM)</span>
                  </li>
                </ul>
              </div>
              <div className="bg-paper grid grid-cols-[auto_minmax(0,1fr)] gap-px !bg-line">
                <div className="bg-paper p-3 flex items-center justify-center">
                  <div className="bg-white p-2">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrDataUrl} alt="Sample QR ticket" className="w-16 h-16 sm:w-24 sm:h-24" />
                  ) : (
                    <div className="w-16 h-16 sm:w-24 sm:h-24" aria-hidden="true" />
                  )}
                  </div>
                </div>
                <div className="bg-paper p-3.5 sm:p-5 space-y-1">
                  <div className="cell-label">
                    Sample ticket · <span className="font-mono normal-case tracking-normal">P2P-2026-00042</span>
                  </div>
                  <p className="text-[0.8125rem] sm:text-sm text-ink-2 leading-relaxed max-w-[56ch]">
                    After payment your QR ticket is generated with wallet and calendar reminders. Show it at the Seminar Hall-1 entrance.
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/register"
              className="plane-sky group lg:col-span-5 flex flex-col justify-between gap-4 sm:gap-10 p-5 sm:p-8 lg:p-10 sm:min-h-[18rem] transition-colors hover:!bg-[#ffd04d]"
            >
              <span className="space-y-2 sm:space-y-3 block">
                <span className="block wide text-lg sm:text-2xl font-semibold leading-tight">
                  Ready to build the future of AI?
                </span>
                <span className="block text-[0.8125rem] sm:text-base leading-relaxed max-w-[44ch]">
                  Limited to {eventConfig.capacity} students to ensure hands-on mentorship during the build challenge. Claim your seat before registration closes.
                </span>
              </span>
              <span className="flex items-end justify-between gap-4">
                <span className="display text-[2rem] sm:text-5xl">
                  Register now
                  <span className="block mt-1.5 sm:mt-2 text-lg sm:text-2xl num">₹{eventConfig.iste_fee} / ₹{eventConfig.non_iste_fee}</span>
                </span>
                <ArrowRight
                  className="w-8 h-8 sm:w-12 sm:h-12 shrink-0 stroke-[2.5] transition-transform duration-200 group-hover:translate-x-1.5"
                  aria-hidden="true"
                />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Floating Announcement Trigger Button positioned safely above MobileBottomNav */}
      {popupAnnouncement && !pillDismissed && (
        <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] left-3 sm:left-5 lg:bottom-6 lg:left-6 z-30 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="flex items-center gap-1.5 p-1 pl-3 pr-1.5 rounded-full shadow-[0_4px_24px_rgba(17,17,19,0.3)] bg-[#111113] text-white border border-neutral-700/80 backdrop-blur-md transition-all hover:border-neutral-500">
            <button
              type="button"
              onClick={() => setHomePopupOpen(true)}
              className="flex items-center gap-2 text-xs font-semibold hover:text-sun transition-colors text-left cursor-pointer"
              aria-label="View event announcement popup card"
            >
              <span className="w-2 h-2 rounded-full bg-sun shrink-0 animate-pulse" />
              <span className="truncate max-w-[130px] sm:max-w-[220px]">
                📢 {popupAnnouncement.title}
              </span>
              <span className="bg-sun text-ink px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0">
                View
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPillDismissed(true)}
              className="w-5 h-5 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors shrink-0 ml-0.5 cursor-pointer"
              aria-label="Dismiss announcement pill"
            >
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Home Page Announcement Popup Card */}
      <AnnouncementPopupCard
        announcement={popupAnnouncement}
        isOpen={homePopupOpen}
        onClose={() => setHomePopupOpen(false)}
        onDontShowToday={handleDontShowToday}
      />

    </div>
  );
}
