"use client";

import React from "react";

interface AdminKPICardProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  subtext?: string;
  icon: string;
  iconColor?: "purple" | "emerald" | "blue" | "amber" | "rose";
  onClick?: () => void;
}

export default function AdminKPICard({
  title,
  value,
  change,
  isPositive = true,
  subtext = "vs previous period",
  icon,
  iconColor = "purple",
  onClick,
}: AdminKPICardProps) {
  const colorStyles = {
    purple: {
      bg: "bg-purple-50",
      icon: "text-purple-600",
      border: "border-purple-100",
    },
    emerald: {
      bg: "bg-emerald-50",
      icon: "text-emerald-600",
      border: "border-emerald-100",
    },
    blue: {
      bg: "bg-blue-50",
      icon: "text-blue-600",
      border: "border-blue-100",
    },
    amber: {
      bg: "bg-amber-50",
      icon: "text-amber-600",
      border: "border-amber-100",
    },
    rose: {
      bg: "bg-rose-50",
      icon: "text-rose-600",
      border: "border-rose-100",
    },
  }[iconColor];

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
          {title}
        </span>
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorStyles.bg} ${colorStyles.border} border`}
        >
          <i className={`fa-solid ${icon} ${colorStyles.icon} text-sm`} />
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <h3 className="text-2xl font-bold tracking-tight text-slate-900">
          {value}
        </h3>
      </div>

      {(change || subtext) && (
        <div className="flex items-center gap-1.5 text-xs">
          {change && (
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                isPositive ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              <i
                className={`fa-solid ${
                  isPositive ? "fa-arrow-trend-up" : "fa-arrow-trend-down"
                } text-[10px]`}
              />
              {change}
            </span>
          )}
          {subtext && <span className="text-slate-400">{subtext}</span>}
        </div>
      )}
    </div>
  );
}
