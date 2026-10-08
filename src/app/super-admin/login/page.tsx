"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("tariqfsd9@gmail.com");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !password) {
        throw new Error("Please provide both email and master password.");
      }

      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError) {
        throw new Error(authError.message || "Invalid authentication credentials.");
      }

      // Verify Super Admin clearance
      const verifyRes = await fetch("/api/super-admin/auth/verify");
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.authorized) {
        // Immediately revoke session for non-super-admin
        await supabase.auth.signOut();
        throw new Error("Access Denied: This account does not possess Platform Super Admin clearance.");
      }

      setSuccessMessage("Identity verified. Launching Super Admin Command Deck...");
      setTimeout(() => {
        router.push("/super-admin");
        router.refresh();
      }, 500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Authentication failed");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-amber-500 selection:text-slate-950">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-amber-500/10 rounded-full blur-[140px]" />
      </div>

      <div className="relative w-full max-w-md z-10">
        {/* Terminal Header Motif */}
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-amber-400 tracking-wider uppercase">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Platform Infrastructure · Restricted
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            <i className="fa-solid fa-shield-halved text-amber-500" />
            Super Admin Console
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Authorized platform master sign-in. Multi-tenant registry and global telemetry access.
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-5 backdrop-blur-xl">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-800/80 text-red-200 text-xs flex items-start gap-2.5">
              <i className="fa-solid fa-triangle-exclamation text-red-400 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-200 text-xs flex items-start gap-2.5 font-mono">
              <i className="fa-solid fa-circle-check text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Master Email</span>
                <span className="text-[10px] text-slate-500">Platform Root</span>
              </label>
              <div className="relative">
                <i className="fa-solid fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@orderdesk.internal"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-xs font-mono text-white placeholder-slate-500 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Master Password</span>
                <span className="text-[10px] text-slate-500">Supabase Auth</span>
              </label>
              <div className="relative">
                <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-xs font-mono text-white placeholder-slate-500 outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl font-black text-xs text-slate-950 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer mt-2 active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                  <span>Verifying Master Credentials...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-key text-xs" />
                  <span>Authenticate Master Session →</span>
                </>
              )}
            </button>
          </form>

          {/* Security notice */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <i className="fa-solid fa-lock text-[10px] text-amber-500" />
              Encrypted TLS Session
            </span>
            <Link
              href="/login"
              className="text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1"
            >
              <span>Restaurant Terminal</span>
              <i className="fa-solid fa-arrow-right text-[10px]" />
            </Link>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] font-mono text-slate-500 mt-6">
          Order Desk Platform Engine · Unauthorized access attempts are monitored and recorded.
        </p>
      </div>
    </div>
  );
}

