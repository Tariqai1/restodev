"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AdminButton from "../ui/AdminButton";

interface AdminHeaderProps {
  pageTitle: string;
  breadcrumb?: string[];
  onOpenMobileSidebar: () => void;
  userName?: string;
  userEmail?: string;
  restaurantName?: string;
  activeTablesCount?: number;
  totalTablesCount?: number;
  onQuickAction?: () => void;
  onSelectView?: (view: any) => void;
}

export default function AdminHeader({
  pageTitle,
  breadcrumb = ["Admin", "Dashboard"],
  onOpenMobileSidebar,
  userName = "Owner",
  userEmail = "owner@restaurant.com",
  restaurantName = "Order Desk",
  activeTablesCount = 0,
  totalTablesCount = 0,
  onQuickAction,
  onSelectView,
}: AdminHeaderProps) {
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

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
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      {/* Left: Mobile Toggle & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 lg:hidden cursor-pointer"
        >
          <i className="fa-solid fa-bars text-sm" />
        </button>

        <div className="min-w-0">
          {/* Breadcrumb */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
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

          <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
            {pageTitle}
          </h2>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Table Occupancy Status Pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            <strong className="text-slate-900">{activeTablesCount}</strong> of{" "}
            {totalTablesCount} Tables Active
          </span>
        </div>

        {/* Online Orders Quick Switch */}
        {onSelectView && (
          <button
            type="button"
            onClick={() => onSelectView("online_orders")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-bold text-amber-900 transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Manage Online Orders & Storefront"
          >
            <i className="fa-solid fa-motorcycle text-xs text-amber-600" />
            <span>Online Orders</span>
          </button>
        )}

        {/* Floor Workspace Quick Switch */}
        {onSelectView && (
          <button
            type="button"
            onClick={() => onSelectView("floor")}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:text-purple-600 hover:border-purple-300 transition-colors shadow-2xs cursor-pointer"
          >
            <i className="fa-solid fa-table-cells text-xs text-purple-600" />
            <span>Floor View</span>
          </button>
        )}

        {/* Quick Action Button */}
        {onQuickAction && (
          <AdminButton
            variant="primary"
            size="sm"
            leftIcon="fa-plus"
            onClick={onQuickAction}
          >
            New Dish
          </AdminButton>
        )}

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
            className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {initials}
            </div>
            <div className="hidden sm:block text-left min-w-0">
              <span className="block text-xs font-bold text-slate-900 leading-tight truncate">
                {userName}
              </span>
              <span className="block text-[10px] text-purple-600 font-mono leading-none">
                Restaurant Owner
              </span>
            </div>
            <i className="fa-solid fa-chevron-down text-[10px] text-slate-400 hidden sm:block" />
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
    </header>
  );
}
