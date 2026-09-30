import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/context/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BroadcastBanner from "@/components/BroadcastBanner";
import MobileBottomNav from "@/components/MobileBottomNav";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const serif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Prompt to Production | Paytm AI Workshop – NBKRIST",
  description:
    "Official event platform for 'Prompt to Production' Paytm AI Workshop, organized by Department of IT & AI&DS, N.B.K.R. Institute of Science & Technology in association with ISTE. 30 September 2026.",
  keywords: [
    "Prompt to Production",
    "Paytm AI Workshop",
    "NBKRIST",
    "ISTE",
    "Generative AI",
    "Prompt Engineering",
    "AI Workshop 2026",
    "Vidyanagar",
  ],
  authors: [{ name: "NBKRIST IT & AI&DS" }],
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-field text-ink font-sans">
        <AuthProvider>
          <BroadcastBanner />
          <Navbar />
          <main className="flex-1 flex flex-col">{children}</main>
          <Footer />
          <MobileBottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
