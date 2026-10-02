"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Mic, ArrowRight, Ticket } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { role, isAuthenticated } = useAuth();

  // Only on public pages: app areas have their own section rail, and form flows need the space
  if (
    pathname.startsWith("/register") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/coordinator") ||
    pathname.startsWith("/admin")
  ) {
    return null;
  }

  const dashboardHref = role === "admin" ? "/admin" : role === "coordinator" ? "/coordinator" : "/dashboard";

  const links = [
    { name: "Home", href: "/", icon: Home, active: pathname === "/" },
    { name: "Schedule", href: "/#schedule", icon: Calendar, active: false },
    { name: "Speakers", href: "/#speakers", icon: Mic, active: false },
  ];

  const primary = isAuthenticated
    ? { name: role === "user" ? "My pass" : "Dashboard", href: dashboardHref, icon: Ticket }
    : { name: "Register", href: "/register", icon: ArrowRight };
  const PrimaryIcon = primary.icon;

  return (
    <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none print:hidden">
      <nav
        aria-label="Quick navigation"
        className="pointer-events-auto mx-auto max-w-md flex items-center gap-1 p-1.5 rounded-full bg-paper border border-line shadow-[0_2px_4px_rgba(17,17,19,0.05),0_18px_40px_-18px_rgba(17,17,19,0.35)]"
      >
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`flex-1 min-h-11 flex flex-col items-center justify-center rounded-full text-[0.6875rem] transition-colors ${
                item.active ? "text-ink font-semibold bg-paper-2" : "text-ink-3 hover:text-ink"
              }`}
            >
              <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
              {item.name}
            </Link>
          );
        })}
        <Link
          href={primary.href}
          className="flex-[1.4] min-h-11 inline-flex items-center justify-center gap-1.5 rounded-full bg-ink text-white text-sm font-medium active:scale-[0.98] transition-transform"
        >
          {primary.name}
          <PrimaryIcon className="w-4 h-4" aria-hidden="true" />
        </Link>
      </nav>
    </div>
  );
}
