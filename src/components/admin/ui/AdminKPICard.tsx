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
      className={`bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 lg:p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between ${
        onClick ? "cursor-pointer active:scale-[0.98]" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-1.5 sm:mb-2.5 gap-1.5 min-w-0">
        <span
          className="text-[10px] sm:text-xs font-bold text-slate-500 tracking-wide uppercase line-clamp-1 leading-tight flex-1"
          title={title}
        >
          {title}
        </span>
        <div
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${colorStyles.bg} ${colorStyles.border} border`}
        >
          <i className={`fa-solid ${icon} ${colorStyles.icon} text-xs sm:text-sm`} />
        </div>
      </div>

      <div className="flex items-baseline gap-1.5 mb-1 sm:mb-1.5 min-w-0">
        <h3 className="text-lg sm:text-xl xl:text-2xl font-black tracking-tight text-slate-900 truncate">
          {value}
        </h3>
      </div>

      {(change || subtext) && (
        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs min-w-0">
          {change && (
            <span
              className={`inline-flex items-center gap-0.5 sm:gap-1 font-bold shrink-0 ${
                isPositive ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              <i
                className={`fa-solid ${
                  isPositive ? "fa-arrow-trend-up" : "fa-arrow-trend-down"
                } text-[8px] sm:text-[10px]`}
              />
              {change}
            </span>
          )}
          {subtext && <span className="text-slate-400 truncate">{subtext}</span>}
        </div>
      )}
    </div>
  );
}
