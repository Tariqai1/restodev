"use client";

import React, { useState } from "react";

export interface TableItem {
  id: string;
  table_number: string;
  status: string;
}

interface TableTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTable: TableItem | null;
  allTables: TableItem[];
  mode: "shift" | "join";
  onSuccess: () => void;
}

export default function TableTransferModal({
  isOpen,
  onClose,
  sourceTable,
  allTables,
  mode,
  onSuccess,
}: TableTransferModalProps) {
  const [selectedTargetTable, setSelectedTargetTable] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !sourceTable) return null;

  // For shift, we prefer empty tables; for join, any other table is selectable
  const candidateTables = allTables.filter(
    (t) => t.table_number !== sourceTable.table_number
  );

  const isShift = mode === "shift";

  const handleExecute = async () => {
    if (!selectedTargetTable) {
      setErrorMsg(`Please select a table to ${isShift ? "shift to" : "join with"}.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const payload = isShift
        ? {
            action: "transfer_table",
            currentTableNumber: sourceTable.table_number,
            newTableNumber: selectedTargetTable,
          }
        : {
            action: "join_tables",
            sourceTableNumber: selectedTargetTable,
            targetTableNumber: sourceTable.table_number,
          };

      const res = await fetch("/api/orders/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Failed to ${mode} table`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-750 rounded-3xl p-5 shadow-2xl space-y-4 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-bold shadow-xs ${
                isShift
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
              }`}
            >
              <i className={`fa-solid ${isShift ? "fa-arrow-right-arrow-left" : "fa-link"}`} />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                {isShift
                  ? `Shift Table ${sourceTable.table_number}`
                  : `Join Tables with ${sourceTable.table_number}`}
              </h3>
              <p className="text-xs text-slate-400">
                {isShift
                  ? "Move guests & running order to another table"
                  : "Merge tables together for large group dining"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Explain Card */}
        <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-750 text-xs space-y-1">
          <span className="font-bold text-slate-300">
            {isShift ? "📌 How Shift Works:" : "📌 How Join Works:"}
          </span>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            {isShift
              ? `All running dishes and bill amount will be moved from Table ${sourceTable.table_number} to your selected table. Table ${sourceTable.table_number} will become Free immediately.`
              : `Selected table will be linked with Table ${sourceTable.table_number}. Both tables will share one consolidated bill and will be freed together upon settlement.`}
          </p>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Target Table Selector Grid */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300">
            Select Destination Table:
          </label>
          <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            {candidateTables.map((t) => {
              const isSelected = selectedTargetTable === t.table_number;
              const isEmpty = t.status === "empty" || t.status === "available";

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTargetTable(t.table_number)}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    isSelected
                      ? "bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-md scale-[1.02]"
                      : "bg-slate-800/80 hover:bg-slate-750 border-slate-700 text-slate-200"
                  }`}
                >
                  <span className="block font-black text-sm">{t.table_number}</span>
                  <span
                    className={`block text-[10px] font-bold uppercase mt-0.5 ${
                      isSelected
                        ? "text-slate-900"
                        : isEmpty
                        ? "text-emerald-400"
                        : "text-amber-400"
                    }`}
                  >
                    {isEmpty ? "Free" : "Occupied"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-slate-800 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedTargetTable || isSubmitting}
            onClick={handleExecute}
            className={`flex-1 py-2.5 rounded-xl text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 ${
              isShift ? "bg-amber-500 hover:bg-amber-400" : "bg-purple-400 hover:bg-purple-300"
            }`}
          >
            {isSubmitting
              ? "Processing..."
              : isShift
              ? `Confirm Shift → ${selectedTargetTable || "--"}`
              : `Confirm Join + ${selectedTargetTable || "--"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
