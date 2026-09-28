"use client";

import React, { useState } from "react";
import Link from "next/link";

export type AdminViewType =
  | "dashboard"
  | "reports"
  | "analytics"
  | "floor"
  | "kitchen"
  | "orders"
  | "approvals"
  | "menu_items"
  | "menu_categories"
  | "stockout"
  | "menu_ocr"
  | "staff"
  | "roles"
  | "activity"
  | "customers"
  | "support"
  | "invoices"
  | "cash_register"
  | "taxes"
  | "qr_studio"
  | "hardware"
  | "ai_config"
  | "settings";

interface NavSubItem {
  id: AdminViewType;
  label: string;
  icon: string;
  badge?: string | number;
}

interface NavSection {
  title: string;
  items: {
    id: string;
    label: string;
    icon: string;
    subItems?: NavSubItem[];
    view?: AdminViewType;
  }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Analytics",
    items: [
      {
        id: "analytics_grp",
        label: "Insights & Reports",
        icon: "fa-chart-pie",
        subItems: [
          { id: "dashboard", label: "Executive Dashboard", icon: "fa-gauge-high" },
          { id: "reports", label: "Sales & Tax Reports", icon: "fa-file-lines" },
          { id: "analytics", label: "Dish Performance", icon: "fa-arrow-trend-up" },
        ],
      },
    ],
  },
  {
    title: "Floor & Live Operations",
    items: [
      {
        id: "operations_grp",
        label: "Bookings & Service",
        icon: "fa-bell-concierge",
        subItems: [
          { id: "floor", label: "Live Floor Plan", icon: "fa-table-cells" },
          { id: "kitchen", label: "Kitchen KDS", icon: "fa-fire-burner" },
          { id: "orders", label: "Dine-In & Orders", icon: "fa-receipt" },
          { id: "approvals", label: "Captain Approvals", icon: "fa-shield-halved" },
        ],
      },
    ],
  },
  {
    title: "Menu & Catalog",
    items: [
      {
        id: "catalog_grp",
        label: "Menu Management",
        icon: "fa-utensils",
        subItems: [
          { id: "menu_items", label: "Dishes & Modifiers", icon: "fa-bowl-food" },
          { id: "menu_categories", label: "Categories", icon: "fa-layer-group" },
          { id: "stockout", label: "86 / Stock Out List", icon: "fa-ban" },
          { id: "menu_ocr", label: "AI Menu Digitizer", icon: "fa-wand-magic-sparkles" },
        ],
      },
    ],
  },
  {
    title: "Staff & Management",
    items: [
      {
        id: "staff_grp",
        label: "Team & Permissions",
        icon: "fa-users-gear",
        subItems: [
          { id: "staff", label: "Staff Roster", icon: "fa-user-tag" },
          { id: "roles", label: "Roles & Access", icon: "fa-lock" },
          { id: "activity", label: "Audit & Activity", icon: "fa-clock-rotate-left" },
        ],
      },
    ],
  },
  {
    title: "Customers & CRM",
    items: [
      {
        id: "crm_grp",
        label: "Guest Relations",
        icon: "fa-user-group",
        subItems: [
          { id: "customers", label: "Customer Directory", icon: "fa-address-book" },
          { id: "support", label: "Support & Cases", icon: "fa-headset" },
        ],
      },
    ],
  },
  {
    title: "Finance & Accounts",
    items: [
      {
        id: "finance_grp",
        label: "Billing & Treasury",
        icon: "fa-money-bill-transfer",
        subItems: [
          { id: "invoices", label: "Invoices & Receipts", icon: "fa-file-invoice-dollar" },
          { id: "cash_register", label: "Day-End Register", icon: "fa-cash-register" },
          { id: "taxes", label: "Taxes & Financial Year", icon: "fa-calculator" },
        ],
      },
    ],
  },
  {
    title: "Configuration & Controls",
    items: [
      {
        id: "config_grp",
        label: "System Controls",
        icon: "fa-gears",
        subItems: [
          { id: "qr_studio", label: "Table QR Studio", icon: "fa-qrcode" },
          { id: "hardware", label: "Hardware & Printers", icon: "fa-print" },
          { id: "ai_config", label: "AI Feature Controls", icon: "fa-microchip" },
          { id: "settings", label: "Administration & Store", icon: "fa-sliders" },
        ],
      },
    ],
  },
];

interface AdminSidebarProps {
  currentView: AdminViewType;
  onSelectView: (view: AdminViewType) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  restaurantName?: string;
}

export default function AdminSidebar({
  currentView,
  onSelectView,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onMobileClose,
  restaurantName = "Order Desk",
}: AdminSidebarProps) {
  // Track open accordion groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    analytics_grp: true,
    operations_grp: true,
    catalog_grp: true,
    staff_grp: true,
    finance_grp: true,
  });

  const toggleGroup = (groupId: string) => {
    if (isCollapsed) {
      onToggleCollapse(); // Expand if collapsed
    }
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <>
      {/* Mobile Dark Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onMobileClose}
        />
      )}

      {/* Fixed Sidebar Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 bg-white border-r border-slate-200/90 flex flex-col transition-all duration-300 ease-in-out ${
          isCollapsed ? "w-[72px]" : "w-[260px]"
        } ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } select-none`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20 shrink-0">
              <i className="fa-solid fa-utensils text-sm" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-slate-900 truncate tracking-tight">
                  {restaurantName}
                </h1>
                <span className="text-[10px] font-mono text-purple-600 font-semibold uppercase tracking-wider block">
                  Owner Admin Deck
                </span>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer hidden lg:flex"
              title="Collapse sidebar"
            >
              <i className="fa-solid fa-chevron-left text-xs" />
            </button>
          )}
        </div>

        {/* Scrollable Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
          {NAV_SECTIONS.map((section, secIdx) => (
            <div key={secIdx} className="space-y-1">
              {!isCollapsed && (
                <h3 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                  {section.title}
                </h3>
              )}

              {section.items.map((item) => {
                const isOpen = openGroups[item.id] || false;
                const hasSub = item.subItems && item.subItems.length > 0;
                const isDirectActive = item.view === currentView;
                const isChildActive =
                  hasSub && item.subItems?.some((sub) => sub.id === currentView);

                return (
                  <div key={item.id} className="relative group">
                    {/* Top Level Item */}
                    <button
                      type="button"
                      onClick={() => {
                        if (hasSub) {
                          toggleGroup(item.id);
                        } else if (item.view) {
                          onSelectView(item.view);
                          onMobileClose();
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        isDirectActive
                          ? "bg-purple-600 text-white shadow-xs"
                          : isChildActive && !isOpen
                          ? "bg-purple-50 text-purple-700 font-semibold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                      } ${isCollapsed ? "justify-center px-0" : "justify-between"}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <i
                          className={`fa-solid ${item.icon} text-sm shrink-0 ${
                            isDirectActive
                              ? "text-white"
                              : isChildActive
                              ? "text-purple-600"
                              : "text-slate-400 group-hover:text-slate-600"
                          } ${isCollapsed ? "w-5 text-center" : ""}`}
                        />
                        {!isCollapsed && (
                          <span className="truncate">{item.label}</span>
                        )}
                      </div>

                      {!isCollapsed && hasSub && (
                        <i
                          className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform duration-200 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      )}
                    </button>

                    {/* Collapsed Tooltip */}
                    {isCollapsed && (
                      <div className="fixed left-20 ml-2 px-3 py-1.5 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap font-medium">
                        {item.label}
                      </div>
                    )}

                    {/* Submenu Accordion */}
                    {hasSub && !isCollapsed && isOpen && (
                      <div className="mt-1 ml-4 pl-3 border-l border-slate-200/80 space-y-0.5 animate-in slide-in-from-top-1 duration-150">
                        {item.subItems!.map((sub) => {
                          const isSubActive = sub.id === currentView;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => {
                                onSelectView(sub.id);
                                onMobileClose();
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                                isSubActive
                                  ? "bg-purple-50 text-purple-700 font-semibold"
                                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <i
                                  className={`fa-solid ${sub.icon} text-[11px] ${
                                    isSubActive
                                      ? "text-purple-600"
                                      : "text-slate-400"
                                  }`}
                                />
                                <span className="truncate">{sub.label}</span>
                              </div>
                              {sub.badge && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                  {sub.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom Expand Toggle when Collapsed */}
        {isCollapsed && (
          <div className="p-3 border-t border-slate-100 flex justify-center hidden lg:flex">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-10 h-10 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              title="Expand sidebar"
            >
              <i className="fa-solid fa-chevron-right text-xs" />
            </button>
          </div>
        )}

        {/* Quick Floor Terminal Shortcut */}
        <div className="p-3 border-t border-slate-100 shrink-0">
          <Link
            href="/"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition-colors ${
              isCollapsed ? "justify-center px-0" : ""
            }`}
          >
            <i className="fa-solid fa-display text-sm text-slate-400" />
            {!isCollapsed && <span>Floor Workspace</span>}
          </Link>
        </div>
      </aside>
    </>
  );
}
