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

export default function TerminalLoginPage() {
  const router = useRouter();

  // Terminal state
  const [restaurantId, setRestaurantId] = useState("");
  const [restaurantName, setRestaurantName] = useState("Order Desk Restaurant");
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [showStaffRoster, setShowStaffRoster] = useState(false);
  const [authenticatedStaff, setAuthenticatedStaff] = useState<{ id?: string; name: string; role: string } | null>(null);

  // PIN state
  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isShaking, setIsShaking] = useState(false);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);

  // Connectivity & Role Filter state
  const [isOnline, setIsOnline] = useState(true);
  const [roleFilter, setRoleFilter] = useState<"all" | "waiter" | "kitchen" | "rider" | "owner">("all");

  // Live POS Terminal Clock
  const [clock, setClock] = useState({ time: "", date: "" });
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Live Clock Updater
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setClock({
        time: now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
        date: now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      });
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  function toggleFullscreen() {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => undefined);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => undefined);
      setIsFullscreen(false);
    }
  }

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
            staffId: staffIdToUse || undefined,
            restaurantId: restoIdToUse,
            pin: pinToVerify,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.message || "Incorrect PIN");
        }

        if (data.staff) {
          setAuthenticatedStaff(data.staff);
        }

        setTimeout(() => {
          router.push(data.redirect || "/");
          router.refresh();
        }, 500);
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

          let targetStaff: StaffProfile | null = null;
          if (staffParam) {
            const found = data.staff.find((s: StaffProfile) => s.id === staffParam);
            if (found) targetStaff = found;
          } else if (roleParam) {
            const found = data.staff.find((s: StaffProfile) => s.role.toLowerCase() === roleParam.toLowerCase());
            if (found) targetStaff = found;
          }

          // Universal Quick PIN mode: default to null so anyone can type their PIN
          setSelectedStaff(targetStaff);
          selectedStaffRef.current = targetStaff;
          if (targetStaff) {
            setShowStaffRoster(true);
          }

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
    return (
      name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "ST"
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950 relative overflow-x-hidden font-sans">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-amber-500/10 via-amber-600/5 to-transparent rounded-full blur-[140px]" />
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
      </div>

      {/* AUTHENTICATION SUCCESS OVERLAY (Toast / Square POS Style) */}
      {authenticatedStaff && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="relative mb-5">
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 text-3xl shadow-[0_0_40px_rgba(16,185,129,0.35)] animate-bounce">
              <i className="fa-solid fa-check" />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-xs font-mono font-bold text-emerald-300 mb-3 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>AUTHENTICATED · CLOCKED IN</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome, {authenticatedStaff.name}!
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-wider">
            {authenticatedStaff.role === "owner"
              ? "👑 Owner Management Session"
              : authenticatedStaff.role === "kitchen" || authenticatedStaff.role === "chef"
              ? "🍳 Kitchen Display Rail"
              : authenticatedStaff.role === "rider" || authenticatedStaff.role === "delivery"
              ? "🛵 Delivery Rider Terminal"
              : "🛎️ Floor Waiter Terminal"}
          </p>

          <div className="mt-7 flex flex-col items-center gap-2.5">
            <div className="w-48 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div className="h-full w-full bg-gradient-to-r from-emerald-500 to-amber-400 animate-pulse" />
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Launching station...</span>
          </div>
        </div>
      )}

      {/* 1-TAP MAGIC AUTO-LOGIN SPLASH OVERLAY */}
      {isAutoLoggingIn && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-4xl shadow-[0_0_50px_rgba(245,158,11,0.4)] border border-amber-400/40 animate-pulse text-slate-950 font-black">
              {selectedStaff?.role === "owner" ? "👑" : selectedStaff?.role === "kitchen" ? "🍳" : "🛎️"}
            </div>
            <div className="absolute -inset-2 rounded-3xl border border-amber-500/40 animate-ping opacity-30" />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-amber-400 mb-3 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>1-TAP MAGIC CLOCK-IN</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome, {selectedStaff?.name || "Team Member"}!
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-wider">
            {selectedStaff?.role === "owner"
              ? "👑 Owner Management Session"
              : selectedStaff?.role === "kitchen"
              ? "🍳 Kitchen Display Rail"
              : "🛎️ Floor Waiter Terminal"}
          </p>

          <div className="mt-8 flex flex-col items-center gap-2.5">
            <div className="w-52 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div className="h-full w-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 animate-pulse" />
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Launching restaurant dashboard...</span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TOP HEADER: REAL HARDWARE POS TERMINAL BAR */}
      {/* ======================================================== */}
      <header className="relative z-20 w-full px-4 sm:px-8 py-3.5 sm:py-4 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md flex items-center justify-between">
        {/* Restaurant Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 text-lg font-black shadow-lg shadow-amber-500/20 border border-amber-400/40 shrink-0">
            <i className="fa-solid fa-utensils" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
                {restaurantName}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider ${
                  isOnline
                    ? "bg-slate-900 border-slate-800 text-emerald-400"
                    : "bg-amber-950/80 border-amber-500/50 text-amber-300 animate-pulse"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOnline ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                  }`}
                />
                <span>{isOnline ? "Station Online" : "Reconnecting"}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              POS Terminal · Shift Clock-In
            </p>
          </div>
        </div>

        {/* Live Digital Clock & Fullscreen Switcher */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="text-right">
            <div className="text-sm sm:text-base font-extrabold text-amber-300 font-mono tracking-wider leading-tight">
              {clock.time || "00:00:00"}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono hidden sm:block">
              {clock.date}
            </div>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen POS Mode"}
            className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer text-xs"
          >
            <i className={`fa-solid ${isFullscreen ? "fa-compress" : "fa-expand"}`} />
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* CENTER: HARDWARE-GRADE TACTILE POS KEYPAD */}
      {/* ======================================================== */}
      <section className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-[420px] bg-slate-900/95 border border-slate-800/90 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black/90 backdrop-blur-2xl space-y-4">
          {/* Staff PIN / Owner Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setShowEmailRecovery(false);
                setErrorMessage("");
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                !showEmailRecovery
                  ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-white"
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
                  ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <i className="fa-solid fa-crown text-xs" />
              <span>Owner Login</span>
            </button>
          </div>

          {!showEmailRecovery ? (
            <div className="space-y-3.5 sm:space-y-4">
              {/* Universal Quick PIN Mode Status Banner / Selected Profile Chip */}
              {selectedStaff ? (
                <div className="flex items-center justify-between px-3 py-2 bg-amber-500/15 border border-amber-500/40 rounded-xl text-xs shadow-inner">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-[11px] shrink-0">
                      {getInitials(selectedStaff.name)}
                    </span>
                    <div className="truncate">
                      <div className="font-bold text-white truncate">{selectedStaff.name}</div>
                      <div className="text-[10px] text-amber-300 uppercase font-mono">
                        {selectedStaff.role} Profile Active
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStaff(null);
                      setPin("");
                      setErrorMessage("");
                    }}
                    className="shrink-0 ml-2 text-[11px] text-amber-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer font-semibold flex items-center gap-1"
                  >
                    <span>✕ Quick PIN</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between px-3.5 py-2 bg-slate-950/80 border border-slate-800/90 rounded-xl text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="font-bold text-slate-200">Universal Quick PIN</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">Type any staff PIN</span>
                </div>
              )}

              {/* Collapsible Shift Staff Profiles Drawer */}
              {staffList.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowStaffRoster(!showStaffRoster)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-[11px] font-medium flex items-center justify-between transition-all cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <i className="fa-solid fa-users text-slate-500 text-[10px]" />
                      <span>Select Profile by Name (Optional)</span>
                    </span>
                    <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                      <span>{showStaffRoster ? "Hide Profiles" : "View Shift Staff"}</span>
                      <i className={`fa-solid fa-chevron-${showStaffRoster ? "up" : "down"} text-[8px]`} />
                    </span>
                  </button>

                  {/* Collapsible Roster Content */}
                  {showStaffRoster && (
                    <div className="mt-2 space-y-2 p-2.5 rounded-2xl bg-slate-950/90 border border-slate-800 animate-in fade-in slide-in-from-top-2 duration-200">
                      {/* Role Fast Selector Tabs: Waiter / Kitchen / Rider / Owner */}
                      <div className="grid grid-cols-5 p-0.5 bg-slate-900 rounded-xl border border-slate-800 text-[10px]">
                        {[
                          { key: "all", label: "All" },
                          { key: "waiter", label: "🛎️ Waiter" },
                          { key: "kitchen", label: "🍳 Cook" },
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
                            }}
                            className={`py-1 rounded-lg font-bold transition-all cursor-pointer text-center ${
                              roleFilter === tab.key
                                ? "bg-slate-800 text-amber-300 border border-amber-500/40 shadow-xs"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Staff Grid */}
                      <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-0.5">
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
                                className={`flex items-center gap-2 p-1.5 rounded-xl text-left transition-all cursor-pointer border ${
                                  isSelected
                                    ? "bg-amber-500/15 border-amber-500 ring-1 ring-amber-500/40 text-white shadow-xs"
                                    : "bg-slate-900/80 border-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
                                }`}
                              >
                                <span
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                                    isSelected
                                      ? "bg-amber-500 text-slate-950 font-black"
                                      : "bg-slate-800 text-slate-400 border border-slate-700/80"
                                  }`}
                                >
                                  {getInitials(member.name)}
                                </span>

                                <div className="truncate">
                                  <div className="text-[11px] font-bold leading-tight truncate text-white">
                                    {member.name}
                                  </div>
                                  <div
                                    className={`text-[9px] font-semibold leading-tight mt-0.5 ${
                                      isSelected ? "text-amber-300" : "text-slate-500"
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
                </div>
              )}

              {/* Glowing PIN Dots Indicator */}
              <div className={`text-center py-0.5 transition-transform ${isShaking ? "animate-shake" : ""}`}>
                <div className="flex justify-center gap-4 mb-2">
                  {[0, 1, 2, 3].map((index) => {
                    const filled = pin.length > index;
                    return (
                      <div
                        key={index}
                        className={`w-4 h-4 rounded-full transition-all duration-200 border ${
                          filled
                            ? "bg-gradient-to-tr from-amber-400 to-amber-500 border-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.8)] scale-110"
                            : "bg-slate-950 border-slate-800"
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
                ) : selectedStaff ? (
                  <p className="text-xs text-slate-300">
                    Enter PIN for <span className="text-white font-bold">{selectedStaff.name}</span>
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">
                    Type your 4-digit staff PIN to sign in
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
                    className="h-14 sm:h-16 rounded-2xl bg-slate-800/90 hover:bg-slate-800 hover:border-amber-500/40 active:bg-amber-500/20 active:scale-95 border border-slate-700/80 text-white shadow-sm transition-all flex flex-col items-center justify-center cursor-pointer disabled:opacity-50 select-none touch-manipulation"
                  >
                    <span className="text-xl sm:text-2xl font-extrabold tracking-tight leading-none">
                      {item.digit}
                    </span>
                    {item.sub && (
                      <span className="text-[9px] font-mono tracking-widest text-slate-400 mt-0.5 uppercase">
                        {item.sub}
                      </span>
                    )}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isSubmitting || pin.length === 0}
                  className="h-14 sm:h-16 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-slate-800 text-amber-400 hover:text-amber-300 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center cursor-pointer disabled:opacity-30 select-none touch-manipulation"
                >
                  CLEAR
                </button>

                <button
                  type="button"
                  onClick={() => handleKeyPress("0")}
                  disabled={isSubmitting}
                  className="h-14 sm:h-16 rounded-2xl bg-slate-800/90 hover:bg-slate-800 hover:border-amber-500/40 active:bg-amber-500/20 active:scale-95 border border-slate-700/80 text-white shadow-sm transition-all flex flex-col items-center justify-center cursor-pointer disabled:opacity-50 select-none touch-manipulation"
                >
                  <span className="text-xl sm:text-2xl font-extrabold tracking-tight leading-none">0</span>
                </button>

                <button
                  type="button"
                  onClick={handleBackspace}
                  disabled={isSubmitting || pin.length === 0}
                  className="h-14 sm:h-16 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-slate-800 text-slate-400 hover:text-white font-bold text-lg transition-all flex items-center justify-center cursor-pointer disabled:opacity-30 select-none touch-manipulation"
                >
                  <i className="fa-solid fa-delete-left text-base" />
                </button>
              </div>
            </div>
          ) : (
            /* Owner Email & Password Form */
            <form onSubmit={handleRecoverySubmit} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-slate-400">
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
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-slate-400">
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
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-colors"
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
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
              >
                <i className="fa-solid fa-arrow-right-to-bracket text-xs" />
                <span>{isRecoverySubmitting ? "Authenticating..." : "Sign In to Restaurant Console"}</span>
              </button>
            </form>
          )}

          {/* Terminal Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <Link
              href="/super-admin/login"
              className="hover:text-amber-400 transition-colors flex items-center gap-1.5"
            >
              <i className="fa-solid fa-shield-halved text-[10px]" />
              <span>Super Admin Console</span>
            </Link>

            <span className="text-[10px] text-slate-500">Order Desk v2.4</span>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* BOTTOM TICKER: HARDWARE POS STATUS BAR */}
      {/* ======================================================== */}
      <footer className="relative z-10 w-full px-4 sm:px-8 py-3 border-t border-slate-800/80 bg-slate-950/70 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Encrypted POS Terminal Session</span>
          </span>
          <span className="hidden sm:inline">|</span>
          <span className="hidden sm:inline text-slate-500">KDS & QR Floor Connected</span>
        </div>

        <div className="flex items-center gap-3">
          <span>Station ID: #{restaurantId?.slice(0, 6) || "TERMINAL-01"}</span>
          <span>·</span>
          <span>Auto-Lock Enabled</span>
        </div>
      </footer>
    </main>
  );
}
