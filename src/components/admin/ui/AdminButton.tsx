"use client";

import React from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "success";

interface AdminButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: string;
  rightIcon?: string;
  children: React.ReactNode;
}

export default function AdminButton({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = "",
  disabled,
  ...props
}: AdminButtonProps) {
  const variantClasses = {
    primary:
      "bg-purple-600 hover:bg-purple-700 text-white shadow-xs focus:ring-purple-500",
    secondary:
      "bg-slate-800 hover:bg-slate-900 text-white shadow-xs focus:ring-slate-500",
    outline:
      "bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 focus:ring-purple-500",
    ghost:
      "bg-transparent hover:bg-slate-100 text-slate-700 focus:ring-slate-400",
    danger:
      "bg-rose-600 hover:bg-rose-700 text-white shadow-xs focus:ring-rose-500",
    success:
      "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs focus:ring-emerald-500",
  }[variant];

  const sizeClasses = {
    sm: "px-2.5 py-1.5 text-xs gap-1.5 rounded-lg",
    md: "px-3.5 py-2 text-xs font-semibold gap-2 rounded-xl",
    lg: "px-5 py-2.5 text-sm font-semibold gap-2.5 rounded-xl",
  }[size];

  const isDisabled = disabled || isLoading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center font-medium transition-all active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${variantClasses} ${sizeClasses} ${className}`}
    >
      {isLoading ? (
        <i className="fa-solid fa-circle-notch fa-spin text-xs" />
      ) : leftIcon ? (
        <i className={`fa-solid ${leftIcon} text-xs`} />
      ) : null}
      <span>{children}</span>
      {!isLoading && rightIcon && (
        <i className={`fa-solid ${rightIcon} text-xs`} />
      )}
    </button>
  );
}
