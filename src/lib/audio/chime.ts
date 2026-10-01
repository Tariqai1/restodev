/**
 * Native Web Audio API Sound Synthesizer & Escalation Engine for Order Desk.
 * Zero external audio file dependencies — operates 100% offline & in all mobile browsers.
 */

// Global AudioContext singleton
let audioCtx: AudioContext | null = null;
let isAudioUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Call on any user tap/click to unlock Web Audio on mobile Safari & Chrome.
 */
export function unlockAudio(): boolean {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume().then(() => {
          isAudioUnlocked = true;
        }).catch(() => {
          isAudioUnlocked = true;
        });
      } else {
        isAudioUnlocked = true;
      }
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function isAudioReady(): boolean {
  return isAudioUnlocked;
}

// ─────────────────────────────────────────────────────────────
// PER-SHIFT MUTE & SNOOZE STATE
// ─────────────────────────────────────────────────────────────
const SNOOZE_KEY = "od_audio_snooze_until";
const MUTE_KEY = "od_audio_muted";

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const muted = localStorage.getItem(MUTE_KEY);
    if (muted === "true") return true;

    const snoozeUntil = localStorage.getItem(SNOOZE_KEY);
    if (snoozeUntil) {
      const until = Number(snoozeUntil);
      if (Date.now() < until) return true;
      // Expired snooze
      localStorage.removeItem(SNOOZE_KEY);
    }
  } catch {}
  return false;
}

export function getSnoozeRemainingMinutes(): number {
  if (typeof window === "undefined") return 0;
  try {
    const snoozeUntil = localStorage.getItem(SNOOZE_KEY);
    if (snoozeUntil) {
      const until = Number(snoozeUntil);
      const remainingMs = until - Date.now();
      if (remainingMs > 0) {
        return Math.ceil(remainingMs / (60 * 1000));
      }
      localStorage.removeItem(SNOOZE_KEY);
    }
  } catch {}
  return 0;
}

export function setSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (muted) {
      localStorage.setItem(MUTE_KEY, "true");
    } else {
      localStorage.removeItem(MUTE_KEY);
      localStorage.removeItem(SNOOZE_KEY);
    }
  } catch {}
}

export function snoozeSound(minutes: number): void {
  if (typeof window === "undefined") return;
  try {
    const until = Date.now() + minutes * 60 * 1000;
    localStorage.setItem(SNOOZE_KEY, until.toString());
  } catch {}
}

export function cancelSnooze(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SNOOZE_KEY);
    localStorage.removeItem(MUTE_KEY);
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// DUAL AUDIO SIGNATURES
// ─────────────────────────────────────────────────────────────

/**
 * 1. New Order Approval Chime:
 * Pleasant, melodic 2-tone harmonic chime (880Hz A5 -> 1174.66Hz D6).
 * Differentiates order approvals from urgent table alerts.
 */
export function playOrderApprovalChime(): void {
  if (isSoundMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Tone 1: A5 (880 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.28, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.36);

    // Tone 2: D6 (1174.66 Hz) - Crisp uplifting note
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1174.66, now + 0.14);
    gain2.gain.setValueAtTime(0.35, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.66);
  } catch {
    // non-fatal audio failure
  }
}

/**
 * 2. Table Waiter Call Buzzer:
 * High-urgency alert buzzer (587Hz D5 -> 880Hz A5 double pulse).
 * Instantly alerts floor staff that a physical guest pressed "Call Waiter".
 */
export function playWaiterCallChime(): void {
  if (isSoundMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Pulse 1: 587Hz -> 880Hz
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.08);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.23);

    // Pulse 2: Repeated urgent beep at now + 0.25s
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(587.33, now + 0.25);
    osc2.frequency.exponentialRampToValueAtTime(880, now + 0.33);
    gain2.gain.setValueAtTime(0.45, now + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.25);
    osc2.stop(now + 0.53);
  } catch {
    // non-fatal
  }
}

/**
 * 3. Escalated Urgent Chime:
 * Fired when an order approval or waiter call remains unacknowledged after 15-20 seconds.
 * 3-pulse urgent escalation sequence.
 */
export function playEscalatedChime(): void {
  if (isSoundMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const pulses = [0, 0.16, 0.32];

    pulses.forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      // Escalating frequency: 784Hz (G5), 880Hz (A5), 1046Hz (C6)
      const freqs = [783.99, 880, 1046.5];
      osc.frequency.setValueAtTime(freqs[idx] || 880, now + offset);
      gain.gain.setValueAtTime(0.3, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.13);
    });
  } catch {
    // non-fatal
  }
}
