"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, LayoutDashboard, LogOut, Menu, UserRound, X } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { useAuth } from "@/lib/context/AuthContext";
import { UserRole } from "@/lib/types";
import { useStore } from "@/lib/store";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { role, isAuthenticated, currentUser, logout, loading } = useAuth();
  const { eventConfig } = useStore();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await logout();
      setMobileMenuOpen(false);
      router.push("/");
    } finally {
      setSigningOut(false);
    }
  };

  const { permissions } = useAuth();
  const can = (perm: string) => role === "admin" || permissions.includes(perm as never);

  // Each role sees its own workspace; visitors see the event site.
  const navLinks: { name: string; href: string }[] =
    role === "admin"
      ? [
          { name: "Console", href: "/admin" },
          { name: "Participants", href: "/admin/participants" },
          { name: "Payments", href: "/admin/payments" },
          { name: "Check-in", href: "/coordinator/checkin" },
          { name: "Judging", href: "/admin/submissions" },
          { name: "Certificates", href: "/admin/certificates" },
        ]
      : role === "coordinator"
        ? [
            { name: "Overview", href: "/coordinator" },
            ...(can("CHECKIN_MANAGE") ? [{ name: "Check-in", href: "/coordinator/checkin" }] : []),
            ...(can("REGISTRATION_VERIFY") ? [{ name: "Verify payments", href: "/coordinator/verify" }] : []),
            ...(can("PARTICIPANT_VIEW") ? [{ name: "Roster", href: "/coordinator/participants" }] : []),
            ...(can("SUPPORT_VIEW") || can("SUPPORT_REPLY") ? [{ name: "Support", href: "/coordinator/support" }] : []),
          ]
        : role === "user"
          ? [
              { name: "My ticket", href: "/dashboard" },
              { name: "Team", href: "/dashboard/team" },
              { name: "Submission", href: "/dashboard/submission" },
              { name: "Schedule", href: "/dashboard/schedule" },
              { name: "Certificate", href: "/dashboard/certificate" },
              { name: "Rules", href: "/rules" },
            ]
          : [
              { name: "Home", href: "/" },
              { name: "Workshop", href: "/#about" },
              { name: "Speakers", href: "/#speakers" },
              { name: "Schedule", href: "/#schedule" },
              { name: "Rules", href: "/rules" },
              { name: "FAQ", href: "/#faq" },
            ];
  const isStaff = role === "admin" || role === "coordinator";
  const inConsole = isStaff && (pathname.startsWith("/admin") || pathname.startsWith("/coordinator"));
  const navShow = inConsole ? "hidden" : isStaff ? "2xl:flex" : "lg:flex";
  const menuHide = inConsole || !isStaff ? "lg:hidden" : "2xl:hidden";
  const isActive = (href: string) =>
    href === pathname || (!href.includes("#") && href !== "/" && ["/admin", "/coordinator", "/dashboard"].indexOf(href) === -1 && pathname.startsWith(href + "/"));

  const getDashboardHref = () => {
    if (role === "admin") return "/admin";
    if (role === "coordinator") return "/coordinator";
    return "/dashboard";
  };

  const getRoleLabel = (r: UserRole | null) => {
    if (r === "admin") return "Admin";
    if (r === "coordinator") return "Coordinator";
    return "Participant";
  };

  const roleLabel = getRoleLabel(role);

  return (
    <header className="sticky top-0 z-40 w-full bg-paper rule-b print:hidden">
      <div className={`${inConsole ? "max-w-none" : "max-w-[1280px]"} mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[4.5rem] flex items-center justify-between gap-4`}>
        {/* Brand lockup */}
        <Link href="/" className="flex items-center gap-3 min-w-0 group" aria-label="Prompt to Production, home">
          <LogoMark className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 transition-transform duration-300 group-hover:-rotate-3" />
          <span className="min-w-0 leading-tight">
            <span className="block wide font-semibold text-sm sm:text-base tracking-tight text-ink truncate group-hover:underline underline-offset-4 decoration-2">
              Prompt to Production
            </span>
            <span className="block text-xs text-ink-3 truncate">
              NBKRIST × ISTE × <span className="font-bold"><span className="text-paytm">Pay</span><span className="text-paytm-sky">tm</span></span>
            </span>
          </span>
        </Link>

        {/* Desktop rail */}
        <nav className={`hidden ${navShow} items-stretch self-stretch`} aria-label="Main">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className="rail-item h-full"
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {loading ? (
            <div className="hidden sm:block h-9 w-40 bg-paper-2" aria-hidden="true" />
          ) : isAuthenticated ? (
            <AccountMenu
              name={currentUser?.name || roleLabel}
              email={currentUser?.email}
              roleLabel={roleLabel}
              homeHref={getDashboardHref()}
              homeLabel={role === "user" ? "My dashboard" : role === "admin" ? "Admin console" : "Coordinator console"}
              profileHref={role === "user" ? "/dashboard/profile" : undefined}
              onSignOut={handleLogout}
              signingOut={signingOut}
            />
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link href="/login" className="btn btn-sm">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Register
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`${menuHide} btn w-11 !px-0`}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-drawer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer: a white plane under the bar */}
      {mobileMenuOpen && (
        <div id="mobile-drawer" className={`${menuHide} absolute inset-x-0 top-full z-50 h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain bg-paper rule-t pb-10`}>
          <nav aria-label="Mobile">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={isActive(link.href) ? "page" : undefined}
                className="flex items-center justify-between min-h-12 px-4 sm:px-6 border-b border-rule font-semibold text-ink hover:bg-paper-2 transition-colors aria-[current=page]:font-semibold aria-[current=page]:bg-paper-2"
              >
                {link.name}
                <ArrowRight className="w-4 h-4 text-ink-3" aria-hidden="true" />
              </Link>
            ))}
          </nav>

          <div className="rule-t p-4 sm:px-6">
            {isAuthenticated ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-ink truncate">{currentUser?.name || "Participant"}</div>
                    <span className="tag tag-info mt-1">{roleLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={signingOut}
                    aria-busy={signingOut}
                    className="btn btn-quiet btn-sm min-h-11"
                  >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
                <Link
                  href={getDashboardHref()}
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-navy w-full"
                >
                  Open dashboard
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="btn">
                  Sign in
                </Link>
                <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="btn btn-primary">
                  Register (₹{eventConfig.iste_fee}/₹{eventConfig.non_iste_fee})
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

/** Name button with a dropdown: who you are, where your workspace is, and sign out. */
function AccountMenu({
  name, email, roleLabel, homeHref, homeLabel, profileHref, onSignOut, signingOut,
}: {
  name: string; email?: string; roleLabel: string; homeHref: string; homeLabel: string;
  profileHref?: string; onSignOut: () => void; signingOut: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const words = name.replace(/\(.*?\)/g, "").replace(/^(Sri|Dr|Mr|Mrs|Ms)\.\s*/i, "").split(/[^A-Za-z]+/).filter(Boolean);
  const initials = ((words[0]?.[0] ?? "?") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-ink hover:bg-paper-2 transition-colors";
  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-full border border-line bg-paper py-1 pl-1 pr-3 text-sm transition-colors hover:border-ink-3"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{initials}</span>
        <span className="max-w-[11rem] truncate font-medium text-ink">{name}</span>
        <ChevronDown className={`h-4 w-4 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-line bg-paper p-1.5 shadow-[0_2px_4px_rgba(17,17,19,0.05),0_20px_44px_-18px_rgba(17,17,19,0.3)]">
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            {email && <p className="truncate text-xs text-ink-3">{email}</p>}
            <span className="tag tag-info mt-2">{roleLabel}</span>
          </div>
          <div className="my-1 h-px bg-rule" />
          <Link role="menuitem" href={homeHref} onClick={() => setOpen(false)} className={item}>
            <LayoutDashboard className="h-4 w-4 text-ink-3" aria-hidden="true" /> {homeLabel}
          </Link>
          {profileHref && (
            <Link role="menuitem" href={profileHref} onClick={() => setOpen(false)} className={item}>
              <UserRound className="h-4 w-4 text-ink-3" aria-hidden="true" /> My profile
            </Link>
          )}
          <div className="my-1 h-px bg-rule" />
          <button role="menuitem" type="button" onClick={() => { setOpen(false); onSignOut(); }} disabled={signingOut} className={`${item} text-alert hover:bg-alert-soft`}>
            <LogOut className="h-4 w-4" aria-hidden="true" /> {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
