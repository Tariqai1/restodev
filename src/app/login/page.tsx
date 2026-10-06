"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type StaffProfile = {
  id: string;
  name: string;
  role: string;
};

const KEYPAD_BUTTONS = [
  { digit: "1", sub: "" },
  { digit: "2", sub: "ABC" },
  { digit: "3", sub: "DEF" },
  { digit: "4", sub: "GHI" },
  { digit: "5", sub: "JKL" },
  { digit: "6", sub: "MNO" },
  { digit: "7", sub: "PQRS" },
  { digit: "8", sub: "TUV" },
  { digit: "9", sub: "WXYZ" },
];

const SAAS_FEATURES = [
  {
    icon: "fa-qrcode",
    color: "from-amber-500 to-orange-600",
    title: "Instant QR Table Ordering & AI Waiter",
    desc: "Guests scan & order in seconds without downloading apps. Smart AI upselling boosts average ticket size by 24%.",
  },
  {
    icon: "fa-fire-burner",
    color: "from-rose-500 to-red-600",
    title: "Kitchen Display System (KDS)",
    desc: "Paperless cook tickets, station routing, preparation time tracking, and instant food-ready notifications.",
  },
  {
    icon: "fa-motorcycle",
    color: "from-blue-500 to-indigo-600",
    title: "0% Commission Direct Online Store",
    desc: "Sell delivery & takeaway directly to your customers with WhatsApp alerts. Keep 100% of your profits.",
  },
  {
    icon: "fa-file-invoice-dollar",
    color: "from-emerald-500 to-teal-600",
    title: "Lightning Cloud POS & GST Invoicing",
    desc: "Fast 3-second thermal printing, cash register shifts, UPI auto-reconciliation, and multi-user PIN access.",
  },
];

export default function TerminalLoginPage() {
  const router = useRouter();

  // Terminal state
  const [restaurantId, setRestaurantId] = useState("");
  const [restaurantName, setRestaurantName] = useState("Order Desk Restaurant");
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);

  // PIN state
  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isShaking, setIsShaking] = useState(false);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);

  // Connectivity & Role Filter state
  const [isOnline, setIsOnline] = useState(true);
  const [roleFilter, setRoleFilter] = useState<"all" | "waiter" | "kitchen" | "rider" | "owner">("all");

  // Owner recovery toggle
  const [showEmailRecovery, setShowEmailRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isRecoverySubmitting, setIsRecoverySubmitting] = useState(false);

  // Stable refs to eliminate re-render loops
  const selectedStaffRef = useRef<StaffProfile | null>(null);
  const restaurantIdRef = useRef<string>("");
  const isSubmittingRef = useRef<boolean>(false);
  const hasFetchedRosterRef = useRef<boolean>(false);

  useEffect(() => {
    selectedStaffRef.current = selectedStaff;
  }, [selectedStaff]);

  useEffect(() => {
    restaurantIdRef.current = restaurantId;
  }, [restaurantId]);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  const handlePinSubmit = useCallback(
    async (pinToVerify: string, overrideStaffId?: string, overrideRestoId?: string) => {
      if (pinToVerify.length !== 4 || isSubmittingRef.current) return;

      setIsSubmitting(true);
      isSubmittingRef.current = true;
      setErrorMessage("");

      try {
        const staffIdToUse = overrideStaffId || selectedStaffRef.current?.id;
        const restoIdToUse = overrideRestoId || restaurantIdRef.current;

        const res = await fetch("/api/auth/pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staffId: staffIdToUse,
            restaurantId: restoIdToUse,
            pin: pinToVerify,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.message || "Incorrect PIN");
        }

        router.push(data.redirect || "/");
        router.refresh();
      } catch (err) {
        setIsAutoLoggingIn(false);
        setErrorMessage(err instanceof Error ? err.message : "Incorrect PIN");
        setIsShaking(true);
        setTimeout(() => {
          setIsShaking(false);
          setPin("");
        }, 400);
        setIsSubmitting(false);
        isSubmittingRef.current = false;
      }
    },
    [router]
  );

  useEffect(() => {
    if (hasFetchedRosterRef.current) return;
    hasFetchedRosterRef.current = true;

    let isMounted = true;
    const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const restoParam = searchParams.get("resto") || "";
    const roleParam = searchParams.get("role") || "";
    const staffParam = searchParams.get("staff") || "";
    const pinParam = searchParams.get("pin") || "";

    const apiUrl = restoParam ? `/api/auth/pin?resto=${encodeURIComponent(restoParam)}` : "/api/auth/pin";

    fetch(apiUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        if (data.restaurantId) {
          setRestaurantId(data.restaurantId);
          restaurantIdRef.current = data.restaurantId;
        }
        if (data.restaurantName) setRestaurantName(data.restaurantName);
        if (data.staff?.length > 0) {
          setStaffList(data.staff);

          let targetStaff = data.staff[0];
          if (staffParam) {
            const found = data.staff.find((s: StaffProfile) => s.id === staffParam);
            if (found) targetStaff = found;
          } else if (roleParam) {
            const found = data.staff.find((s: StaffProfile) => s.role.toLowerCase() === roleParam.toLowerCase());
            if (found) targetStaff = found;
          }
          setSelectedStaff(targetStaff);
          selectedStaffRef.current = targetStaff;

          // 1-Tap Magic auto-login if valid 4-digit pin in query
          if (pinParam && pinParam.length === 4) {
            setIsAutoLoggingIn(true);
            setPin(pinParam);
            setTimeout(() => {
              handlePinSubmit(pinParam, targetStaff?.id, data.restaurantId);
            }, 300);
          }
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [handlePinSubmit]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  function handleKeyPress(digit: string) {
    if (isSubmitting || pin.length >= 4) return;
    if (typeof window !== "undefined" && navigator.vibrate) {
      navigator.vibrate(8);
    }
    setErrorMessage("");
    const nextPin = pin + digit;
    setPin(nextPin);

    if (nextPin.length === 4) {
      handlePinSubmit(nextPin);
    }
  }

  function handleBackspace() {
    if (isSubmitting || pin.length === 0) return;
    if (typeof window !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
    setErrorMessage("");
    setPin((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    if (isSubmitting) return;
    if (typeof window !== "undefined" && navigator.vibrate) {
      navigator.vibrate(12);
    }
    setErrorMessage("");
    setPin("");
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (showEmailRecovery) return;

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Escape" || e.key === "c" || e.key === "C") {
        e.preventDefault();
        handleClear();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showEmailRecovery, pin, isSubmitting, handlePinSubmit]);

  async function handleRecoverySubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsRecoverySubmitting(true);
    setErrorMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: recoveryEmail,
        password: recoveryPassword,
      });

      if (error) throw new Error(error.message);

      router.push("/");
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Sign-in failed");
      setIsRecoverySubmitting(false);
    }
  }

  function getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "ST";
  }

  return (
    <main className="min-h-screen bg-[#070605] text-[#EDE8E1] flex flex-col lg:flex-row items-stretch selection:bg-[#D96B27] selection:text-white relative overflow-x-hidden">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[450px] bg-gradient-to-tr from-[#D96B27]/15 to-amber-500/5 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-amber-600/10 rounded-full blur-[150px]" />
      </div>

      {/* 1-TAP MAGIC AUTO-LOGIN SPLASH OVERLAY */}
      {isAutoLoggingIn && (
        <div className="fixed inset-0 z-50 bg-[#0B0907]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-[#D96B27] to-[#F59E0B] flex items-center justify-center text-4xl shadow-[0_0_50px_rgba(217,107,39,0.5)] border border-amber-300/30 animate-pulse">
              {selectedStaff?.role === "owner" ? "👑" : selectedStaff?.role === "kitchen" ? "🍳" : "🛎️"}
            </div>
            <div className="absolute -inset-2 rounded-3xl border border-[#D96B27]/40 animate-ping opacity-30" />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#1F1711] border border-[#3E2D20] text-xs font-mono text-amber-400 mb-3 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>1-TAP MAGIC CLOCK-IN</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome, {selectedStaff?.name || "Team Member"}!
          </h2>
          <p className="text-xs text-[#A89F91] mt-1 font-mono uppercase tracking-wider">
            {selectedStaff?.role === "owner"
              ? "👑 Owner Management Session"
              : selectedStaff?.role === "kitchen"
              ? "🍳 Kitchen Display Rail"
              : "🛎️ Floor Waiter Terminal"}
          </p>

          <div className="mt-8 flex flex-col items-center gap-2.5">
            <div className="w-52 h-2 bg-[#221A14] rounded-full overflow-hidden border border-[#3A2D22]">
              <div className="h-full w-full bg-gradient-to-r from-[#D96B27] via-amber-400 to-emerald-400 animate-pulse" />
            </div>
            <span className="text-[11px] text-[#8C8275] font-mono">Launching restaurant dashboard...</span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* LEFT SIDE: ORDER DESK SAAS PLATFORM SHOWCASE */}
      {/* ======================================================== */}
      <section className="relative z-10 flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-14 xl:p-16 border-b lg:border-b-0 lg:border-r border-[#261E17]/80 bg-gradient-to-br from-[#120E0A]/90 via-[#0A0806]/95 to-[#070605]">
        {/* Brand Header */}
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#D96B27] to-[#F59E0B] flex items-center justify-center text-white text-xl font-black shadow-lg shadow-[#D96B27]/30 border border-amber-300/30">
                <i className="fa-solid fa-utensils" />
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  Order Desk
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-[#D96B27]/20 text-[#F38B47] border border-[#D96B27]/40">
                    SaaS Cloud
                  </span>
                </span>
                <span className="text-[11px] text-[#8C8275] block font-mono">
                  Enterprise Restaurant Operating System
                </span>
              </div>
            </div>

            {/* Live Status Pill */}
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#18120D] border border-[#35261B] text-[11px] font-medium text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Cloud Services 100% Live</span>
            </div>
          </div>

          {/* Hero Pitch */}
          <div className="space-y-3 pt-4">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black text-white tracking-tight leading-[1.15]">
              Everything your restaurant needs,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F38B47] via-amber-400 to-[#D96B27]">
                powered by one unified cloud.
              </span>
            </h1>
            <p className="text-sm sm:text-base text-[#9E9485] max-w-xl leading-relaxed">
              Order Desk is the all-in-one SaaS hospitality platform designed to replace messy multi-software stacks with a seamless QR engine, smart KDS, billing, and direct delivery.
            </p>
          </div>

          {/* SaaS Core Feature Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-4">
            {SAAS_FEATURES.map((feat, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-[#261E17] bg-[#14100C]/70 hover:bg-[#1C1611]/90 transition-all p-4 space-y-2 group shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${feat.color} text-white flex items-center justify-center text-xs shadow-md shrink-0`}
                  >
                    <i className={`fa-solid ${feat.icon}`} />
                  </span>
                  <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                    {feat.title}
                  </h3>
                </div>
                <p className="text-[11px] text-[#8C8275] leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* SaaS Footer Metrics & Trust Badge */}
        <div className="pt-8 mt-6 border-t border-[#261E17]/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-lg font-bold text-white font-mono">99.98%</span>
              <span className="text-[10px] text-[#786D5F] block uppercase font-mono">Platform Uptime</span>
            </div>
            <div className="h-6 w-px bg-[#261E17]" />
            <div>
              <span className="text-lg font-bold text-emerald-400 font-mono">0% Fee</span>
              <span className="text-[10px] text-[#786D5F] block uppercase font-mono">Direct Orders</span>
            </div>
            <div className="h-6 w-px bg-[#261E17]" />
            <div>
              <span className="text-lg font-bold text-amber-400 font-mono">&lt; 50ms</span>
              <span className="text-[10px] text-[#786D5F] block uppercase font-mono">Sync Latency</span>
            </div>
          </div>

          <div className="text-[11px] text-[#786D5F] font-mono flex items-center gap-1.5">
            <i className="fa-solid fa-lock text-[#D96B27]" />
            <span>256-Bit TLS Bank-Grade Encryption</span>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* RIGHT SIDE: FAST & SMOOTH AUTHENTICATION TERMINAL */}
      {/* ======================================================== */}
      <section className="relative z-10 w-full lg:w-[480px] xl:w-[520px] flex items-center justify-center p-4 sm:p-8 lg:p-10 shrink-0">
        <div className="w-full max-w-[420px] bg-[#14100C]/95 border border-[#2E231B] rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black/80 backdrop-blur-xl space-y-5">
          {/* Terminal Location & Restaurant Title */}
          <header className="space-y-2 border-b border-[#261E17] pb-4">
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider ${
                  isOnline
                    ? "bg-[#1F1711] border-[#3A2A1E] text-amber-400"
                    : "bg-amber-950/80 border-amber-500/50 text-amber-300 animate-pulse"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOnline ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                  }`}
                />
                <span>{isOnline ? "Terminal Online" : "Reconnecting..."}</span>
              </span>

              <span className="text-[11px] font-bold font-mono tracking-wider text-[#D96B27] uppercase">
                Order Desk POS
              </span>
            </div>

            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                {restaurantName}
              </h2>
              <p className="text-xs text-[#8C8275] font-medium mt-0.5">
                {showEmailRecovery ? "Owner Master Login & Settings" : "Fast Staff PIN Access & Shift Clock-In"}
              </p>
            </div>
          </header>

          {/* Staff PIN / Owner Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-[#0D0A08] rounded-xl border border-[#261E17]">
            <button
              type="button"
              onClick={() => {
                setShowEmailRecovery(false);
                setErrorMessage("");
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                !showEmailRecovery
                  ? "bg-[#D96B27] text-white shadow-md shadow-[#D96B27]/30"
                  : "text-[#8C8275] hover:text-white"
              }`}
            >
              <i className="fa-solid fa-calculator text-xs" />
              <span>Staff PIN Pad</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowEmailRecovery(true);
                setErrorMessage("");
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                showEmailRecovery
                  ? "bg-[#D96B27] text-white shadow-md shadow-[#D96B27]/30"
                  : "text-[#8C8275] hover:text-white"
              }`}
            >
              <i className="fa-solid fa-crown text-xs" />
              <span>Owner Login</span>
            </button>
          </div>

          {!showEmailRecovery ? (
            <div className="space-y-4">
              {/* Role Fast Selector Tabs: Waiter / Kitchen / Rider / Owner */}
              <div className="grid grid-cols-5 p-0.5 bg-[#0D0A08] rounded-xl border border-[#261E17] text-[10px] sm:text-[11px]">
                {[
                  { key: "all", label: "All" },
                  { key: "waiter", label: "🛎️ Waiter" },
                  { key: "kitchen", label: "🍳 Kitchen" },
                  { key: "rider", label: "🛵 Rider" },
                  { key: "owner", label: "👑 Owner" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined" && navigator.vibrate) {
                        navigator.vibrate(8);
                      }
                      setRoleFilter(tab.key as any);
                      const match =
                        tab.key === "all"
                          ? staffList[0]
                          : staffList.find((s) => {
                              const r = s.role.toLowerCase();
                              if (tab.key === "rider") return r === "rider" || r === "delivery";
                              return r === tab.key;
                            });
                      if (match) {
                        setSelectedStaff(match);
                        setPin("");
                      }
                    }}
                    className={`py-1.5 rounded-lg font-bold transition-all cursor-pointer text-center ${
                      roleFilter === tab.key
                        ? "bg-[#251C15] text-[#D96B27] border border-[#D96B27]/40 shadow-xs"
                        : "text-[#8C8275] hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Staff Selector Pills */}
              {staffList.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#8C8275] uppercase">
                    <span>Select Profile:</span>
                    <span className="text-[#D96B27]">
                      {staffList.filter((s) => {
                        if (roleFilter === "all") return true;
                        const r = s.role.toLowerCase();
                        if (roleFilter === "rider") return r === "rider" || r === "delivery";
                        return r === roleFilter;
                      }).length} available
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1">
                    {staffList
                      .filter((s) => {
                        if (roleFilter === "all") return true;
                        const r = s.role.toLowerCase();
                        if (roleFilter === "rider") return r === "rider" || r === "delivery";
                        return r === roleFilter;
                      })
                      .map((member) => {
                        const isSelected = selectedStaff?.id === member.id;
                        const roleLabel =
                          member.role === "owner"
                            ? "👑 Owner"
                            : member.role === "kitchen"
                            ? "🍳 Kitchen"
                            : member.role === "rider" || member.role === "delivery"
                            ? "🛵 Rider"
                            : member.role === "captain"
                            ? "⭐ Captain"
                            : "🛎️ Waiter";

                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => {
                              if (typeof window !== "undefined" && navigator.vibrate) {
                                navigator.vibrate(8);
                              }
                              setSelectedStaff(member);
                              setPin("");
                              setErrorMessage("");
                            }}
                            className={`flex items-center gap-2 p-2 rounded-xl text-left transition-all cursor-pointer border ${
                              isSelected
                                ? "bg-[#251C15] border-[#D96B27] ring-1 ring-[#D96B27]/40 text-white shadow-lg shadow-[#D96B27]/15"
                                : "bg-[#110D0A] border-[#261E17] text-[#A89F91] hover:bg-[#1A1410] hover:text-white"
                            }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                              isSelected
                                ? "bg-[#D96B27] text-white"
                                : "bg-[#1C1611] text-[#8C8275] border border-[#2E231B]"
                            }`}
                          >
                            {getInitials(member.name)}
                          </span>

                          <div className="truncate">
                            <div className="text-xs font-bold leading-tight truncate text-white">
                              {member.name}
                            </div>
                            <div
                              className={`text-[10px] font-semibold leading-tight mt-0.5 ${
                                isSelected ? "text-[#F38B47]" : "text-[#786D5F]"
                              }`}
                            >
                              {roleLabel}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Glowing PIN Dots Indicator */}
              <div className={`text-center py-1 transition-transform ${isShaking ? "animate-shake" : ""}`}>
                <div className="flex justify-center gap-4 mb-2">
                  {[0, 1, 2, 3].map((index) => {
                    const filled = pin.length > index;
                    return (
                      <div
                        key={index}
                        className={`w-4 h-4 rounded-full transition-all duration-200 border ${
                          filled
                            ? "bg-gradient-to-tr from-[#D96B27] to-[#F59E0B] border-amber-300 shadow-[0_0_16px_rgba(217,107,39,0.9)] scale-110"
                            : "bg-[#100C09] border-[#382B20]"
                        }`}
                      />
                    );
                  })}
                </div>

                {errorMessage ? (
                  <p className="text-xs font-bold text-red-400 mt-1 animate-fade-in flex items-center justify-center gap-1">
                    <i className="fa-solid fa-triangle-exclamation" />
                    <span>{errorMessage}</span>
                  </p>
                ) : (
                  <p className="text-xs text-[#8C8275]">
                    Enter 4-digit PIN for{" "}
                    <span className="text-white font-bold">{selectedStaff?.name || "Terminal"}</span>
                  </p>
                )}
              </div>

              {/* Tactile Mobile & Desktop Keypad */}
              <div className="grid grid-cols-3 gap-2">
                {KEYPAD_BUTTONS.map((item) => (
                  <button
                    key={item.digit}
                    type="button"
                    onClick={() => handleKeyPress(item.digit)}
                    disabled={isSubmitting}
                    className="h-14 sm:h-15 rounded-2xl bg-[#1A140F] hover:bg-[#261E16] active:bg-[#D96B27]/30 active:scale-95 border border-[#2B2119] text-white shadow-sm transition-all flex flex-col items-center justify-center cursor-pointer disabled:opacity-50 select-none"
                  >
                    <span className="text-xl sm:text-2xl font-extrabold tracking-tight leading-none">
                      {item.digit}
                    </span>
                    {item.sub && (
                      <span className="text-[9px] font-mono tracking-widest text-[#7D7162] mt-0.5 uppercase">
                        {item.sub}
                      </span>
                    )}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isSubmitting || pin.length === 0}
                  className="h-14 sm:h-15 rounded-2xl bg-[#110D0A] hover:bg-[#1A1410] active:scale-95 border border-[#2B2119] text-amber-500 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center cursor-pointer disabled:opacity-30 select-none"
                >
                  CLEAR
                </button>

                <button
                  type="button"
                  onClick={() => handleKeyPress("0")}
                  disabled={isSubmitting}
                  className="h-14 sm:h-15 rounded-2xl bg-[#1A140F] hover:bg-[#261E16] active:bg-[#D96B27]/30 active:scale-95 border border-[#2B2119] text-white shadow-sm transition-all flex flex-col items-center justify-center cursor-pointer disabled:opacity-50 select-none"
                >
                  <span className="text-xl sm:text-2xl font-extrabold tracking-tight leading-none">0</span>
                </button>

                <button
                  type="button"
                  onClick={handleBackspace}
                  disabled={isSubmitting || pin.length === 0}
                  className="h-14 sm:h-15 rounded-2xl bg-[#110D0A] hover:bg-[#1A1410] active:scale-95 border border-[#2B2119] text-slate-400 hover:text-white font-bold text-lg transition-all flex items-center justify-center cursor-pointer disabled:opacity-30 select-none"
                >
                  <i className="fa-solid fa-delete-left text-base" />
                </button>
              </div>
            </div>
          ) : (
            /* Owner Email & Password Form */
            <form onSubmit={handleRecoverySubmit} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-[#8C8275]">
                  Owner Email Address
                </label>
                <div className="relative">
                  <i className="fa-solid fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
                  <input
                    required
                    type="email"
                    placeholder="owner@restaurant.com"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-[#0F0C09] border border-[#2E231B] focus:border-[#D96B27] rounded-xl text-xs text-white placeholder-[#5A4E42] outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-[#8C8275]">
                  Master Password
                </label>
                <div className="relative">
                  <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={recoveryPassword}
                    onChange={(e) => setRecoveryPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-[#0F0C09] border border-[#2E231B] focus:border-[#D96B27] rounded-xl text-xs text-white placeholder-[#5A4E42] outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                  >
                    <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`} />
                  </button>
                </div>
              </div>

              {errorMessage && (
                <p className="text-xs font-semibold text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-900/40">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isRecoverySubmitting}
                className="w-full py-3 bg-gradient-to-r from-[#D96B27] to-[#B85418] hover:from-[#E3752F] text-white rounded-xl text-xs font-bold shadow-lg shadow-[#D96B27]/25 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
              >
                <i className="fa-solid fa-arrow-right-to-bracket text-xs" />
                <span>{isRecoverySubmitting ? "Authenticating..." : "Sign In to Restaurant Console"}</span>
              </button>
            </form>
          )}

          {/* Terminal Footer */}
          <div className="pt-3 border-t border-[#261E17] flex items-center justify-between text-[11px] font-mono text-[#8C8275]">
            <Link
              href="/super-admin/login"
              className="hover:text-[#D96B27] transition-colors flex items-center gap-1.5"
            >
              <i className="fa-solid fa-shield-halved text-[10px]" />
              <span>Super Admin Console</span>
            </Link>

            <span className="text-[10px] text-[#63594D]">Order Desk v2.4</span>
          </div>
        </div>
      </section>
    </main>
  );
}
