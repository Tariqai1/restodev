"use client";

import { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { getTableAccessCode } from "@/lib/utils/table-code";

export type ShareMenuTable = {
  id: string;
  table_number: string;
  qr_token: string;
};

type ShareMenuModalProps = {
  isOpen: boolean;
  onClose: () => void;
  restaurantName: string;
  tables: ShareMenuTable[];
  defaultTableId?: string;
};

export type StandeeTheme = "midnight" | "royal" | "ivory" | "emerald";

interface ThemeConfig {
  id: StandeeTheme;
  name: string;
  subtitle: string;
  bgGradient: string;
  cardBg: string;
  textColor: string;
  accentColor: string;
  subtextColor: string;
  pillBg: string;
  pillText: string;
  qrPlateBorder: string;
  qrDark: string;
  qrLight: string;
  badgeBg: string;
  badgeText: string;
}

const THEMES: Record<StandeeTheme, ThemeConfig> = {
  midnight: {
    id: "midnight",
    name: "Midnight Gold",
    subtitle: "5-Star Onyx & Warm Gold",
    bgGradient: "bg-slate-950",
    cardBg: "#0B0F19",
    textColor: "#FFFFFF",
    accentColor: "#F59E0B",
    subtextColor: "#94A3B8",
    pillBg: "#F59E0B",
    pillText: "#0F172A",
    qrPlateBorder: "#F59E0B",
    qrDark: "#0B0F19",
    qrLight: "#FFFFFF",
    badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    badgeText: "text-amber-400",
  },
  royal: {
    id: "royal",
    name: "Royal Purple",
    subtitle: "Modern Enterprise Violet",
    bgGradient: "bg-gradient-to-br from-purple-950 via-indigo-950 to-slate-950",
    cardBg: "#2E1065",
    textColor: "#FFFFFF",
    accentColor: "#C084FC",
    subtextColor: "#DDD6FE",
    pillBg: "#7C3AED",
    pillText: "#FFFFFF",
    qrPlateBorder: "#A855F7",
    qrDark: "#2E1065",
    qrLight: "#FFFFFF",
    badgeBg: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    badgeText: "text-purple-400",
  },
  ivory: {
    id: "ivory",
    name: "Classic Ivory",
    subtitle: "Pristine Minimalist White",
    bgGradient: "bg-white",
    cardBg: "#FFFFFF",
    textColor: "#0F172A",
    accentColor: "#7C3AED",
    subtextColor: "#64748B",
    pillBg: "#0F172A",
    pillText: "#FFFFFF",
    qrPlateBorder: "#E2E8F0",
    qrDark: "#0F172A",
    qrLight: "#FFFFFF",
    badgeBg: "bg-slate-100 text-slate-800 border-slate-300",
    badgeText: "text-slate-900",
  },
  emerald: {
    id: "emerald",
    name: "Emerald Luxe",
    subtitle: "Fine Dining Forest Green",
    bgGradient: "bg-[#064E3B]",
    cardBg: "#064E3B",
    textColor: "#FFFFFF",
    accentColor: "#34D399",
    subtextColor: "#A7F3D0",
    pillBg: "#059669",
    pillText: "#FFFFFF",
    qrPlateBorder: "#10B981",
    qrDark: "#064E3B",
    qrLight: "#FFFFFF",
    badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    badgeText: "text-emerald-400",
  },
};

export default function ShareMenuModal({
  isOpen,
  onClose,
  restaurantName,
  tables = [],
  defaultTableId,
}: ShareMenuModalProps) {
  const [selectedTableIndex, setSelectedTableIndex] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState<StandeeTheme>("midnight");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [isGeneratingDownload, setIsGeneratingDownload] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // Sync default table if provided
  useEffect(() => {
    if (defaultTableId && tables.length > 0) {
      const idx = tables.findIndex((t) => t.id === defaultTableId);
      if (idx !== -1) setSelectedTableIndex(idx);
    } else {
      setSelectedTableIndex(0);
    }
  }, [defaultTableId, tables]);

  const activeTable: ShareMenuTable | undefined = tables[selectedTableIndex] || tables[0];
  const activeToken = activeTable?.qr_token || "sample-table-token";
  const activeTableNum = activeTable?.table_number || "01";
  const customerMenuUrl = origin ? `${origin}/table/${activeToken}` : `/table/${activeToken}`;
  const accessCode = getTableAccessCode(activeToken);

  const themeConfig = THEMES[selectedTheme];

  // Generate crisp QR Code
  useEffect(() => {
    if (!isOpen || !customerMenuUrl) return;
    let isMounted = true;

    QRCode.toDataURL(customerMenuUrl, {
      width: 460,
      margin: 2,
      errorCorrectionLevel: "H",
      color: {
        dark: themeConfig.qrDark,
        light: themeConfig.qrLight,
      },
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error("Failed to generate QR code:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, customerMenuUrl, selectedTheme, themeConfig]);

  if (!isOpen) return null;

  async function handleCopy() {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(customerMenuUrl);
      } else {
        const input = document.createElement("input");
        input.value = customerMenuUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(15);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  }

  function handleWhatsAppShare() {
    const text = `🍽️ *${restaurantName || "Order Desk"}* - Table ${activeTableNum} Digital Menu\n\nScan or click to browse dishes, chef specials, and order straight from your mobile:\n🔗 ${customerMenuUrl}\n\n✨ Instant live kitchen tracking • No app installation needed!`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  }

  function handlePreviewCustomerView() {
    window.open(customerMenuUrl, "_blank");
  }

  function handlePrintStandee() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  function handleDownloadRawQr() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${(restaurantName || "restaurant").toLowerCase().replace(/\s+/g, "_")}_table_${activeTableNum}_qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleDownloadStandeeCard() {
    if (!qrDataUrl || isGeneratingDownload) return;
    setIsGeneratingDownload(true);

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setIsGeneratingDownload(false);
        return;
      }

      const width = 1000;
      const height = 1500;
      canvas.width = width;
      canvas.height = height;

      const t = themeConfig;

      // 1. Draw Card Background
      ctx.fillStyle = t.cardBg;
      ctx.fillRect(0, 0, width, height);

      // 2. Draw Outer & Inner Gold/Accent Border
      ctx.strokeStyle = t.accentColor;
      ctx.lineWidth = 6;
      ctx.strokeRect(36, 36, width - 72, height - 72);

      ctx.strokeStyle = t.accentColor + "33";
      ctx.lineWidth = 2;
      ctx.strokeRect(48, 48, width - 96, height - 96);

      // Corner decorative squares
      const cornerSize = 16;
      ctx.fillStyle = t.accentColor;
      ctx.fillRect(36, 36, cornerSize, cornerSize);
      ctx.fillRect(width - 36 - cornerSize, 36, cornerSize, cornerSize);
      ctx.fillRect(36, height - 36 - cornerSize, cornerSize, cornerSize);
      ctx.fillRect(width - 36 - cornerSize, height - 36 - cornerSize, cornerSize, cornerSize);

      // 3. Restaurant Name
      ctx.fillStyle = t.textColor;
      ctx.textAlign = "center";
      ctx.font = "900 52px system-ui, -apple-system, sans-serif";
      const cleanRestName = (restaurantName || "ORDER DESK").toUpperCase();
      ctx.fillText(cleanRestName, width / 2, 175);

      // Subtitle
      ctx.fillStyle = t.subtextColor;
      ctx.font = "600 22px system-ui, -apple-system, sans-serif";
      ctx.fillText("DIGITAL MENU & CONTACTLESS ORDERING", width / 2, 225);

      // 4. Table Number Pill
      const tablePillText = `TABLE ${activeTableNum.toUpperCase()}`;
      ctx.font = "900 36px system-ui, -apple-system, sans-serif";
      const textMetrics = ctx.measureText(tablePillText);
      const pillW = Math.max(260, textMetrics.width + 70);
      const pillH = 68;
      const pillX = width / 2 - pillW / 2;
      const pillY = 275;

      ctx.fillStyle = t.pillBg;
      if (typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 34);
        ctx.fill();
      } else {
        ctx.fillRect(pillX, pillY, pillW, pillH);
      }

      ctx.fillStyle = t.pillText;
      ctx.fillText(tablePillText, width / 2, pillY + 47);

      // 5. QR Code White Container
      const plateSize = 560;
      const plateX = width / 2 - plateSize / 2;
      const plateY = 385;

      ctx.fillStyle = "#FFFFFF";
      if (typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(plateX, plateY, plateSize, plateSize, 32);
        ctx.fill();
      } else {
        ctx.fillRect(plateX, plateY, plateSize, plateSize);
      }

      ctx.strokeStyle = t.accentColor;
      ctx.lineWidth = 6;
      ctx.stroke();

      // 6. Draw QR Code into Canvas
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const qrSize = 480;
        const qrOffset = (plateSize - qrSize) / 2;
        ctx.drawImage(img, plateX + qrOffset, plateY + qrOffset, qrSize, qrSize);

        // 7. Instruction Text
        ctx.fillStyle = t.textColor;
        ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
        ctx.fillText("Scan with Camera to Order", width / 2, 1030);

        ctx.fillStyle = t.subtextColor;
        ctx.font = "500 22px system-ui, -apple-system, sans-serif";
        ctx.fillText("1. Open Camera   •   2. Browse Menu   •   3. Order to Table", width / 2, 1075);

        // 8. Manual Fallback PIN Pill
        if (accessCode) {
          const codePillY = 1145;
          const codeStr = `Alternative 4-Digit PIN: ${accessCode}`;
          ctx.font = "700 24px monospace";
          const codeW = ctx.measureText(codeStr).width + 60;
          const codeX = width / 2 - codeW / 2;

          ctx.fillStyle = t.cardBg === "#FFFFFF" ? "#F1F5F9" : "rgba(255, 255, 255, 0.08)";
          if (typeof ctx.roundRect === "function") {
            ctx.beginPath();
            ctx.roundRect(codeX, codePillY, codeW, 54, 27);
            ctx.fill();
          } else {
            ctx.fillRect(codeX, codePillY, codeW, 54);
          }

          ctx.strokeStyle = t.accentColor + "66";
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = t.textColor;
          ctx.fillText(codeStr, width / 2, codePillY + 36);
        }

        // 9. Footer
        ctx.fillStyle = t.subtextColor;
        ctx.font = "500 18px system-ui, -apple-system, sans-serif";
        ctx.fillText("Order Desk • Direct Kitchen Dispatch • No App Installation", width / 2, 1370);

        // Export and Trigger download
        const dataUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `Standee_Table_${activeTableNum}_${selectedTheme}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setIsGeneratingDownload(false);
      };

      img.src = qrDataUrl;
    } catch (e) {
      console.error("Failed to generate standee card:", e);
      setIsGeneratingDownload(false);
    }
  }

  return (
    <>
      {/* Print Specific CSS to print ONLY the standee card cleanly */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-standee-card,
          #print-standee-card * {
            visibility: visible !important;
          }
          #print-standee-card {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 400px !important;
            max-width: 90vw !important;
            box-shadow: none !important;
            margin: 0 !important;
            z-index: 999999 !important;
          }
        }
      `}</style>

      {/* Modal Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
      >
        {/* Modal Window Container */}
        <div
          className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Bar */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
                <i className="fa-solid fa-qrcode text-base" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Table QR Studio &amp; Acrylic Standee
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    5-Star Print Studio
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Design, preview, print, and export high-resolution table standees for your restaurant.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              title="Close modal"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>
          </div>

          {/* Main 2-Column Content Area */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* ======================================================== */}
              {/* LEFT COLUMN: 5-STAR ACRYLIC STANDEE MOCKUP PREVIEW */}
              {/* ======================================================== */}
              <div className="lg:col-span-5 flex flex-col items-center">
                <div className="w-full max-w-[340px] flex flex-col items-center">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono flex items-center gap-1.5">
                    <i className="fa-solid fa-eye text-purple-600 text-xs" />
                    <span>Live Standee Card Preview</span>
                  </div>

                  {/* Standee Acrylic Card Mockup */}
                  <div
                    id="print-standee-card"
                    className={`w-full rounded-3xl p-6 sm:p-7 shadow-2xl border-4 transition-all duration-300 relative overflow-hidden select-none flex flex-col items-center ${themeConfig.bgGradient}`}
                    style={{
                      borderColor: themeConfig.accentColor,
                      color: themeConfig.textColor,
                      minHeight: "440px",
                    }}
                  >
                    {/* Corner luxury accent notches */}
                    <div
                      className="absolute top-2 left-2 w-2 h-2 rounded-xs"
                      style={{ backgroundColor: themeConfig.accentColor }}
                    />
                    <div
                      className="absolute top-2 right-2 w-2 h-2 rounded-xs"
                      style={{ backgroundColor: themeConfig.accentColor }}
                    />
                    <div
                      className="absolute bottom-2 left-2 w-2 h-2 rounded-xs"
                      style={{ backgroundColor: themeConfig.accentColor }}
                    />
                    <div
                      className="absolute bottom-2 right-2 w-2 h-2 rounded-xs"
                      style={{ backgroundColor: themeConfig.accentColor }}
                    />

                    {/* Acrylic Top Light Reflection Glare */}
                    <div className="absolute -top-12 left-0 right-0 h-24 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />

                    {/* Restaurant Brand Title */}
                    <div className="text-center w-full mb-3">
                      <h4 className="text-base sm:text-lg font-black tracking-wider uppercase font-heading truncate">
                        {restaurantName || "ORDER DESK"}
                      </h4>
                      <p
                        className="text-[9px] uppercase tracking-widest font-semibold mt-0.5"
                        style={{ color: themeConfig.subtextColor }}
                      >
                        Digital Table Service
                      </p>
                    </div>

                    {/* Table Pill */}
                    <div
                      className="px-4 py-1 rounded-full text-xs font-black tracking-widest uppercase mb-4 shadow-sm"
                      style={{
                        backgroundColor: themeConfig.pillBg,
                        color: themeConfig.pillText,
                      }}
                    >
                      Table {activeTableNum}
                    </div>

                    {/* QR Code Frame */}
                    <div
                      className="p-3 rounded-2xl bg-white shadow-xl border-2 transition-transform duration-200"
                      style={{ borderColor: themeConfig.qrPlateBorder }}
                    >
                      {qrDataUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={qrDataUrl}
                          alt={`QR Code Table ${activeTableNum}`}
                          className="w-40 h-40 object-contain rounded-lg"
                        />
                      ) : (
                        <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400 bg-slate-100 rounded-lg">
                          Generating QR...
                        </div>
                      )}
                    </div>

                    {/* Scan Instructions */}
                    <div className="mt-4 text-center">
                      <div className="text-xs font-bold tracking-tight">
                        Scan with Camera to Order
                      </div>
                      <div
                        className="text-[10px] mt-0.5 leading-tight"
                        style={{ color: themeConfig.subtextColor }}
                      >
                        Camera • Google Lens • Paytm / GPay
                      </div>
                    </div>

                    {/* 4-Digit Access Passcode Pill */}
                    <div
                      className="mt-3.5 px-3 py-1 rounded-full border text-[10px] font-mono font-bold tracking-wider"
                      style={{
                        backgroundColor:
                          selectedTheme === "ivory"
                            ? "#F8FAFC"
                            : "rgba(255, 255, 255, 0.08)",
                        borderColor: themeConfig.accentColor + "55",
                        color: themeConfig.textColor,
                      }}
                    >
                      Access Code: {accessCode}
                    </div>
                  </div>

                  {/* Acrylic Base Mockup Foot */}
                  <div className="w-48 h-3.5 bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400 rounded-b-xl shadow-md border-t border-slate-300 opacity-80" />
                </div>
              </div>

              {/* ======================================================== */}
              {/* RIGHT COLUMN: CONTROLS, THEMES & EXPORT STUDIO */}
              {/* ======================================================== */}
              <div className="lg:col-span-7 space-y-6">
                {/* 1. Table Selector Bar */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <i className="fa-solid fa-table-cells text-purple-600 text-xs" />
                      <span>Select Restaurant Table</span>
                    </label>
                    <span className="text-[11px] font-semibold text-slate-500 font-mono">
                      Table {selectedTableIndex + 1} of {tables.length || 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={selectedTableIndex <= 0}
                      onClick={() => setSelectedTableIndex((p) => Math.max(0, p - 1))}
                      className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs"
                      title="Previous Table"
                    >
                      <i className="fa-solid fa-chevron-left text-xs" />
                    </button>

                    <select
                      value={selectedTableIndex}
                      onChange={(e) => setSelectedTableIndex(Number(e.target.value))}
                      className="flex-1 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-900 cursor-pointer focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
                    >
                      {tables.map((t, idx) => (
                        <option key={t.id || idx} value={idx}>
                          Table {t.table_number} ({t.qr_token ? "Linked QR" : "Standard"})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={selectedTableIndex >= tables.length - 1}
                      onClick={() =>
                        setSelectedTableIndex((p) => Math.min(tables.length - 1, p + 1))
                      }
                      className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs"
                      title="Next Table"
                    >
                      <i className="fa-solid fa-chevron-right text-xs" />
                    </button>
                  </div>
                </div>

                {/* 2. Standee Theme Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <i className="fa-solid fa-palette text-purple-600 text-xs" />
                      <span>Standee Finish &amp; Theme</span>
                    </span>
                    <span className="text-[10px] text-purple-600 font-semibold font-mono">
                      {themeConfig.name}
                    </span>
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {(Object.keys(THEMES) as StandeeTheme[]).map((thmKey) => {
                      const thm = THEMES[thmKey];
                      const isSelected = selectedTheme === thmKey;
                      return (
                        <button
                          key={thmKey}
                          type="button"
                          onClick={() => setSelectedTheme(thmKey)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                            isSelected
                              ? "border-purple-600 bg-purple-50/60 shadow-xs ring-1 ring-purple-600"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span
                              className="w-4 h-4 rounded-full border border-black/10 shrink-0 shadow-2xs"
                              style={{ backgroundColor: thm.cardBg }}
                            />
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {thm.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 block leading-tight truncate">
                            {thm.subtitle}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Export & Print Suite (Big Primary Actions) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <i className="fa-solid fa-print text-purple-600 text-xs" />
                    <span>Print &amp; High-Res Graphic Export</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Print Standee */}
                    <button
                      type="button"
                      onClick={handlePrintStandee}
                      className="py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md bg-purple-600 hover:bg-purple-700 active:scale-98 text-white"
                    >
                      <i className="fa-solid fa-print text-sm" />
                      <span>Print Standee Card</span>
                    </button>

                    {/* Download Full Standee Image */}
                    <button
                      type="button"
                      disabled={isGeneratingDownload}
                      onClick={handleDownloadStandeeCard}
                      className="py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs bg-slate-900 hover:bg-slate-800 active:scale-98 text-white disabled:opacity-50"
                    >
                      <i
                        className={`fa-solid ${
                          isGeneratingDownload ? "fa-spinner fa-spin" : "fa-file-image"
                        } text-sm`}
                      />
                      <span>
                        {isGeneratingDownload ? "Rendering Image..." : "Download Standee (.PNG)"}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleDownloadRawQr}
                      className="text-[11px] font-semibold text-slate-600 hover:text-purple-600 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-download text-[10px]" />
                      <span>Download Raw QR Symbol Only</span>
                    </button>
                    <span className="text-[10px] text-slate-400">
                      Print format: 4x6 / A5 Acrylic Stand
                    </span>
                  </div>
                </div>

                {/* 4. Instant Digital Sharing & Test View */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <i className="fa-solid fa-share-nodes text-purple-600 text-xs" />
                      <span>Digital Sharing &amp; Live Test</span>
                    </span>
                  </div>

                  {/* URL Input Bar */}
                  <div className="flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500">
                    <input
                      type="text"
                      readOnly
                      value={customerMenuUrl}
                      className="flex-1 px-3.5 py-2 text-xs font-mono text-slate-700 bg-transparent outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="px-3.5 py-2 text-xs font-bold text-purple-600 hover:bg-purple-50 transition-colors flex items-center gap-1.5 cursor-pointer border-l border-slate-200 shrink-0"
                    >
                      <i className={`fa-solid ${copied ? "fa-check text-emerald-600" : "fa-copy"}`} />
                      <span>{copied ? "Copied!" : "Copy URL"}</span>
                    </button>
                  </div>

                  {/* Share Action Buttons */}
                  <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                    {/* WhatsApp Direct Share */}
                    <button
                      type="button"
                      onClick={handleWhatsAppShare}
                      className="py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs text-white bg-[#25D366] hover:bg-[#20BA5A] active:scale-98"
                    >
                      <i className="fa-brands fa-whatsapp text-sm" />
                      <span>Share to WhatsApp</span>
                    </button>

                    {/* Open Live Customer View */}
                    <button
                      type="button"
                      onClick={handlePreviewCustomerView}
                      className="py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 active:scale-98"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square text-xs text-purple-600" />
                      <span>Test Customer View</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
            <span className="text-xs text-slate-500 font-medium">
              Ready for commercial table placement &amp; acrylic card printing.
            </span>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200/70 bg-slate-100 transition-colors cursor-pointer"
            >
              Done / Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
