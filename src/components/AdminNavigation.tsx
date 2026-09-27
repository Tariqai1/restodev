"use client";

import { useState } from "react";
import Link from "next/link";

export type AdminNavigationProps = {
  currentTab: "floor" | "tables" | "kitchen" | "menu" | "staff";
  restaurantName?: string;
  currentUser?: { name?: string; role?: string } | null;
  occupiedTablesCount?: number;
  totalTablesCount?: number;
  pendingKitchenCount?: number;
  totalMenuItemsCount?: number;
  staffMembersCount?: number;
  isSuperAdmin?: boolean;
  theme?: "amber" | "crimson";
  onToggleTheme?: (newTheme: "amber" | "crimson") => void;
  onSignOut?: () => void;
  mobileNavStyle?: "bottom_bar" | "sidebar";
};

function triggerHaptic(ms = 12) {
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      // ignore
    }
  }
}

function renderNavIcon(key: string, isActive: boolean) {
  const strokeWidth = isActive ? 2.2 : 1.8;
  switch (key) {
    case "floor":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case "tables":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8h16" />
          <rect x="5" y="4" width="14" height="4" rx="1" />
          <path d="M6 8v11" />
          <path d="M18 8v11" />
          <path d="M2 13h4" />
          <path d="M18 13h4" />
        </svg>
      );
    case "kitchen":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
          <line x1="6" y1="17" x2="18" y2="17" />
        </svg>
      );
    case "menu":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
          <path d="M8 7h8" />
          <path d="M8 11h8" />
          <path d="M8 15h5" />
        </svg>
      );
    case "staff":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    default:
      return null;
  }
}

export default function AdminNavigation({
  currentTab,
  restaurantName = "Order Desk",
  currentUser,
  occupiedTablesCount = 0,
  totalTablesCount,
  pendingKitchenCount = 0,
  totalMenuItemsCount,
  staffMembersCount,
  isSuperAdmin = false,
  theme = "amber",
  onToggleTheme,
  onSignOut,
  mobileNavStyle = "bottom_bar",
}: AdminNavigationProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const userRole = currentUser?.role?.toLowerCase() || "";
  const isOwnerOrManager =
    Boolean(isSuperAdmin) ||
    ["owner", "manager", "admin"].includes(userRole);

  const navItems = [
    {
      key: "floor",
      label: "Floor Overview",
      shortLabel: "Floor",
      href: "/",
      icon: "📊",
      badge: occupiedTablesCount > 0 ? `${occupiedTablesCount} active` : null,
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    },
    ...(isOwnerOrManager
      ? [
          {
            key: "tables",
            label: "Floor Layout & QR",
            shortLabel: "Tables",
            href: "/tables",
            icon: "🪑",
            badge: totalTablesCount !== undefined ? `${totalTablesCount} tables` : null,
            badgeColor: "bg-stone-800 text-stone-300 border-stone-700",
          },
        ]
      : []),
    {
      key: "kitchen",
      label: "Kitchen Rail (KDS)",
      shortLabel: "Kitchen",
      href: "/kitchen",
      icon: "👨‍🍳",
      badge: pendingKitchenCount > 0 ? `${pendingKitchenCount} pending` : null,
      badgeColor: "bg-red-500/20 text-red-300 border-red-500/40",
    },
    ...(isOwnerOrManager
      ? [
          {
            key: "menu",
            label: "Menu & Stock",
            shortLabel: "Menu",
            href: "/menu",
            icon: "📖",
            badge: totalMenuItemsCount !== undefined ? `${totalMenuItemsCount}` : null,
            badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
          },
          {
            key: "staff",
            label: "Staff & Roles",
            shortLabel: "Staff",
            href: "/staff",
            icon: "👥",
            badge: staffMembersCount !== undefined ? `${staffMembersCount}` : null,
            badgeColor: "bg-stone-800 text-stone-300 border-stone-700",
          },
        ]
      : []),
  ];

  const handleNavClick = () => {
    triggerHaptic(10);
    setMobileDrawerOpen(false);
  };

  const handleSignOutClick = () => {
    if (onSignOut) {
      onSignOut();
    } else {
      fetch("/api/auth/logout", { method: "POST" })
        .then(() => {
          window.location.href = "/login";
        })
        .catch(() => {
          window.location.href = "/login";
        });
    }
  };

  return (
    <>
      {/* ============================================================ */}
      {/* 1. DESKTOP CAST-IRON SIDEBAR (Screen width >= md: 768px)    */}
      {/* ============================================================ */}
      <aside
        className="hidden md:flex w-60 lg:w-64 flex-shrink-0 flex-col justify-between p-5 select-none"
        style={{
          backgroundColor: "var(--dark-surface, #14110D)",
          borderRight: "1px solid rgba(220, 209, 183, 0.15)",
          color: "#FAF6EC",
        }}
      >
        <div>
          {/* Restaurant Brand Header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-800/80">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🍽️</span>
                <h1 className="font-heading text-xl font-bold tracking-wide text-white">
                  Order Desk
                </h1>
              </div>
              <p className="text-xs truncate max-w-[170px] mt-0.5 text-stone-400">
                {restaurantName}
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
              POS
            </span>
          </div>

          {/* Restaurant Theme Switcher */}
          {onToggleTheme && (
            <div className="mb-5 p-2 rounded-xl bg-stone-900/80 border border-stone-800/80">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5 flex items-center justify-between">
                <span>Brand Theme</span>
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold"
                  style={{
                    backgroundColor: theme === "amber" ? "#FFBE0B" : "#741A2F",
                    color: theme === "amber" ? "#2A2312" : "#FFFFFF",
                  }}
                >
                  {theme === "amber" ? "Amber Gold" : "Velvet Crimson"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onToggleTheme("amber")}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    theme === "amber"
                      ? "bg-amber-400/20 text-amber-300 border border-amber-400/50 shadow-xs"
                      : "text-stone-400 hover:text-stone-200 border border-transparent"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FFBE0B] shrink-0 border border-stone-900 shadow-sm" />
                  <span className="truncate">Amber</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleTheme("crimson")}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    theme === "crimson"
                      ? "bg-rose-950/60 text-rose-300 border border-rose-600/50 shadow-xs"
                      : "text-stone-400 hover:text-stone-200 border border-transparent"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#741A2F] shrink-0 border border-rose-300/40 shadow-sm" />
                  <span className="truncate">Crimson</span>
                </button>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1 text-xs font-semibold">
            {navItems.map((item) => {
              const isActive = currentTab === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={handleNavClick}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/40 text-amber-300 font-bold shadow-xs"
                      : "text-stone-400 hover:text-white hover:bg-stone-900/80 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className={isActive ? "text-amber-400 shrink-0" : "text-stone-400 shrink-0"}>
                      {renderNavIcon(item.key, isActive)}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        isActive ? "bg-amber-500/20 text-amber-200 border-amber-500/30" : item.badgeColor
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Super Admin Platform Link */}
            {isSuperAdmin && (
              <Link
                href="/super-admin"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl transition-colors border border-amber-800/40 bg-amber-950/20 text-amber-300 text-xs font-bold mt-2"
              >
                <span>⚡</span>
                <span>Super Admin Platform</span>
              </Link>
            )}
          </nav>
        </div>

        {/* Station User & Sign Out Footer */}
        <div className="pt-4 border-t border-stone-800">
          <div className="flex items-center justify-between text-xs">
            <div className="truncate pr-2">
              <div className="font-bold text-white truncate">
                {currentUser?.name || "Floor Staff"}
              </div>
              <div className="text-[11px] capitalize text-stone-400">
                {currentUser?.role || "Staff"}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOutClick}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold hover:bg-stone-800 text-stone-400 hover:text-white cursor-pointer transition-colors shrink-0"
              title="Sign out of station"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* 2. MOBILE TOP NAVBAR (Screen width < md: 768px)             */}
      {/* ============================================================ */}
      <header className="md:hidden sticky top-0 z-30 px-4 py-2.5 bg-[#14110D]/95 border-b border-stone-800/80 backdrop-blur-md flex items-center justify-between select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-sm font-black text-amber-400 shrink-0">
            OD
          </div>
          <div className="min-w-0">
            <h1 className="font-heading text-sm font-black tracking-tight text-white leading-tight truncate">
              {restaurantName}
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] text-stone-400 font-medium">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>POS Live</span>
              {occupiedTablesCount > 0 && (
                <span className="text-amber-400 font-mono">· {occupiedTablesCount} active</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Theme Quick Switcher */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                onToggleTheme(theme === "amber" ? "crimson" : "amber");
              }}
              title="Switch Brand Theme"
              className="w-7 h-7 rounded-full border flex items-center justify-center text-xs cursor-pointer active:scale-95 shadow-xs"
              style={{
                backgroundColor: theme === "amber" ? "#2A2312" : "#741A2F",
                borderColor: theme === "amber" ? "#FFBE0B" : "#FFC6A8",
              }}
            >
              <span>{theme === "amber" ? "👑" : "✨"}</span>
            </button>
          )}

          {/* Profile & Sign-Out Avatar Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="w-7 h-7 rounded-full bg-stone-800 hover:bg-stone-700 border border-stone-700 text-white flex items-center justify-center text-[11px] font-bold cursor-pointer"
            >
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
            </button>

            {profileDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-48 rounded-xl bg-[#1C1712] border border-stone-800 shadow-2xl p-3 z-50 text-xs space-y-2 animate-in fade-in zoom-in-95 duration-150"
                onClick={() => setProfileDropdownOpen(false)}
              >
                <div className="border-b border-stone-800 pb-2">
                  <div className="font-bold text-white truncate">
                    {currentUser?.name || "Floor Staff"}
                  </div>
                  <div className="text-[10px] text-stone-400 capitalize">
                    {currentUser?.role || "Staff"} · {restaurantName}
                  </div>
                </div>

                {isSuperAdmin && (
                  <Link
                    href="/super-admin"
                    className="block px-2 py-1.5 rounded-lg text-amber-300 hover:bg-white/5 font-bold"
                  >
                    ⚡ Super Admin Platform
                  </Link>
                )}

                <button
                  type="button"
                  onClick={handleSignOutClick}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-red-400 hover:bg-red-950/40 font-bold cursor-pointer transition-colors"
                >
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>

          {/* Hamburger Icon only if mobileNavStyle is 'sidebar' */}
          {mobileNavStyle === "sidebar" && (
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-stone-800 cursor-pointer"
              title="Open menu"
            >
              ☰
            </button>
          )}
        </div>
      </header>

      {/* ============================================================ */}
      {/* 3. MOBILE BOTTOM NAVIGATION BAR (1-Thumb Touch Bar)          */}
      {/* ============================================================ */}
      {mobileNavStyle === "bottom_bar" && (
        <nav
          aria-label="Mobile Bottom Navigation"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#12100E]/94 backdrop-blur-2xl border-t border-white/[0.08] px-2 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-[0_-8px_32px_rgba(0,0,0,0.7)] select-none"
        >
          {/* Ambient top glowing hairline */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent pointer-events-none" />

          {navItems.map((item) => {
            const isActive = currentTab === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={handleNavClick}
                className={`relative flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-2xl transition-all duration-200 cursor-pointer active:scale-90 ${
                  isActive
                    ? theme === "crimson"
                      ? "bg-rose-500/15 border border-rose-500/40 text-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.25)] font-bold"
                      : "bg-gradient-to-b from-amber-500/20 to-amber-500/5 border border-amber-500/35 text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.25)] font-bold"
                    : "text-stone-400 hover:text-stone-200 hover:bg-white/[0.03] border border-transparent"
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <div
                    className={`transition-all duration-200 ${
                      isActive ? "scale-110 drop-shadow-[0_2px_8px_rgba(245,158,11,0.35)]" : "opacity-80"
                    }`}
                  >
                    {renderNavIcon(item.key, isActive)}
                  </div>

                  {/* Micro indicator badge for pending kitchen items */}
                  {item.key === "kitchen" && pendingKitchenCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 px-1.5 min-w-4 h-4 rounded-full bg-rose-600 text-white font-mono text-[9px] font-black flex items-center justify-center shadow-md shadow-rose-950 animate-pulse border border-rose-400/50">
                      {pendingKitchenCount > 9 ? "9+" : pendingKitchenCount}
                    </span>
                  )}

                  {/* Live pulsating dot for active occupied tables */}
                  {item.key === "floor" && occupiedTablesCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-[#12100E]" />
                    </span>
                  )}
                </div>

                <span
                  className={`text-[10px] tracking-tight mt-1 leading-none transition-colors ${
                    isActive
                      ? theme === "crimson"
                        ? "font-bold text-rose-300"
                        : "font-bold text-amber-300"
                      : "font-medium text-stone-400"
                  }`}
                >
                  {item.shortLabel}
                </span>

                {isActive && (
                  <span
                    className={`w-3.5 h-0.5 rounded-full ${
                      theme === "crimson"
                        ? "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.9)]"
                        : "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)]"
                    } mt-1 animate-in zoom-in-75 duration-200`}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      )}

      {/* ============================================================ */}
      {/* 4. MOBILE SLIDE-OUT DRAWER (If mobileNavStyle === 'sidebar')  */}
      {/* ============================================================ */}
      {mobileDrawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex animate-in fade-in duration-200"
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div
            className="w-72 max-w-[80vw] h-full bg-[#14110D] border-r border-stone-800 p-5 flex flex-col justify-between animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🍽️</span>
                  <div>
                    <h2 className="font-heading text-base font-bold text-white">Order Desk</h2>
                    <p className="text-xs text-stone-400 truncate max-w-[160px]">{restaurantName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="w-8 h-8 rounded-lg bg-stone-900 text-stone-400 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <nav className="mt-4 space-y-1.5 text-xs font-semibold">
                {navItems.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={handleNavClick}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                      currentTab === item.key
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold"
                        : "text-stone-300 hover:text-white hover:bg-stone-900"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={currentTab === item.key ? "text-amber-400 shrink-0" : "text-stone-400 shrink-0"}>
                        {renderNavIcon(item.key, currentTab === item.key)}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-stone-300">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ))}

                {isSuperAdmin && (
                  <Link
                    href="/super-admin"
                    onClick={handleNavClick}
                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-amber-800/40 bg-amber-950/20 text-amber-300 text-xs font-bold mt-2"
                  >
                    <span>⚡</span>
                    <span>Super Admin Platform</span>
                  </Link>
                )}
              </nav>
            </div>

            <div className="pt-4 border-t border-stone-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">{currentUser?.name || "Staff"}</div>
                <div className="text-[10px] text-stone-400 capitalize">{currentUser?.role || "Staff"}</div>
              </div>
              <button
                type="button"
                onClick={handleSignOutClick}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-stone-900 hover:bg-stone-800 text-red-400 cursor-pointer"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
