"use client";

import React, { useState } from "react";
import AdminButton from "../ui/AdminButton";
import AdminBadge from "../ui/AdminBadge";

export interface ActivityLogItem {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: "owner" | "manager" | "captain" | "waiter" | "kitchen" | "system";
  actionType:
    | "order_created"
    | "order_status"
    | "dish_86"
    | "dish_restocked"
    | "price_changed"
    | "pin_updated"
    | "staff_status"
    | "role_matrix_saved"
    | "bill_settled"
    | "cash_reconciled";
  description: string;
  severity: "info" | "warning" | "critical";
  metadata?: Record<string, any>;
}

const DEFAULT_ACTIVITY_LOGS: ActivityLogItem[] = [
  {
    id: "act-1",
    timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    actorName: "Rahul Sharma",
    actorRole: "captain",
    actionType: "order_created",
    description: "Approved Table 4 digital QR order with 3 items (₹780)",
    severity: "info",
    metadata: { table: "4", total: 780 },
  },
  {
    id: "act-2",
    timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    actorName: "Chef Vikram",
    actorRole: "kitchen",
    actionType: "dish_86",
    description: "Marked 'Paneer Tikka' as 86 / Sold Out due to ingredient shortage",
    severity: "warning",
    metadata: { dish: "Paneer Tikka" },
  },
  {
    id: "act-3",
    timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    actorName: "Admin Owner",
    actorRole: "owner",
    actionType: "pin_updated",
    description: "Reset fast login PIN for Waiter Suresh (Staff ID: staff-102)",
    severity: "critical",
    metadata: { staff: "Suresh" },
  },
  {
    id: "act-4",
    timestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    actorName: "Admin Owner",
    actorRole: "owner",
    actionType: "role_matrix_saved",
    description: "Updated RBAC permissions for Captain role (Enabled Discount & Bill Edit)",
    severity: "critical",
  },
  {
    id: "act-5",
    timestamp: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    actorName: "Cashier Amit",
    actorRole: "manager",
    actionType: "bill_settled",
    description: "Settled Bill #INV-1082 for Table 8 via PhonePe UPI (₹1,420)",
    severity: "info",
    metadata: { bill: "INV-1082", mode: "UPI" },
  },
  {
    id: "act-6",
    timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    actorName: "Admin Owner",
    actorRole: "owner",
    actionType: "price_changed",
    description: "Updated portion pricing for 'Butter Chicken': Full ₹380, Half ₹230",
    severity: "warning",
  },
  {
    id: "act-7",
    timestamp: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
    actorName: "System",
    actorRole: "system",
    actionType: "cash_reconciled",
    description: "Day-End Cash register opening float of ₹5,000 verified with 0 variance",
    severity: "info",
  },
];

export default function ActivityLogsView() {
  const [logs, setLogs] = useState<ActivityLogItem[]>(DEFAULT_ACTIVITY_LOGS);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.description.toLowerCase().includes(search.toLowerCase()) ||
      log.actorName.toLowerCase().includes(search.toLowerCase()) ||
      log.actionType.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || log.actorRole === roleFilter;
    const matchesSeverity = severityFilter === "all" || log.severity === severityFilter;
    return matchesSearch && matchesRole && matchesSeverity;
  });

  const getRoleBadge = (role: ActivityLogItem["actorRole"]) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "manager":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "captain":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "kitchen":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "waiter":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const getActionIcon = (type: ActivityLogItem["actionType"]) => {
    switch (type) {
      case "order_created":
        return "fa-receipt text-blue-500";
      case "dish_86":
        return "fa-ban text-rose-500";
      case "dish_restocked":
        return "fa-check-circle text-emerald-500";
      case "pin_updated":
        return "fa-key text-amber-500";
      case "role_matrix_saved":
        return "fa-shield-halved text-purple-500";
      case "bill_settled":
        return "fa-circle-dollar-to-slot text-emerald-600";
      case "price_changed":
        return "fa-tag text-indigo-500";
      default:
        return "fa-circle-info text-slate-400";
    }
  };

  return (
    <div className="space-y-5">
      {/* Activity Logs Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200 mb-2">
            <i className="fa-solid fa-list-check text-[11px]" />
            <span>Immutable Audit Trail</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Audit & Activity Logs
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full compliance record of staff logins, PIN changes, item 86 actions, role permissions, and financial settlements.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <AdminButton
            variant="outline"
            size="sm"
            leftIcon="fa-file-arrow-down"
            onClick={() => {
              const csvContent =
                "data:text/csv;charset=utf-8," +
                ["Timestamp,Actor,Role,Action,Description,Severity"]
                  .concat(
                    filteredLogs.map(
                      (l) =>
                        `"${l.timestamp}","${l.actorName}","${l.actorRole}","${l.actionType}","${l.description}","${l.severity}"`
                    )
                  )
                  .join("\n");
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            Export CSV
          </AdminButton>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-600">Role:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-semibold focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Roles</option>
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="captain">Captain</option>
            <option value="kitchen">Kitchen</option>
            <option value="waiter">Waiter</option>
            <option value="system">System</option>
          </select>

          <span className="font-bold text-slate-600 ml-2">Severity:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-semibold focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-purple-500 w-60"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="divide-y divide-slate-100">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-4 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                  <i className={`fa-solid ${getActionIcon(log.actionType)} text-xs`} />
                </div>

                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900">{log.description}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${getRoleBadge(
                        log.actorRole
                      )}`}
                    >
                      {log.actorRole}
                    </span>
                    {log.severity === "critical" && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-100 text-rose-700 uppercase">
                        Audit Alert
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-3">
                    <span>
                      Actor: <strong className="text-slate-700">{log.actorName}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(log.timestamp).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-slate-400 font-mono text-[11px] sm:text-right">
                {new Date(log.timestamp).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </div>
          ))}

          {filteredLogs.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              <i className="fa-solid fa-clipboard-check text-2xl text-slate-300 mb-2 block" />
              <span className="text-xs font-semibold">No logs found matching your filters</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
