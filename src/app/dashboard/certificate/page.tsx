"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Award, Printer, ExternalLink, Check, X, Download } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { useStore } from "@/lib/store";
import { Certificate } from "@/lib/types";
import { generateQrDataUrl } from "@/lib/qr";
import PaytmCertificate, { printCertificate, downloadCertificatePDF } from "@/components/PaytmCertificate";

const fmtIST = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });

function certLabel(c: Certificate): string {
  switch (c.type) {
    case "winner":
      return `Merit (${c.rank || "1st Place"})`;
    case "runner_up":
      return `Merit (${c.rank || "2nd Place"})`;
    case "merit":
      return c.rank ? `Merit (${c.rank})` : "Merit";
    default:
      return "Participation";
  }
}

export default function CertificatePage() {
  const { currentProfile, currentUser, currentRegistration: reg } = useAuth();
  const store = useStore();
  const { eventConfig } = store;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [now] = useState(() => Date.now());
  const [downloading, setDownloading] = useState(false);

  const name = currentProfile?.certificate_name || currentUser?.name || "";

  // Merit first, then participation
  const certificates = (reg ? store.certificates.filter((c) => c.registration_id === reg.id && c.status === "issued") : [])
    .slice()
    .sort((a, b) => Number(a.type === "participation") - Number(b.type === "participation"));
  const certificate = certificates.find((c) => c.certificate_id === selectedId) ?? certificates[0] ?? null;
  const certificateId = certificate?.certificate_id;

  useEffect(() => {
    if (!certificateId) return;
    let cancelled = false;
    generateQrDataUrl(`${window.location.origin}/verify/${certificateId}`).then((url) => {
      if (!cancelled) setQrUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [certificateId]);

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const filename = `${(certificate?.participant_name || name || "certificate").trim().replace(/\s+/g, "_")}_Paytm_Certificate.pdf`;
      await downloadCertificatePDF(filename);
    } catch (err) {
      console.error("PDF generation fallback to print:", err);
      printCertificate();
    } finally {
      setDownloading(false);
    }
  };

  const certType = certificate ? certLabel(certificate) : "";

  // Eligibility, from the participant's own records
  const paymentVerified = !!reg && reg.registration_status === "confirmed" && reg.payment_status === "success";
  const checkIn = reg
    ? store.attendance.find((a) => a.registration_number === reg.registration_number && a.status === "checked_in")
    : undefined;
  const endAt = eventConfig.event_end_at;
  const eventEnded = !!endAt && now >= new Date(endAt).getTime();
  const conditions = [
    {
      ok: paymentVerified,
      label: "Payment verified",
      detail: paymentVerified
        ? "Your registration is confirmed."
        : reg?.payment_status === "failed"
          ? "Your payment was rejected. Resubmit it from the overview page."
          : reg
            ? "Your payment is still under verification."
            : "No registration found for your account.",
    },
    {
      ok: !!checkIn,
      label: "Checked in at the venue",
      detail: checkIn
        ? `Checked in ${checkIn.check_in_at ? fmtIST(checkIn.check_in_at) : checkIn.check_in_time}.`
        : "Show your ticket QR at the entrance on the event day.",
    },
    {
      ok: eventEnded,
      label: "Event has ended",
      detail: endAt
        ? eventEnded
          ? `The event ended ${fmtIST(endAt)}.`
          : `Certificates are issued after ${fmtIST(endAt)}.`
        : "The organisers have not announced the end time yet.",
    },
  ];
  const allMet = conditions.every((c) => c.ok);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="frame bg-paper px-5 py-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="page-title text-ink">Official Certificate</h1>
          <p className="text-sm text-ink-2 mt-2">
            Certified by N.B.K.R. Institute of Science &amp; Technology in association with ISTE.
          </p>
        </div>

        {certificate && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="btn btn-primary flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>{downloading ? "Generating PDF..." : "Download PDF"}</span>
            </button>
            <button
              onClick={printCertificate}
              className="btn flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" aria-hidden="true" />
              <span>Print</span>
            </button>
          </div>
        )}
      </header>

      {certificates.length > 1 && (
        <div role="group" aria-label="Your certificates" className="frame bg-paper flex overflow-x-auto px-1 print:hidden">
          {certificates.map((c) => (
            <button
              key={c.certificate_id}
              onClick={() => setSelectedId(c.certificate_id)}
              data-active={certificate?.certificate_id === c.certificate_id ? "true" : undefined}
              aria-pressed={certificate?.certificate_id === c.certificate_id}
              className="rail-item shrink-0"
            >
              {certLabel(c)}
            </button>
          ))}
        </div>
      )}

      {certificate ? (
        <div className="space-y-4">
          <PaytmCertificate
            participantName={certificate.participant_name || name || "Student Name"}
            dateStr="30-09-2026"
            certificateId={certificate.certificate_id}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-2 bg-field p-3 rounded-lg border border-line print:hidden">
            <span className="font-mono">
              Certificate ID: <strong className="text-ink">{certificate.certificate_id}</strong>
            </span>
            <Link
              href={certificate.verification_url || `/verify/${certificate.certificate_id}`}
              target="_blank"
              className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
            >
              <span>Public Verification Link</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="frame bg-paper">
          <div className="p-8 text-center space-y-3">
            <Award className="w-10 h-10 text-ink-3 mx-auto" aria-hidden="true" />
            <h2 className="text-xl font-semibold wide text-ink">Certificate Pending</h2>
            <span className={`tag ${allMet ? "tag-ok" : "tag-pending"}`}>
              {allMet ? "Eligible · awaiting issue" : "Not yet eligible"}
            </span>
            <p className="text-sm text-ink-2 max-w-md mx-auto">
              Participation certificates go to everyone whose payment was verified and who checked in at the venue.
              The organisers issue them after the event ends; merit certificates go to the 1st and 2nd placed teams.
            </p>
          </div>
          <ul className="rule-t divide-y divide-rule px-5 sm:px-6" aria-label="Eligibility">
            {conditions.map((c) => (
              <li key={c.label} className="py-3 flex items-start gap-3">
                <span
                  className={`w-6 h-6 flex items-center justify-center flex-shrink-0 border ${c.ok ? "border-ok bg-ok-soft text-ok" : "border-line bg-field text-ink-3"}`}
                  aria-hidden="true"
                >
                  {c.ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">
                    {c.label}
                    <span className="sr-only">{c.ok ? ": met" : ": not met"}</span>
                  </p>
                  <p className="text-sm text-ink-2">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="rule-t px-5 py-4 sm:px-6 text-sm text-ink-2">
            {allMet
              ? "You meet every condition. Your certificate appears here once the organisers issue certificates."
              : "Certificates appear here automatically once issued."}{" "}
            Questions? Contact the{" "}
            <Link href="/dashboard/support" className="font-bold text-ink underline decoration-2 underline-offset-4">support desk</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
