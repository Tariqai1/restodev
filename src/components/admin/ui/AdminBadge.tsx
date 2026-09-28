"use client";

import React from "react";

export type BadgeVariant =
  | "active"
  | "inactive"
  | "pending"
  | "approved"
  | "rejected"
  | "failed"
  | "completed"
  | "cancelled"
  | "draft"
  | "cooking"
  | "ready"
  | "served"
  | "paid"
  | "unpaid"
  | "neutral";

interface AdminBadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const BADGE_CONFIG: Record<
  BadgeVariant,
  { bg: string; text: string; border: string; defaultIcon: string }
> = {
  active: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    defaultIcon: "fa-circle-check",
  },
  approved: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    defaultIcon: "fa-check",
  },
  completed: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    defaultIcon: "fa-circle-check",
  },
  paid: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    defaultIcon: "fa-receipt",
  },
  served: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-200",
    defaultIcon: "fa-utensils",
  },
  pending: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    defaultIcon: "fa-clock",
  },
  cooking: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    defaultIcon: "fa-fire",
  },
  ready: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    defaultIcon: "fa-bell-concierge",
  },
  rejected: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    defaultIcon: "fa-ban",
  },
  failed: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    defaultIcon: "fa-circle-exclamation",
  },
  cancelled: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    defaultIcon: "fa-xmark",
  },
  inactive: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
    defaultIcon: "fa-circle-pause",
  },
  draft: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
    defaultIcon: "fa-file-lines",
  },
  unpaid: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    defaultIcon: "fa-hourglass-half",
  },
  neutral: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    defaultIcon: "fa-circle",
  },
};

export default function AdminBadge({
  variant = "neutral",
  children,
  icon,
  size = "md",
  className = "",
}: AdminBadgeProps) {
  const conf = BADGE_CONFIG[variant] || BADGE_CONFIG.neutral;
  const chosenIcon = icon !== undefined ? icon : conf.defaultIcon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-xs font-semibold gap-2",
  }[size];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${conf.bg} ${conf.text} ${conf.border} ${sizeClasses} ${className}`}
    >
      {chosenIcon && (
        <i
          className={`fa-solid ${chosenIcon} ${
            size === "sm" ? "text-[8px]" : "text-[10px]"
          }`}
        />
      )}
      <span>{children}</span>
    </span>
  );
}
