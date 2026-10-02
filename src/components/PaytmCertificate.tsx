"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import Script from "next/script";

interface PaytmCertificateProps {
  participantName: string;
  dateStr?: string;
  certificateId?: string;
  className?: string;
}

/** Helper function to print only the certificate in exact A4 landscape (strictly 1 page) */
export function printCertificate() {
  if (typeof document === "undefined") return;

  const nameText = document.getElementById("name-text")?.textContent?.trim() || "Student Name";
  const dateText = document.getElementById("date-text")?.textContent?.trim() || "30-09-2026";

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    window.print();
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Paytm Certificate - ${nameText}</title>
  <style>
    @font-face {
      font-family: 'Poppins';
      font-weight: 400;
      font-style: normal;
      src: url('/fonts/Poppins-Regular.ttf') format('truetype');
    }
    @font-face {
      font-family: 'Poppins';
      font-weight: 700;
      font-style: normal;
      src: url('/fonts/Poppins-Bold.ttf') format('truetype');
    }
    @page {
      size: A4 landscape;
      margin: 0;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 297mm;
      height: 210mm;
      overflow: hidden;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #certificate {
      position: relative;
      width: 297mm;
      height: 210mm;
      background-image: url('/images/paytm_certificate_bg.jpg');
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #name-field {
      position: absolute;
      left: 20%;
      width: 60%;
      top: 39.5%;
      height: 7%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
    }
    #name-field span {
      font-family: 'Poppins', sans-serif;
      font-weight: 700;
      font-size: 12mm;
      line-height: 1;
      color: #0e2266;
      letter-spacing: 0.3px;
      text-align: center;
      white-space: nowrap;
      display: inline-block;
    }
    #date-field {
      position: absolute;
      left: 12%;
      width: 14%;
      top: 84.8%;
      height: 5%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
    }
    #date-field span {
      font-family: 'Poppins', sans-serif;
      font-weight: 400;
      font-size: 6.2mm;
      line-height: 1;
      color: #171719;
      white-space: nowrap;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div id="certificate">
    <div id="name-field"><span id="name-text">${nameText}</span></div>
    <div id="date-field"><span id="date-text">${dateText}</span></div>
  </div>
  <script>
    function fitNameToBox() {
      const nameField = document.getElementById('name-field');
      const nameText = document.getElementById('name-text');
      if (!nameField || !nameText) return;
      const boxWidth = nameField.clientWidth - 6;
      let fontSize = 12;
      nameText.style.fontSize = fontSize + 'mm';
      while (nameText.scrollWidth > boxWidth && fontSize > 5) {
        fontSize -= 0.25;
        nameText.style.fontSize = fontSize + 'mm';
      }
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fitNameToBox);
    } else {
      window.onload = fitNameToBox;
    }
  </script>
</body>
</html>`);
  doc.close();

  let printed = false;
  const triggerPrint = async () => {
    if (printed) return;
    printed = true;
    try {
      if (iframe.contentWindow?.document?.fonts?.ready) {
        await iframe.contentWindow.document.fonts.ready;
      }
      await new Promise((r) => setTimeout(r, 200));
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    } finally {
      setTimeout(() => {
        iframe.remove();
      }, 3000);
    }
  };

  iframe.onload = triggerPrint;
  setTimeout(triggerPrint, 600);
}

/** Helper function to download PDF at full 1:1 A4 landscape scale with perfect alignment */
export async function downloadCertificatePDF(filename: string = "Paytm_Certificate.pdf") {
  if (typeof window === "undefined") return;

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const el = document.getElementById("certificate");
  const scaleBox = document.getElementById("certificate-scale-box");
  if (!el) {
    printCertificate();
    return;
  }

  const html2pdf = (window as unknown as { html2pdf: () => any }).html2pdf;
  if (typeof html2pdf !== "function") {
    printCertificate();
    return;
  }

  // 1. Temporarily reset screen scale so html2canvas captures at exact native unscaled 1:1 A4 landscape (297mm x 210mm)
  const prevTransform = el.style.transform;
  const prevTransformOrigin = el.style.transformOrigin;
  const prevBoxWidth = scaleBox ? scaleBox.style.width : "";
  const prevBoxHeight = scaleBox ? scaleBox.style.height : "";
  const prevBoxOverflow = scaleBox ? scaleBox.style.overflow : "";

  el.style.transform = "none";
  el.style.transformOrigin = "initial";
  if (scaleBox) {
    scaleBox.style.width = "297mm";
    scaleBox.style.height = "210mm";
    scaleBox.style.overflow = "visible";
  }

  // Recalculate font size at unscaled 1:1 dimensions matching template exactly
  const nameField = document.getElementById("name-field");
  const nameText = document.getElementById("name-text");
  if (nameField && nameText) {
    const boxWidth = nameField.clientWidth - 6;
    let fontSize = 12;
    nameText.style.fontSize = fontSize + "mm";
    while (nameText.scrollWidth > boxWidth && fontSize > 5) {
      fontSize -= 0.25;
      nameText.style.fontSize = fontSize + "mm";
    }
  }

  // Allow browser two frames to apply 1:1 paint before capture
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const opt = {
      margin: 0,
      filename: filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 3,
        useCORS: true,
        letterRendering: true,
        scrollX: 0,
        scrollY: 0,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    };

    await html2pdf().set(opt).from(el).save();
  } catch (err) {
    console.error("PDF generation failed:", err);
    printCertificate();
  } finally {
    // 2. Restore screen scale
    el.style.transform = prevTransform;
    el.style.transformOrigin = prevTransformOrigin;
    if (scaleBox) {
      scaleBox.style.width = prevBoxWidth;
      scaleBox.style.height = prevBoxHeight;
      scaleBox.style.overflow = prevBoxOverflow;
    }

    if (nameField && nameText) {
      const boxWidth = nameField.clientWidth - 6;
      let fontSize = 12;
      nameText.style.fontSize = fontSize + "mm";
      while (nameText.scrollWidth > boxWidth && fontSize > 5) {
        fontSize -= 0.25;
        nameText.style.fontSize = fontSize + "mm";
      }
    }
  }
}

export default function PaytmCertificate({
  participantName,
  dateStr = "30-09-2026",
  certificateId,
  className = "",
}: PaytmCertificateProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const nameFieldRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Format date to DD-MM-YYYY strictly matching the workshop event happened date format
  const formatDate = (rawDate?: string): string => {
    if (!rawDate) return "30-09-2026";
    const trimmed = rawDate.trim();
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      return trimmed;
    }
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return "30-09-2026";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formattedDate = formatDate(dateStr);
  const displayName = (participantName || "Student Name").trim();

  // Responsive scale calculator: ensures full landscape aspect ratio (297:210) fits any container cleanly
  useEffect(() => {
    const handleResize = () => {
      if (!wrapperRef.current) return;
      const containerWidth = wrapperRef.current.clientWidth;
      if (containerWidth > 0) {
        // 297mm at standard 96 DPI screen resolution = 1122.52px
        const baseWidth = 1122.52;
        const newScale = Math.min(1, containerWidth / baseWidth);
        setScale(newScale);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Name field auto-fit algorithm from the template
  const fitNameToBox = useCallback(() => {
    if (!nameRef.current || !nameFieldRef.current) return;
    const boxWidth = nameFieldRef.current.clientWidth - 6;
    let fontSize = 12; // starting max font size: 12mm
    nameRef.current.style.fontSize = fontSize + "mm";

    while (nameRef.current.scrollWidth > boxWidth && fontSize > 5) {
      fontSize -= 0.25;
      nameRef.current.style.fontSize = fontSize + "mm";
    }
  }, []);

  useEffect(() => {
    fitNameToBox();
    if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fitNameToBox);
    }
  }, [displayName, fitNameToBox]);

  return (
    <>
      <Script src="/js/html2pdf.bundle.min.js" strategy="afterInteractive" />

      {/* Embedded Standard CSS for Certificate */}
      <style>{`
        @font-face {
          font-family: "Poppins";
          font-weight: 400;
          font-style: normal;
          src: url("/fonts/Poppins-Regular.ttf") format("truetype");
        }
        @font-face {
          font-family: "Poppins";
          font-weight: 700;
          font-style: normal;
          src: url("/fonts/Poppins-Bold.ttf") format("truetype");
        }

        #certificate {
          position: relative;
          width: 297mm;
          height: 210mm;
          background-image: url("/images/paytm_certificate_bg.jpg");
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-sizing: border-box;
          user-select: none;
        }

        #name-field {
          position: absolute;
          left: 20%;
          width: 60%;
          top: 39.5%;
          height: 7%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: visible;
        }
        #name-field span {
          font-family: "Poppins", sans-serif;
          font-weight: 700;
          font-size: 12mm;
          line-height: 1;
          color: #0e2266;
          letter-spacing: 0.3px;
          text-align: center;
          white-space: nowrap;
          display: inline-block;
        }

        #date-field {
          position: absolute;
          left: 12%;
          width: 14%;
          top: 84.8%;
          height: 5%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: visible;
        }
        #date-field span {
          font-family: "Poppins", sans-serif;
          font-weight: 400;
          font-size: 6.2mm;
          line-height: 1;
          color: #171719;
          white-space: nowrap;
          display: inline-block;
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          html, body {
            width: 297mm !important;
            height: 210mm !important;
            max-height: 210mm !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #certificate-wrapper, #certificate-wrapper * {
            visibility: visible !important;
          }
          #certificate-wrapper {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            z-index: 99999 !important;
          }
          #certificate-scale-box {
            width: 297mm !important;
            height: 210mm !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            transform: none !important;
          }
          #certificate {
            transform: none !important;
            box-shadow: none !important;
            border: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}</style>

      {/* Screen container: perfectly scales the 297mm landscape certificate to fit any screen without clipping */}
      <div
        id="certificate-wrapper"
        ref={wrapperRef}
        className={`w-full flex justify-center py-2 sm:py-4 ${className}`}
      >
        <div
          id="certificate-scale-box"
          style={{
            width: `${Math.round(scale * 1122.52)}px`,
            height: `${Math.round(scale * 793.7)}px`,
            position: "relative",
            overflow: "hidden",
            borderRadius: "12px",
            boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div
            id="certificate"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <div id="name-field" ref={nameFieldRef}>
              <span id="name-text" ref={nameRef}>
                {displayName}
              </span>
            </div>
            <div id="date-field">
              <span id="date-text">{formattedDate}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
