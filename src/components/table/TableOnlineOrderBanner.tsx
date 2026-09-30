"use client";

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { triggerHaptic } from "./tableUtils";

interface TableOnlineOrderBannerProps {
  restaurantName: string;
  slug?: string;
  enabled?: boolean;
}

export default function TableOnlineOrderBanner({
  restaurantName,
  slug,
  enabled = true,
}: TableOnlineOrderBannerProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const storeUrl = typeof window !== "undefined"
    ? `${window.location.origin}/r/${slug || "store"}`
    : `https://orderdesk.app/r/${slug || "store"}`;

  useEffect(() => {
    if (!enabled) return;
    QRCode.toDataURL(storeUrl, {
      width: 280,
      margin: 1.5,
      color: {
        dark: "#1e293b",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.warn("Failed to generate online order QR:", err));
  }, [storeUrl, enabled]);

  if (!enabled) return null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(10);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleWhatsAppShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(12);
    const msg = encodeURIComponent(
      `*${restaurantName}* ka Online Menu dekhein aur ghar baithe order karein:\n${storeUrl}\n\nDelivery & Pickup available!`
    );
    window.open(`https://api.whatsapp.com/send?text=${msg}`, "_blank");
  };

  return (
    <div className="mx-4 my-4">
      <div
        className="rounded-2xl border p-3.5 shadow-xs transition-all cursor-pointer overflow-hidden"
        style={{
          backgroundColor: "var(--paper-dim)",
          borderColor: "var(--hairline)",
        }}
        onClick={() => {
          triggerHaptic(8);
          setIsExpanded((prev) => !prev);
        }}
      >
        {/* Compact Header Strip */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-motorcycle text-amber-600 text-sm" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold truncate" style={{ color: "var(--ink)" }}>
                  Ghar Baithe Order Karein
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800">
                  Online Store
                </span>
              </div>
              <p className="text-[10px] truncate" style={{ color: "var(--ink-soft)" }}>
                Next time direct delivery ya parcel counter se pickup
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <i className="fa-solid fa-qrcode text-[10px]" />
              <span>{isExpanded ? "Hide QR" : "View QR"}</span>
            </button>
            <i
              className={`fa-solid fa-chevron-down text-[10px] text-stone-400 transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </div>
        </div>

        {/* Expanded View with Full QR Code & Action Buttons */}
        {isExpanded && (
          <div
            className="mt-3 pt-3 border-t space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
            style={{ borderColor: "var(--hairline)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
              {/* QR Image */}
              {qrDataUrl ? (
                <div className="p-2 bg-white rounded-xl border-2 border-amber-400 shadow-xs shrink-0 flex flex-col items-center">
                  <img
                    src={qrDataUrl}
                    alt="Online Ordering QR Code"
                    className="w-36 h-36 rounded-lg object-contain"
                  />
                  <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wider mt-1">
                    Scan to Order Online
                  </span>
                </div>
              ) : (
                <div className="w-36 h-36 rounded-xl bg-stone-100 flex items-center justify-center text-xs text-stone-400 font-mono">
                  Loading QR...
                </div>
              )}

              {/* Instructions and Share Actions */}
              <div className="flex-1 space-y-2.5 text-center sm:text-left min-w-0">
                <div>
                  <h4 className="text-xs font-bold text-stone-900">
                    Scan QR or Save Link
                  </h4>
                  <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
                    Apne phone camera se scan karke store link bookmark karein. Swiggy/Zomato commission ke bina direct best prices!
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  {/* WhatsApp Share */}
                  <button
                    type="button"
                    onClick={handleWhatsAppShare}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-brands fa-whatsapp text-sm" />
                    <span>WhatsApp Share</span>
                  </button>

                  {/* Copy Link */}
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className={`fa-solid ${copied ? "fa-check text-emerald-600" : "fa-copy"}`} />
                    <span>{copied ? "Copied!" : "Copy Link"}</span>
                  </button>

                  {/* Open Store */}
                  <a
                    href={storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-stone-950 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                    <span>Open Store</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
