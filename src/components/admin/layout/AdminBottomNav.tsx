"use client";

import React from "react";
import { AdminViewType } from "./AdminSidebar";

interface AdminBottomNavProps {
  currentView: AdminViewType;
  onSelectView: (view: AdminViewType) => void;
  onOpenSidebar: () => void;
  activeTablesCount?: number;
  openOrdersCount?: number;
}

export default function AdminBottomNav({
  currentView,
  onSelectView,
  onOpenSidebar,
  activeTablesCount = 0,
  openOrdersCount = 0,
}: AdminBottomNavProps) {
  const navItems = [
    {
      id: "dashboard" as AdminViewType,
      label: "Dashboard",
      icon: "fa-chart-pie",
    },
    {
      id: "floor" as AdminViewType,
      label: "Tables",
      icon: "fa-table-cells",
      badge: activeTablesCount > 0 ? activeTablesCount : undefined,
      badgeColor: "bg-emerald-500",
    },
    {
      id: "orders" as AdminViewType,
      label: "Orders",
      icon: "fa-receipt",
      badge: openOrdersCount > 0 ? openOrdersCount : undefined,
      badgeColor: "bg-amber-500",
    },
    {
      id: "kitchen" as AdminViewType,
      label: "Kitchen",
      icon: "fa-fire-burner",
    },
    {
      id: "menu_items" as AdminViewType,
      label: "Menu",
      icon: "fa-utensils",
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-1.5 py-1 flex items-center justify-around md:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.06)] select-none safe-area-bottom">
      {navItems.map((item) => {
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectView(item.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all relative cursor-pointer active:scale-95 ${
              isActive
                ? "text-purple-600 font-bold"
                : "text-slate-400 hover:text-slate-700 font-medium"
            }`}
          >
            <div className="relative">
              <i
                className={`fa-solid ${item.icon} text-base mb-0.5 ${
                  isActive ? "text-purple-600" : "text-slate-400"
                }`}
              />
              {item.badge !== undefined && (
                <span
                  className={`absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center shadow-xs ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight leading-none mt-0.5">
              {item.label}
            </span>
          </button>
        );
      })}

      {/* "More / Menu Drawer" button */}
      <button
        type="button"
        onClick={onOpenSidebar}
        className="flex flex-col items-center justify-center flex-1 py-1 rounded-xl text-slate-400 hover:text-purple-600 font-medium transition-all relative cursor-pointer active:scale-95"
      >
        <div className="relative">
          <i className="fa-solid fa-bars text-base mb-0.5 text-slate-400" />
        </div>
        <span className="text-[10px] tracking-tight leading-none mt-0.5">
          More
        </span>
      </button>
    </nav>
  );
}
