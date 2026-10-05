"use client";

import React, { useState, useEffect, useRef } from "react";
import { MenuItem, PortionType } from "./TableTypes";
import { triggerHaptic } from "./tableUtils";

interface TableVoiceOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: MenuItem[];
  onBatchAddToCart: (items: Array<{ dishId: string; qty: number; portion: PortionType }>) => void;
}

export default function TableVoiceOrderModal({
  isOpen,
  onClose,
  menuItems,
  onBatchAddToCart,
}: TableVoiceOrderModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [processing, setProcessing] = useState(false);
  const [matchedItems, setMatchedItems] = useState<any[]>([]);
  const [summaryMsg, setSummaryMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const recognitionRef = useRef<any>(null);

  const startListening = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg("Voice speech recognition aapke browser me supported nahi hai. Kripya Chrome ya Safari use karein.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "hi-IN"; // Hindi / Indian English mix
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        triggerHaptic(15);
      };

      recognition.onresult = (event: any) => {
        let currentText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript;
        }
        setTranscript(currentText);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech error", event.error);
        setIsListening(false);
        if (event.error !== "no-speech") {
          setErrorMsg("Mic permission check karein ya dobara bolein.");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  useEffect(() => {
    if (isOpen) {
      setTranscript("");
      setMatchedItems([]);
      setSummaryMsg("");
      setErrorMsg("");
      startListening();
    } else {
      stopListening();
    }
    return () => stopListening();
  }, [isOpen]);

  const handleProcessOrder = async (textToProcess: string) => {
    const text = textToProcess.trim();
    if (!text) return;
    stopListening();
    setProcessing(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/ai/voice-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: text,
          menuItems,
        }),
      });

      const data = await res.json();
      if (data.ok && Array.isArray(data.matchedItems) && data.matchedItems.length > 0) {
        setMatchedItems(data.matchedItems);
        setSummaryMsg(data.summary);
      } else {
        setErrorMsg(data.summary || "Koi matching dish nahi mili. Kripya dobara bolein.");
      }
    } catch (err) {
      setErrorMsg("Server error. Kripya dobara try karein.");
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmAndAdd = () => {
    triggerHaptic(18);
    const toAdd = matchedItems.map((m) => ({
      dishId: m.dishId,
      qty: Number(m.qty) || 1,
      portion: (m.portion === "half" ? "half" : "full") as PortionType,
    }));
    onBatchAddToCart(toAdd);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-lg mx-auto rounded-t-3xl border-t shadow-2xl p-5 flex flex-col items-center text-center animate-in slide-in-from-bottom duration-300"
        style={{
          backgroundColor: "var(--paper)",
          borderColor: "var(--hairline)",
          color: "var(--ink)",
        }}
      >
        <div className="w-12 h-1.5 rounded-full mx-auto mb-4 bg-stone-300" />

        <h3 className="font-heading font-bold text-base mb-1">
          🎙️ Voice Ordering (Bol Kar Order Karein)
        </h3>
        <p className="text-xs text-stone-500 mb-5">
          Jaise: &quot;2 Butter Naan aur ek Dal Makhani half&quot;
        </p>

        {/* Pulsating Microphone Button */}
        <div className="relative my-2">
          {isListening && (
            <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-60 scale-150" />
          )}
          <button
            type="button"
            onClick={() => {
              if (isListening) {
                stopListening();
                handleProcessOrder(transcript);
              } else {
                startListening();
              }
            }}
            className={`relative w-20 h-20 rounded-full flex items-center justify-center text-2xl shadow-xl transition-all cursor-pointer ${
              isListening ? "bg-red-500 text-white scale-110" : "bg-stone-900 text-white hover:bg-stone-800"
            }`}
          >
            <i className={`fa-solid ${isListening ? "fa-microphone-lines" : "fa-microphone"}`} />
          </button>
        </div>

        <span className="text-xs font-bold mt-3 mb-2 text-stone-700">
          {isListening ? "Sun rahe hain... Boliye" : processing ? "AI order detect kar raha hai..." : "Dabayein aur bolein"}
        </span>

        {/* Live Transcript Bubble */}
        {transcript && (
          <div className="w-full my-3 p-3 rounded-xl border bg-stone-50 text-xs italic text-stone-800 text-center" style={{ borderColor: "var(--hairline)" }}>
            &quot;{transcript}&quot;
          </div>
        )}

        {/* Process button if stopped with transcript */}
        {!isListening && transcript && matchedItems.length === 0 && !processing && (
          <button
            type="button"
            onClick={() => handleProcessOrder(transcript)}
            className="w-full py-2.5 rounded-xl bg-amber-500 font-bold text-xs text-stone-950 mt-1 mb-2 hover:bg-amber-600 transition-colors shadow-xs cursor-pointer"
          >
            ✓ Check Order
          </button>
        )}

        {/* Matched Dishes Preview */}
        {matchedItems.length > 0 && (
          <div className="w-full my-3 p-3.5 rounded-2xl border bg-emerald-50/70 border-emerald-300 text-left space-y-2">
            <span className="text-xs font-bold text-emerald-900 block">
              ✨ {summaryMsg || "Order Samjh Gaya!"}
            </span>
            <div className="space-y-1.5">
              {matchedItems.map((it, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs font-semibold text-stone-800 bg-white p-2 rounded-lg border border-emerald-200 shadow-2xs">
                  <span>
                    {it.qty}x {it.name} {it.portion === "half" ? "(Half)" : ""}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700">✓ Ready</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleConfirmAndAdd}
              className="w-full mt-2 py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              Confirm &amp; Add to Cart ({matchedItems.length} items) →
            </button>
          </div>
        )}

        {errorMsg && (
          <p className="text-xs text-rose-600 font-medium my-2">{errorMsg}</p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 text-xs text-stone-500 hover:text-stone-800 cursor-pointer font-medium"
        >
          Cancel
        </button>
      </div>
    </>
  );
}
