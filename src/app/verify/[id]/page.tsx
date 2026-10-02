"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, ArrowLeft, XCircle, Ban, Loader2, Download, Printer } from "lucide-react";
import { verifyCertificate } from "@/lib/store";
import { Certificate } from "@/lib/types";
import PaytmCertificate, { printCertificate, downloadCertificatePDF } from "@/components/PaytmCertificate";

const fmtIST = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

type VerifyState =
  | { status: "loading" }
  | { status: "valid"; cert: Certificate }
  | { status: "revoked" }
  | { status: "not_found" }
  | { status: "error"; message: string };

export default function VerifyCertificatePage() {
  const params = useParams();
  const certIdParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const [state, setState] = useState<VerifyState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!certIdParam) return;
    verifyCertificate(certIdParam)
      .then((res) => {
        if (cancelled) return;
        if (res.certificate) setState({ status: "valid", cert: res.certificate });
        else if (res.revoked) setState({ status: "revoked" });
        else setState({ status: "not_found" });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ status: "error", message: err instanceof Error ? err.message : "Verification failed." });
      });
    return () => {
      cancelled = true;
    };
  }, [certIdParam, attempt]);

  const view: VerifyState = certIdParam ? state : { status: "not_found" };
  const cert = view.status === "valid" ? view.cert : null;

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const filename = `${(cert?.participant_name || "certificate").trim().replace(/\s+/g, "_")}_Paytm_Certificate.pdf`;
      await downloadCertificatePDF(filename);
    } catch (err) {
      console.error("PDF download failed, falling back to print:", err);
      printCertificate();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex-1 min-h-[85vh] py-6 sm:py-10 px-3 sm:px-6 bg-field">
      {/* Container widened to max-w-5xl so landscape certificate has full room to shine */}
      <div className="max-w-5xl w-full mx-auto space-y-6">

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 min-h-11 text-sm font-bold text-ink-2 hover:text-ink transition-colors print:hidden"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Homepage</span>
        </Link>

        {view.status === "loading" && (
          <div className="frame bg-paper p-8 space-y-3 text-center print:hidden" role="status" aria-busy="true">
            <Loader2 className="w-8 h-8 text-ink-2 mx-auto animate-spin" aria-hidden="true" />
            <p className="text-sm text-ink-2">Verifying certificate...</p>
          </div>
        )}

        {view.status === "revoked" && (
          <div className="frame bg-paper p-8 space-y-4 text-center print:hidden">
            <Ban className="w-10 h-10 text-alert mx-auto" aria-hidden="true" />
            <h1 className="page-title text-ink">Certificate Revoked</h1>
            <span className="tag tag-alert">Not valid</span>
            <p className="text-sm text-ink-2">
              The certificate <span className="font-mono text-ink break-all">&quot;{certIdParam}&quot;</span> was issued
              but has since been revoked by the organizers. It is no longer a valid credential.
            </p>
          </div>
        )}

        {view.status === "error" && (
          <div className="frame bg-paper p-8 space-y-4 text-center print:hidden">
            <XCircle className="w-10 h-10 text-alert mx-auto" aria-hidden="true" />
            <h1 className="page-title text-ink">Could Not Verify</h1>
            <p role="alert" className="text-sm text-alert font-semibold">{view.status === "error" ? view.message : ""}</p>
            <button
              type="button"
              onClick={() => {
                setState({ status: "loading" });
                setAttempt((n) => n + 1);
              }}
              className="btn"
            >
              Try again
            </button>
          </div>
        )}

        {(view.status === "valid" || view.status === "not_found") && (
          cert ? (
            <div className="space-y-6">

              {/* Verification result header */}
              <header className="frame bg-paper px-5 py-5 sm:px-6 flex items-start justify-between gap-4 flex-wrap print:hidden">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-8 h-8 text-ok flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1">
                    <h1 className="page-title text-ink">Official Certificate Verified</h1>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tag tag-ok">
                        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        Verified Against Official Records
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    disabled={downloading}
                    className="btn btn-primary btn-sm flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{downloading ? "Preparing PDF..." : "Download PDF"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={printCertificate}
                    className="btn btn-sm flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Print</span>
                  </button>
                </div>
              </header>

              {/* Official Certificate Render in Responsive Landscape */}
              <PaytmCertificate
                participantName={cert.participant_name}
                dateStr="30-09-2026"
                certificateId={cert.certificate_id}
              />

              {/* Verified Details Card */}
              <div className="frame bg-paper p-5 space-y-4 print:hidden">
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider font-bold text-ink-3">Participant</dt>
                    <dd className="font-semibold text-sm mt-0.5 text-ink break-words">{cert.participant_name}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider font-bold text-ink-3">Roll Number</dt>
                    <dd className="font-mono font-bold text-sm mt-0.5 text-ink break-all">{cert.roll_number || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider font-bold text-ink-3">Credential ID</dt>
                    <dd className="font-mono font-bold text-sm mt-0.5 text-accent break-all">{cert.certificate_id}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider font-bold text-ink-3">Event Date</dt>
                    <dd className="font-bold text-sm mt-0.5 text-ink">30-09-2026</dd>
                  </div>
                </dl>

                <div className="border-t border-line pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-ink-3">
                  <span>Authentic credential issued for Paytm AI Workshop &amp; NBKRIST. Issued: {fmtIST(cert.issue_date)}.</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadPDF}
                      disabled={downloading}
                      className="btn btn-sm"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Download PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={printCertificate}
                      className="btn btn-sm"
                    >
                      <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Print</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="frame bg-paper p-8 space-y-4 text-center print:hidden">
              <XCircle className="w-10 h-10 text-alert mx-auto" aria-hidden="true" />
              <h1 className="page-title text-ink">Certificate Not Found</h1>
              <span className="tag tag-alert">Not verified</span>
              <p className="text-sm text-ink-2">
                No certificate found with ID <span className="font-mono text-ink break-all">&quot;{certIdParam}&quot;</span>. Please verify the link or QR code scanned.
              </p>
            </div>
          )
        )}

      </div>
    </div>
  );
}
