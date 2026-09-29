"use client";

import React, { useState } from "react";
import AdminButton from "./AdminButton";

export interface ColumnDef<T> {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  width?: string;
  sortable?: boolean;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface RowAction<T> {
  label: string;
  icon?: string;
  variant?: "default" | "danger";
  onClick: (row: T) => void;
}

interface AdminDataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyField?: keyof T | ((row: T) => string);
  selectable?: boolean;
  selectedKeys?: string[];
  onSelectionChange?: (selectedKeys: string[]) => void;
  isLoading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptySubtitle?: string;
  rowActions?: RowAction<T>[] | ((row: T) => RowAction<T>[]);
  pageSizeOptions?: number[];
  initialPageSize?: number;
}

export default function AdminDataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField = "id",
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  isLoading = false,
  error = null,
  emptyTitle = "No records found",
  emptySubtitle = "There are no data entries matching your filter criteria.",
  rowActions,
  pageSizeOptions = [10, 25, 50],
  initialPageSize = 10,
}: AdminDataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [openActionRowId, setOpenActionRowId] = useState<string | null>(null);

  const getRowKey = (row: T, index: number): string => {
    if (typeof keyField === "function") return keyField(row);
    return row[keyField] ? String(row[keyField]) : `row-${index}`;
  };

  // Sorting logic
  let sortedData = [...data];
  if (sortKey) {
    sortedData.sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (typeof valA === "number" && typeof valB === "number") {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDirection === "asc"
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
  }

  // Pagination logic
  const totalItems = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

  const handleSort = (key: string, sortable?: boolean) => {
    if (!sortable) return;
    if (sortKey === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortKey(null);
        setSortDirection("asc");
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onSelectionChange) return;
    if (e.target.checked) {
      const allKeys = paginatedData.map((row, i) => getRowKey(row, i));
      onSelectionChange(Array.from(new Set([...selectedKeys, ...allKeys])));
    } else {
      const currentKeys = new Set(paginatedData.map((row, i) => getRowKey(row, i)));
      onSelectionChange(selectedKeys.filter((k) => !currentKeys.has(k)));
    }
  };

  const handleSelectRow = (key: string) => {
    if (!onSelectionChange) return;
    if (selectedKeys.includes(key)) {
      onSelectionChange(selectedKeys.filter((k) => k !== key));
    } else {
      onSelectionChange([...selectedKeys, key]);
    }
  };

  const isAllSelected =
    paginatedData.length > 0 &&
    paginatedData.every((row, i) => selectedKeys.includes(getRowKey(row, i)));

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
      {/* Table Container with Horizontal Scroll */}
      <div className="overflow-x-auto min-h-[300px]">
        <table className="w-full text-left border-collapse text-xs">
          {/* Sticky Table Header */}
          <thead className="bg-slate-50/80 border-b border-slate-200 sticky top-0 z-10 backdrop-blur-xs">
            <tr>
              {selectable && (
                <th className="py-3.5 pl-4 pr-2 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer w-4 h-4"
                  />
                </th>
              )}
              {columns.map((col, colIdx) => (
                <th
                  key={`${col.key}-${colIdx}`}
                  style={{ width: col.width }}
                  onClick={() => handleSort(col.key, col.sortable)}
                  className={`py-3.5 px-4 font-semibold text-slate-600 tracking-wider uppercase text-[11px] select-none ${
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left"
                  } ${
                    col.sortable
                      ? "cursor-pointer hover:text-purple-600 transition-colors"
                      : ""
                  }`}
                >
                  <div
                    className={`inline-flex items-center gap-1.5 ${
                      col.align === "right" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <span>{col.header}</span>
                    {col.sortable && (
                      <i
                        className={`fa-solid ${
                          sortKey === col.key
                            ? sortDirection === "asc"
                              ? "fa-arrow-up-short-wide text-purple-600"
                              : "fa-arrow-down-wide-short text-purple-600"
                            : "fa-sort text-slate-300"
                        } text-[10px]`}
                      />
                    )}
                  </div>
                </th>
              ))}
              {rowActions && (
                <th className="py-3.5 px-4 text-right font-semibold text-slate-600 uppercase text-[11px] w-14">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              // Skeleton loading rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="animate-pulse">
                  {selectable && (
                    <td className="py-4 pl-4 pr-2">
                      <div className="w-4 h-4 bg-slate-200 rounded" />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className="py-4 px-4">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                    </td>
                  ))}
                  {rowActions && (
                    <td className="py-4 px-4 text-right">
                      <div className="h-4 w-6 bg-slate-200 rounded ml-auto" />
                    </td>
                  )}
                </tr>
              ))
            ) : error ? (
              // Error state
              <tr>
                <td
                  colSpan={
                    columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)
                  }
                  className="py-12 text-center"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-50 text-rose-600 mb-3 border border-rose-200">
                    <i className="fa-solid fa-triangle-exclamation text-base" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">
                    Failed to Load Data
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {error}
                  </p>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              // Empty state
              <tr>
                <td
                  colSpan={
                    columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)
                  }
                  className="py-16 text-center"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-3">
                    <i className="fa-solid fa-inbox text-lg" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    {emptyTitle}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    {emptySubtitle}
                  </p>
                </td>
              </tr>
            ) : (
              // Rows
              paginatedData.map((row, index) => {
                const rowKey = getRowKey(row, index);
                const isSelected = selectedKeys.includes(rowKey);
                const actions =
                  typeof rowActions === "function"
                    ? rowActions(row)
                    : rowActions;

                return (
                  <tr
                    key={rowKey}
                    className={`hover:bg-purple-50/30 transition-colors ${
                      isSelected ? "bg-purple-50/50" : ""
                    }`}
                  >
                    {selectable && (
                      <td className="py-3.5 pl-4 pr-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(rowKey)}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer w-4 h-4"
                        />
                      </td>
                    )}
                    {columns.map((col, colIdx) => (
                      <td
                        key={`${col.key}-${colIdx}`}
                        className={`py-3.5 px-4 text-slate-700 ${
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                            ? "text-center"
                            : "text-left"
                        }`}
                      >
                        {col.render
                          ? col.render(row, startIndex + index)
                          : row[col.key] !== undefined && row[col.key] !== null
                          ? String(row[col.key])
                          : "—"}
                      </td>
                    ))}
                    {actions && actions.length > 0 && (
                      <td className="py-3.5 px-4 text-right relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenActionRowId(
                              openActionRowId === rowKey ? null : rowKey
                            )
                          }
                          className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <i className="fa-solid fa-ellipsis-vertical text-xs" />
                        </button>

                        {/* Action Dropdown Menu */}
                        {openActionRowId === rowKey && (
                          <>
                            <div
                              className="fixed inset-0 z-20"
                              onClick={() => setOpenActionRowId(null)}
                            />
                            <div className="absolute right-4 top-10 z-30 w-36 bg-white rounded-xl shadow-lg border border-slate-200 py-1 text-left animate-in fade-in zoom-in-95 duration-100">
                              {actions.map((act, actIdx) => (
                                <button
                                  key={actIdx}
                                  type="button"
                                  onClick={() => {
                                    setOpenActionRowId(null);
                                    act.onClick(row);
                                  }}
                                  className={`w-full px-3 py-2 text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                                    act.variant === "danger"
                                      ? "text-rose-600 hover:bg-rose-50"
                                      : "text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  {act.icon && (
                                    <i
                                      className={`fa-solid ${act.icon} text-[11px]`}
                                    />
                                  )}
                                  <span>{act.label}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && !error && totalItems > 0 && (
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          {/* Page size & total count */}
          <div className="flex items-center gap-3">
            <span>
              Showing{" "}
              <span className="font-semibold text-slate-900">
                {startIndex + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-900">
                {Math.min(startIndex + pageSize, totalItems)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-900">{totalItems}</span>{" "}
              results
            </span>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[11px] text-slate-500">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-1">
            <AdminButton
              variant="outline"
              size="sm"
              disabled={validCurrentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="px-2"
            >
              <i className="fa-solid fa-angles-left text-[10px]" />
            </AdminButton>
            <AdminButton
              variant="outline"
              size="sm"
              disabled={validCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5"
            >
              <i className="fa-solid fa-chevron-left text-[10px]" />
            </AdminButton>

            <span className="px-3 py-1 font-semibold text-purple-700 bg-purple-50 rounded-lg border border-purple-200">
              Page {validCurrentPage} of {totalPages}
            </span>

            <AdminButton
              variant="outline"
              size="sm"
              disabled={validCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5"
            >
              <i className="fa-solid fa-chevron-right text-[10px]" />
            </AdminButton>
            <AdminButton
              variant="outline"
              size="sm"
              disabled={validCurrentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="px-2"
            >
              <i className="fa-solid fa-angles-right text-[10px]" />
            </AdminButton>
          </div>
        </div>
      )}
    </div>
  );
}
