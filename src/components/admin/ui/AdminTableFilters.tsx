"use client";

import React, { useState } from "react";
import AdminButton from "./AdminButton";

interface FilterOption {
  label: string;
  value: string;
}

interface AdminTableFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchPlaceholder?: string;
  statusFilter?: string;
  onStatusChange?: (status: string) => void;
  statusOptions?: FilterOption[];
  categoryFilter?: string;
  onCategoryChange?: (cat: string) => void;
  categoryOptions?: FilterOption[];
  onReset?: () => void;
  onExport?: () => void;
  primaryActionLabel?: string;
  primaryActionIcon?: string;
  onPrimaryAction?: () => void;
}

export default function AdminTableFilters({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search by ID, name, or customer...",
  statusFilter = "all",
  onStatusChange,
  statusOptions,
  categoryFilter = "all",
  onCategoryChange,
  categoryOptions,
  onReset,
  onExport,
  primaryActionLabel,
  primaryActionIcon = "fa-plus",
  onPrimaryAction,
}: AdminTableFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-3 mb-4">
      {/* Primary Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search & Quick filters */}
        <div className="flex flex-1 items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-xs" />
              </button>
            )}
          </div>

          {/* Advanced filter toggle button */}
          {(statusOptions || categoryOptions) && (
            <AdminButton
              variant="outline"
              size="md"
              leftIcon="fa-filter"
              onClick={() => setShowAdvanced((p) => !p)}
              className={showAdvanced ? "border-purple-500 text-purple-600 bg-purple-50" : ""}
            >
              Filters
            </AdminButton>
          )}

          {onReset && (searchQuery || statusFilter !== "all" || categoryFilter !== "all") && (
            <AdminButton variant="ghost" size="sm" onClick={onReset} leftIcon="fa-rotate-left">
              Reset
            </AdminButton>
          )}
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-2">
          {onExport && (
            <AdminButton variant="outline" size="md" leftIcon="fa-file-export" onClick={onExport}>
              Export
            </AdminButton>
          )}
          {primaryActionLabel && onPrimaryAction && (
            <AdminButton
              variant="primary"
              size="md"
              leftIcon={primaryActionIcon}
              onClick={onPrimaryAction}
            >
              {primaryActionLabel}
            </AdminButton>
          )}
        </div>
      </div>

      {/* Advanced Filter Collapse Panel */}
      {showAdvanced && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center gap-4 animate-in slide-in-from-top-1 duration-150">
          {statusOptions && onStatusChange && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => onStatusChange(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {categoryOptions && onCategoryChange && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
