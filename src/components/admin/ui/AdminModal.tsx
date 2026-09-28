"use client";

import React, { useEffect } from "react";
import AdminButton, { ButtonVariant } from "./AdminButton";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  icon?: string;
  iconVariant?: "purple" | "rose" | "amber" | "emerald" | "blue";
  confirmText?: string;
  confirmVariant?: ButtonVariant;
  onConfirm?: () => void;
  isConfirmLoading?: boolean;
  cancelText?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  showFooter?: boolean;
}

export default function AdminModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  icon,
  iconVariant = "purple",
  confirmText = "Confirm",
  confirmVariant = "primary",
  onConfirm,
  isConfirmLoading = false,
  cancelText = "Cancel",
  maxWidth = "md",
  showFooter = true,
}: AdminModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }[maxWidth];

  const iconStyle = {
    purple: "bg-purple-50 text-purple-600 border-purple-200",
    rose: "bg-rose-50 text-rose-600 border-rose-200",
    amber: "bg-amber-50 text-amber-600 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-200",
    blue: "bg-blue-50 text-blue-600 border-blue-200",
  }[iconVariant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className={`relative w-full ${widthClass} bg-white rounded-2xl shadow-2xl border border-slate-200 z-10 overflow-hidden animate-in zoom-in-95 duration-150`}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            {icon && (
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${iconStyle}`}
              >
                <i className={`fa-solid ${icon} text-base`} />
              </div>
            )}
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-snug">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Content Body */}
        {children && (
          <div className="px-6 py-4 max-h-[75vh] overflow-y-auto">{children}</div>
        )}

        {/* Footer */}
        {showFooter && (
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <AdminButton variant="outline" size="sm" onClick={onClose}>
              {cancelText}
            </AdminButton>
            {onConfirm && (
              <AdminButton
                variant={confirmVariant}
                size="sm"
                isLoading={isConfirmLoading}
                onClick={onConfirm}
              >
                {confirmText}
              </AdminButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
