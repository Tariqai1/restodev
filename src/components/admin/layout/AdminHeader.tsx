"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AdminButton from "../ui/AdminButton";
import {
  isSoundMuted,
  setSoundMuted,
  snoozeSound,
  cancelSnooze,
  getSnoozeRemainingMinutes,
  unlockAudio,
} from "@/lib/audio/chime";

interface AdminHeaderProps {
  pageTitle: string;
  breadcrumb?: string[];
  onOpenMobileSidebar: () => void;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  restaurantName?: string;
  activeTablesCount?: number;
  totalTablesCount?: number;
  onQuickAction?: () => void;
  onSelectView?: (view: any) => void;
  onOpenBulkPrice?: () => void;
}

export default function AdminHeader({
  pageTitle,
  breadcrumb = ["Admin", "Dashboard"],
  onOpenMobileSidebar,
  userName = "Owner",
  userEmail = "owner@restaurant.com",
  userRole = "owner",
  restaurantName = "Order Desk",
  activeTablesCount = 0,
  totalTablesCount = 0,
  onQuickAction,
  onSelectView,
  onOpenBulkPrice,
}: AdminHeaderProps) {
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const [soundMutedState, setSoundMutedState] = useState(false);
  const [snoozeMins, setSnoozeMins] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setSoundMutedState(isSoundMuted());
    setSnoozeMins(getSnoozeRemainingMinutes());

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const soundCheckInterval = setInterval(() => {
      setSoundMutedState(isSoundMuted());
      setSnoozeMins(getSnoozeRemainingMinutes());
    }, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(soundCheckInterval);
    };
  }, []);

  const toggleSound = () => {
    unlockAudio();
    const nextMuted = !soundMutedState;
    setSoundMuted(nextMuted);
    setSoundMutedState(nextMuted);
    setSnoozeMins(0);
  };

  const handleSnooze = (minutes: number) => {
    unlockAudio();
    snoozeSound(minutes);
    setSoundMutedState(true);
    setSnoozeMins(minutes);
    setShowSoundMenu(false);
  };

  const handleUnmute = () => {
    unlockAudio();
    cancelSnooze();
    setSoundMutedState(false);
    setSnoozeMins(0);
    setShowSoundMenu(false);
  };

  // Compute clean 2-letter initials
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "OW";

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs w-full">
      {/* Top Header Main Bar */}
      <div className="h-14 sm:h-16 px-3 sm:px-6 flex items-center justify-between gap-2 min-w-0">
        {/* Left: Mobile Toggle, Breadcrumb & Page Title */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 lg:hidden cursor-pointer shrink-0 active:scale-95"
            aria-label="Open navigation menu"
          >
            <i className="fa-solid fa-bars text-sm" />
          </button>

          <div className="min-w-0 flex-1">
            {/* Breadcrumb (Only visible on wide desktop xl+) */}
            <div className="hidden xl:flex items-center gap-1.5 text-[11px] font-medium text-slate-400 mb-0.5">
              {breadcrumb.map((bc, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-slate-300">/</span>}
                  <span
                    className={
                      idx === breadcrumb.length - 1
                        ? "text-purple-600 font-semibold"
                        : "hover:text-slate-600"
                    }
                  >
                    {bc}
                  </span>
                </React.Fragment>
              ))}
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm sm:text-base lg:text-lg font-extrabold text-slate-900 truncate leading-tight">
                {pageTitle}
              </h2>
              {/* Mobile restaurant badge */}
              <span className="sm:hidden text-[10px] font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-md truncate max-w-[100px] shrink-0">
                {restaurantName}
              </span>
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Table Occupancy Status Pill (Only on 2xl screens) */}
          <div className="hidden 2xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              <strong className="text-slate-900">{activeTablesCount}</strong> of{" "}
              {totalTablesCount} Tables
            </span>
          </div>

          {/* Online Orders Quick Switch (Desktop/Tablet) */}
          {onSelectView && (
            <button
              type="button"
              onClick={() => onSelectView("online_orders")}
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-bold text-amber-900 transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
              title="Manage Online Orders & Storefront"
            >
              <i className="fa-solid fa-motorcycle text-xs text-amber-600" />
              <span>Online Orders</span>
            </button>
          )}

          {/* Dedicated Waiter Operations Terminal */}
          <Link
            href="/waiter"
            className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-bold text-amber-900 transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
            title="Open Dedicated Waiter Operations Portal"
          >
            <i className="fa-solid fa-bell-concierge text-xs text-amber-600" />
            <span>Waiter Portal</span>
          </Link>

          {/* Quick Action Button */}
          {onQuickAction && (
            <div className="hidden sm:block shrink-0">
              <AdminButton
                variant="primary"
                size="sm"
                leftIcon="fa-plus"
                onClick={onQuickAction}
              >
                New Dish
              </AdminButton>
            </div>
          )}

          {/* Offline / Online Health Pill */}
          <div
            className={`hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-medium shrink-0 ${
              isOnline
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-amber-50 border-amber-300 text-amber-800 animate-pulse"
            }`}
            title={isOnline ? "Cloud POS sync active" : "Reconnecting to server..."}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isOnline ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span>{isOnline ? "Connected" : "Reconnecting..."}</span>
          </div>

        {/* Per-Shift Sound Mute & Snooze Controller */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              setShowSoundMenu(!showSoundMenu);
              setShowNotifications(false);
              setShowProfileMenu(false);
            }}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              soundMutedState
                ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
            }`}
            title={
              soundMutedState
                ? snoozeMins > 0
                  ? `Audio Snoozed (${snoozeMins}m left)`
                  : "Audio Muted (Click to configure)"
                : "Audio Chimes Active (Click to mute/snooze)"
            }
          >
            <i
              className={`fa-solid ${
                soundMutedState ? "fa-bell-slash text-amber-600" : "fa-bell text-slate-700"
              } text-xs`}
            />
          </button>

          {/* Sound Menu Dropdown */}
          {showSoundMenu && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowSoundMenu(false)}
              />
              <div className="absolute right-0 top-11 z-30 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2.5 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
                  <span className="font-bold text-slate-900">Floor Audio Chimes</span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                      soundMutedState
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {soundMutedState ? "MUTED" : "ACTIVE"}
                  </span>
                </div>

                <div className="space-y-1">
                  {soundMutedState ? (
                    <button
                      type="button"
                      onClick={handleUnmute}
                      className="w-full px-2.5 py-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 font-bold flex items-center gap-2 cursor-pointer transition-colors text-left"
                    >
                      <i className="fa-solid fa-volume-high text-emerald-600" />
                      <span>Unmute & Enable Chimes</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={toggleSound}
                      className="w-full px-2.5 py-1.5 rounded-lg text-amber-700 hover:bg-amber-50 font-bold flex items-center gap-2 cursor-pointer transition-colors text-left"
                    >
                      <i className="fa-solid fa-volume-xmark text-amber-600" />
                      <span>Mute for this shift</span>
                    </button>
                  )}

                  <div className="border-t border-slate-100 my-1 pt-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block px-2 mb-1">
                      Quick Snooze:
                    </span>
                    <div className="grid grid-cols-2 gap-1 px-1">
                      <button
                        type="button"
                        onClick={() => handleSnooze(5)}
                        className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50 text-[11px] font-medium text-slate-700 text-center cursor-pointer"
                      >
                        5 mins
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSnooze(15)}
                        className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50 text-[11px] font-medium text-slate-700 text-center cursor-pointer"
                      >
                        15 mins
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors relative cursor-pointer"
          >
            <i className="fa-regular fa-bell text-sm" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-purple-600 ring-2 ring-white" />
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 top-11 z-30 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="font-bold text-slate-900">Notifications</span>
                  <span className="text-[10px] text-purple-600 font-semibold cursor-pointer">
                    Mark all read
                  </span>
                </div>
                <div className="py-3 space-y-2.5">
                  <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100 flex items-start gap-2.5">
                    <i className="fa-solid fa-fire text-purple-600 mt-0.5 text-xs" />
                    <div>
                      <p className="font-semibold text-slate-800">
                        Kitchen Dispatch Active
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        All POS terminals syncing live table updates.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Profile Avatar & Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 p-1.5 sm:px-2 sm:py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
              {initials}
            </div>
            <div className="hidden xl:block text-left min-w-0 max-w-[130px]">
              <span className="block text-xs font-bold text-slate-900 leading-tight truncate">
                {userName}
              </span>
              <span className="block text-[10px] text-purple-600 font-mono leading-none capitalize truncate">
                {userRole === "owner" ? "Restaurant Owner" : userRole}
              </span>
            </div>
            <i className="fa-solid fa-chevron-down text-[10px] text-slate-400 hidden xl:block" />
          </button>

          {/* Profile Menu Dropdown */}
          {showProfileMenu && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowProfileMenu(false)}
              />
              <div className="absolute right-0 top-12 z-30 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="font-bold text-slate-900 truncate">{userName}</p>
                  <p className="text-[11px] text-slate-500 truncate font-mono">
                    {userEmail}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onSelectView?.("floor");
                    setShowProfileMenu(false);
                  }}
                  className="w-full px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer text-left"
                >
                  <i className="fa-solid fa-table-cells text-slate-400 text-xs" />
                  <span>Floor View</span>
                </button>

                <Link
                  href="/waiter"
                  className="w-full px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                  onClick={() => setShowProfileMenu(false)}
                >
                  <i className="fa-solid fa-bell-concierge text-slate-400 text-xs" />
                  <span>Waiter Terminal</span>
                </Link>

                <Link
                  href="/kitchen"
                  className="w-full px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                  onClick={() => setShowProfileMenu(false)}
                >
                  <i className="fa-solid fa-fire text-slate-400 text-xs" />
                  <span>Kitchen KDS</span>
                </Link>

                <div className="my-1 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-arrow-right-from-bracket text-xs" />
                  <span className="font-semibold">Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>

      {/* Mobile Horizontal Quick Action Strip (only on mobile screens < 640px) */}
      <div className="sm:hidden flex items-center gap-2 px-3 py-2 bg-slate-50/95 border-t border-slate-100 overflow-x-auto no-scrollbar scroll-smooth shrink-0 shadow-2xs">
        {onSelectView && (
          <button
            type="button"
            onClick={() => onSelectView("online_orders")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-[11px] font-bold text-amber-900 shrink-0 active:scale-95 shadow-2xs cursor-pointer"
          >
            <i className="fa-solid fa-motorcycle text-amber-600 text-[10px]" />
            <span>Online Orders</span>
          </button>
        )}

        <Link
          href="/waiter"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-[11px] font-bold text-amber-900 shrink-0 active:scale-95 shadow-2xs cursor-pointer"
        >
          <i className="fa-solid fa-bell-concierge text-amber-600 text-[10px]" />
          <span>Waiter Portal</span>
        </Link>

        {onQuickAction && (
          <button
            type="button"
            onClick={onQuickAction}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-600 text-white text-[11px] font-bold shadow-xs shrink-0 active:scale-95 cursor-pointer"
          >
            <i className="fa-solid fa-plus text-[10px]" />
            <span>New Dish</span>
          </button>
        )}

        {onOpenBulkPrice && (
          <button
            type="button"
            onClick={onOpenBulkPrice}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-purple-200 bg-purple-50 text-[11px] font-bold text-purple-900 shrink-0 active:scale-95 shadow-2xs cursor-pointer"
          >
            <i className="fa-solid fa-bolt text-purple-600 text-[10px]" />
            <span>Bulk Price</span>
          </button>
        )}

        {onSelectView && (
          <button
            type="button"
            onClick={() => onSelectView("offers")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-[11px] font-bold text-amber-900 shrink-0 active:scale-95 shadow-2xs cursor-pointer"
          >
            <i className="fa-solid fa-gift text-amber-600 text-[10px]" />
            <span>Offers</span>
          </button>
        )}

        {onSelectView && (
          <button
            type="button"
            onClick={() => onSelectView("floor")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-slate-700 shrink-0 active:scale-95 shadow-2xs cursor-pointer"
          >
            <i className="fa-solid fa-table-cells text-slate-600 text-[10px]" />
            <span>Floor ({activeTablesCount}/{totalTablesCount})</span>
          </button>
        )}
      </div>
    </header>
  );
}
