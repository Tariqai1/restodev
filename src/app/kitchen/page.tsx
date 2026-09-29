"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";

type KitchenOrderItem = {
  id: string;
  menu_item_id: string;
  customer_name: string | null;
  qty: number;
  notes: string | null;
  item_status: "pending" | "preparing" | "served";
  created_at: string;
  menu_items?: {
    name: string;
    is_veg: boolean;
  };
};

type KitchenOrder = {
  id: string;
  table_id: string;
  status: string;
  opened_at: string;
  restaurant_tables?: {
    table_number: string;
  };
  order_items: KitchenOrderItem[];
  prepEstimate?: {
    orderId: string;
    minutes: number;
    setAt: string;
    setBy: string;
  } | null;
};

type TodayStats = {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  dishesCooked: number;
};

type DayWiseStat = {
  date: string;
  label: string;
  totalOrders: number;
  completedOrders: number;
  totalDishes: number;
};

export default function KitchenDisplayPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [todayStats, setTodayStats] = useState<TodayStats>({
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
    dishesCooked: 0,
  });
  const [dayWiseStats, setDayWiseStats] = useState<DayWiseStat[]>([]);
  const [isDayWiseModalOpen, setIsDayWiseModalOpen] = useState(false);
  const [highlightDish, setHighlightDish] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "preparing">("all");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string; role: string } | null>(null);
  const previousOrderCountRef = useRef(0);
  const kitchenRequestInFlightRef = useRef(false);
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());

  const unlockAudioContext = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (audioCtx.state === "suspended") {
        audioCtx
          .resume()
          .then(() => setIsAudioUnlocked(true))
          .catch(() => setIsAudioUnlocked(true));
      } else {
        setIsAudioUnlocked(true);
      }
    } catch {
      setIsAudioUnlocked(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleFirstGesture = () => {
      unlockAudioContext();
      window.removeEventListener("click", handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
    };
    window.addEventListener("click", handleFirstGesture);
    window.addEventListener("touchstart", handleFirstGesture);
    return () => {
      window.removeEventListener("click", handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
    };
  }, [unlockAudioContext]);

  // Audio Synthesizer: Chime on New Order
  const playChime = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1046.5, audioCtx.currentTime); // C6
      osc.frequency.exponentialRampToValueAtTime(1318.5, audioCtx.currentTime + 0.08); // E6

      gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.65);
    } catch {
      // Audio context might be restricted
    }
  }, [soundEnabled]);

  // Success Chime: Upbeat Chord when Dish/Ticket is Ready
  const playSuccessChime = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.18, audioCtx.currentTime + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + idx * 0.06 + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + idx * 0.06);
        osc.stop(audioCtx.currentTime + idx * 0.06 + 0.38);
      });
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  // Cook Action Click Chime
  const playCookChime = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.16);
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  const fetchKitchenTickets = useCallback(
    async (isInitial = false) => {
      if (kitchenRequestInFlightRef.current) return;
      kitchenRequestInFlightRef.current = true;
      try {
        const res = await fetch("/api/kitchen");
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to fetch kitchen orders");

        const fetchedOrders: KitchenOrder[] = data.orders || [];
        fetchedOrders.sort(
          (a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime()
        );

        if (!isInitial && fetchedOrders.length > previousOrderCountRef.current) {
          playChime();
        }
        previousOrderCountRef.current = fetchedOrders.length;
        setOrders(fetchedOrders);

        if (data.todayStats) {
          setTodayStats(data.todayStats);
        }
        if (data.dayWiseStats) {
          setDayWiseStats(data.dayWiseStats);
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Error loading tickets");
      } finally {
        kitchenRequestInFlightRef.current = false;
        setIsLoading(false);
      }
    },
    [playChime]
  );

  useEffect(() => {
    fetchKitchenTickets(true);
    const interval = setInterval(() => {
      fetchKitchenTickets(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchKitchenTickets]);

  // Realtime live clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Fetch active staff identity
  useEffect(() => {
    async function loadIdentity() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setCurrentUser({
              name: data.user.name || data.user.email || "Chef Station",
              role: data.user.role || "kitchen",
            });
          }
        }
      } catch {
        // ignore
      }
    }
    loadIdentity();
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  }

  // Set manual cooking duration target
  async function handleSetPrepTime(orderId: string, minutes: number) {
    try {
      const res = await fetch("/api/orders/prep-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, prepMinutes: minutes, setBy: currentUser?.name || "kitchen" }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  prepEstimate: {
                    orderId,
                    minutes,
                    setAt: new Date().toISOString(),
                    setBy: currentUser?.name || "kitchen",
                  },
                }
              : o
          )
        );
      }
    } catch {
      // ignore
    }
  }

  // Bump individual dish status
  async function bumpItem(itemId: string, currentStatus: "pending" | "preparing" | "served") {
    const nextStatus = currentStatus === "pending" ? "preparing" : "served";
    if (nextStatus === "preparing") {
      playCookChime();
    } else {
      playSuccessChime();
    }

    setOrders((prev) =>
      prev.map((ord) => ({
        ...ord,
        order_items: ord.order_items.map((it) =>
          it.id === itemId ? { ...it, item_status: nextStatus } : it
        ),
      }))
    );

    try {
      const res = await fetch("/api/kitchen", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, nextStatus }),
      });
      if (!res.ok) throw new Error("Status update failed");
    } catch {
      fetchKitchenTickets();
    }
  }

  // Bump entire ticket
  async function bumpOrder(orderId: string, markAllStatus: "preparing" | "served") {
    if (markAllStatus === "served") {
      playSuccessChime();
    } else {
      playCookChime();
    }

    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === orderId
          ? {
              ...ord,
              order_items: ord.order_items.map((it) => ({
                ...it,
                item_status: markAllStatus,
              })),
            }
          : ord
      )
    );

    try {
      const res = await fetch("/api/kitchen", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, markAllStatus }),
      });
      if (!res.ok) throw new Error("Order bump failed");
    } catch {
      fetchKitchenTickets();
    }
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function getElapsedMinutes(openedAt: string): number {
    const diff = currentTime - new Date(openedAt).getTime();
    return Math.max(0, Math.floor(diff / 60000));
  }

  // Filter orders based on status tab and search query
  const activeOrders = orders.filter((ord) => {
    const unservedItems = ord.order_items.filter((it) => it.item_status !== "served");
    if (unservedItems.length === 0) return false;

    // Status filter
    if (filter === "pending" && !unservedItems.some((it) => it.item_status === "pending"))
      return false;
    if (filter === "preparing" && !unservedItems.some((it) => it.item_status === "preparing"))
      return false;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const tableMatch = (ord.restaurant_tables?.table_number || "").toLowerCase().includes(q);
      const itemMatch = ord.order_items.some((it) =>
        (it.menu_items?.name || "").toLowerCase().includes(q)
      );
      if (!tableMatch && !itemMatch) return false;
    }

    return true;
  });

  // Calculate Consolidated Pending Dishes (Batch Cooking Aggregator)
  const pendingDishMap: { [name: string]: { count: number; isVeg: boolean; tables: string[] } } =
    {};
  activeOrders.forEach((order) => {
    const tableNum = order.restaurant_tables?.table_number || "T--";
    order.order_items.forEach((item) => {
      if (item.item_status !== "served") {
        const name = item.menu_items?.name || "Dish";
        const isVeg = !!item.menu_items?.is_veg;
        if (!pendingDishMap[name]) {
          pendingDishMap[name] = { count: 0, isVeg, tables: [] };
        }
        pendingDishMap[name].count += item.qty;
        if (!pendingDishMap[name].tables.includes(tableNum)) {
          pendingDishMap[name].tables.push(tableNum);
        }
      }
    });
  });
  const consolidatedDishes = Object.entries(pendingDishMap).sort(
    (a, b) => b[1].count - a[1].count
  );

  const isKitchenRole = currentUser?.role === "kitchen";

  return (
    <div className="min-h-screen flex flex-col select-none bg-slate-950 text-slate-100 font-sans">
      {/* Top Modern Navigation Header */}
      <header className="px-4 sm:px-6 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 shadow-lg">
        <div className="flex items-center gap-3 sm:gap-4">
          {!isKitchenRole && (
            <Link
              href="/"
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <i className="fa-solid fa-chevron-left text-[10px]" />
              <span>Admin Panel</span>
            </Link>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 font-mono">
                Kitchen KDS Station
              </span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[10px] text-emerald-400 font-mono hidden sm:inline">
                Live Synced
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>Live Order Rail</span>
              <span className="text-purple-300 text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-900/50 border border-purple-500/30 font-mono">
                {activeOrders.length} active slips
              </span>
            </h1>
          </div>
        </div>

        {/* Controls: Search, Filters, Sound, Fullscreen, Profile */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table or dish..."
              className="px-3 py-1.5 pl-8 rounded-xl text-xs bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 w-36 sm:w-44 transition-all"
            />
            <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-2 text-slate-500 text-xs" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1.5 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex p-0.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${
                filter === "all"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("pending")}
              className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                filter === "pending"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              New
            </button>
            <button
              type="button"
              onClick={() => setFilter("preparing")}
              className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                filter === "preparing"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Cooking
            </button>
          </div>

          {/* Sound Chime Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer border transition-colors flex items-center gap-1.5 ${
              soundEnabled
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-400"
                : "bg-slate-800 border-slate-700 text-slate-400"
            }`}
            title={soundEnabled ? "Mute bell chime" : "Enable bell chime"}
          >
            <i className={`fa-solid ${soundEnabled ? "fa-bell" : "fa-bell-slash"} text-xs`} />
            <span className="hidden sm:inline">{soundEnabled ? "Chime ON" : "Muted"}</span>
          </button>

          {/* iOS Safari WebAudio Unlock */}
          {soundEnabled && !isAudioUnlocked && (
            <button
              type="button"
              onClick={unlockAudioContext}
              className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer border border-amber-500/60 bg-amber-500/20 text-amber-300 animate-pulse flex items-center gap-1.5 shadow-sm"
              title="Tap to allow tablet/browser to play incoming order chimes"
            >
              <i className="fa-solid fa-volume-high text-xs" />
              <span>Tap to activate audio</span>
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors hidden sm:flex items-center gap-1.5 shadow-2xs"
            title="Toggle TV / Display Fullscreen"
          >
            <i className={`fa-solid ${isFullscreen ? "fa-compress" : "fa-expand"} text-xs`} />
            <span>{isFullscreen ? "Exit" : "Fullscreen"}</span>
          </button>

          {/* Staff Badge & Sign Out */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="w-7 h-7 rounded-lg bg-purple-600/30 text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold text-xs">
              {(currentUser?.name || "CH").slice(0, 2).toUpperCase()}
            </div>
            <span className="text-xs font-bold text-slate-300 hidden md:inline">
              {currentUser?.name || "Kitchen Chef"}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="px-2.5 py-1 rounded-lg text-xs cursor-pointer hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1"
              title="Sign Out"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-[11px]" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        </div>
      </header>

      {/* Metrics Velocity Bar */}
      <section className="px-4 sm:px-6 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-400 font-mono text-[11px] uppercase tracking-wider">
            <i className="fa-solid fa-chart-line text-purple-400 text-xs" />
            <span>Shift Velocity:</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 shadow-2xs">
              <span className="text-purple-400 font-black text-sm font-mono">
                {todayStats.totalOrders}
              </span>
              <span className="text-[11px] text-slate-400">Total Orders</span>
            </div>

            <div className="px-3 py-1 rounded-xl bg-blue-950/40 border border-blue-800/40 flex items-center gap-2 shadow-2xs">
              <span className="text-blue-400 font-black text-sm font-mono">
                {activeOrders.length}
              </span>
              <span className="text-[11px] text-blue-200">Active Cooking</span>
            </div>

            <div className="px-3 py-1 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center gap-2 shadow-2xs">
              <span className="text-emerald-400 font-black text-sm font-mono">
                {todayStats.completedOrders}
              </span>
              <span className="text-[11px] text-emerald-200">Served Today</span>
            </div>

            <div className="px-3 py-1 rounded-xl bg-amber-950/30 border border-amber-800/40 flex items-center gap-2 shadow-2xs">
              <span className="text-amber-300 font-black text-sm font-mono">
                {todayStats.dishesCooked}
              </span>
              <span className="text-[11px] text-amber-200">Dishes Cooked</span>
            </div>
          </div>
        </div>

        {/* Day-Wise Report Button */}
        <button
          type="button"
          onClick={() => setIsDayWiseModalOpen(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-bold text-purple-300 bg-purple-900/30 border border-purple-500/30 hover:bg-purple-900/50 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
        >
          <i className="fa-solid fa-calendar-days text-xs" />
          <span>7-Day Orders Velocity Report</span>
        </button>
      </section>

      {/* Batch Cooking Fire Counter (Consolidated Prep Summary) */}
      {consolidatedDishes.length > 0 && (
        <section className="px-4 sm:px-6 py-2.5 bg-slate-900/70 border-b border-slate-800/80 flex items-center gap-3 overflow-x-auto select-none">
          <div className="flex items-center gap-1.5 shrink-0 text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
            <i className="fa-solid fa-fire text-amber-500 text-xs" />
            <span>Batch Cooking:</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {consolidatedDishes.map(([name, data]) => {
              const isSelected = highlightDish === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setHighlightDish(isSelected ? null : name)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 border ${
                    isSelected
                      ? "bg-purple-600 text-white border-purple-400 shadow-md ring-2 ring-purple-300 scale-105"
                      : "bg-slate-950 text-slate-200 border-slate-800 hover:border-purple-500/60"
                  }`}
                  title={`Click to highlight tickets with ${name} (${data.tables.join(", ")})`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      data.isVeg ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                  />
                  <span className="font-mono text-purple-400 font-extrabold">{data.count}×</span>
                  <span>{name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    [{data.tables.join(",")}]
                  </span>
                </button>
              );
            })}

            {highlightDish && (
              <button
                type="button"
                onClick={() => setHighlightDish(null)}
                className="px-2.5 py-1 rounded-xl text-xs font-bold text-purple-300 hover:text-white bg-slate-800 border border-slate-700 shrink-0 cursor-pointer flex items-center gap-1"
              >
                <i className="fa-solid fa-xmark text-xs" />
                <span>Clear Filter</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Main Order Rail Content */}
      <main className="flex-1 p-4 sm:p-6 overflow-x-auto space-y-6">
        {isLoading && (
          <div className="p-16 text-center text-xs font-bold text-slate-400 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
            <span>Connecting to live kitchen rail...</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 rounded-xl text-xs font-bold bg-rose-950/70 text-rose-200 border border-rose-700 shadow-lg">
            <i className="fa-solid fa-triangle-exclamation mr-1.5" />
            {errorMessage}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && activeOrders.length === 0 && (
          <div className="text-center py-24 space-y-3 max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-2xl shadow-xl">
              <i className="fa-solid fa-check" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Kitchen Rail Clear
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              All tickets cooked and dispatched to floor. Standing by for incoming table orders.
            </p>
            <div className="pt-2">
              <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                Today&apos;s Dispatched: {todayStats.completedOrders} orders • {todayStats.dishesCooked} dishes
              </span>
            </div>
          </div>
        )}

        {/* Grid of Modern High-Contrast Order Slips */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
          {activeOrders.map((order) => {
            const elapsed = getElapsedMinutes(order.opened_at);
            const isCritical = elapsed >= 25; // 25+ min critically overdue
            const isLate = elapsed >= 12 && !isCritical;
            const isAttention = elapsed >= 8 && !isLate && !isCritical;
            const isAllPreparing = order.order_items.every((it) => it.item_status === "preparing");

            const containsHighlightedDish =
              highlightDish &&
              order.order_items.some(
                (it) => it.menu_items?.name === highlightDish && it.item_status !== "served"
              );

            // Urgency border & header styling
            const cardBorder = isCritical
              ? "border-rose-500/80 ring-2 ring-rose-500/40 shadow-xl shadow-rose-950/40"
              : isLate
              ? "border-amber-500/70 shadow-lg"
              : isAttention
              ? "border-purple-500/60"
              : "border-slate-800";

            const timerBadge = isCritical
              ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse font-black"
              : isLate
              ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold"
              : isAttention
              ? "bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold"
              : "bg-slate-800 text-slate-300 border-slate-700 font-medium";

            return (
              <div
                key={order.id}
                className={`rounded-2xl flex flex-col justify-between shadow-xl overflow-hidden transition-all duration-200 border bg-slate-900 ${cardBorder} ${
                  containsHighlightedDish
                    ? "ring-4 ring-purple-400 scale-[1.02] shadow-purple-500/20"
                    : highlightDish
                    ? "opacity-50"
                    : ""
                }`}
              >
                <div>
                  {/* Ticket Header */}
                  <div className="p-3.5 border-b border-slate-800 bg-slate-950/60 flex items-baseline justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">
                          Ticket #{order.id.slice(-4).toUpperCase()}
                        </span>
                        {(() => {
                          const readyCount = order.order_items.filter(
                            (it) => it.item_status === "served"
                          ).length;
                          const totalCount = order.order_items.length;
                          const isFullyReady = readyCount === totalCount && totalCount > 0;
                          return (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isFullyReady
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse"
                                  : readyCount > 0
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                  : "bg-slate-800 text-slate-400 border-slate-700"
                              }`}
                            >
                              {isFullyReady
                                ? "✓ All Ready"
                                : `${readyCount}/${totalCount} Ready`}
                            </span>
                          );
                        })()}
                      </div>
                      <strong className="text-2xl font-black tracking-tight text-white block">
                        Table {order.restaurant_tables?.table_number || "T--"}
                      </strong>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md border font-mono ${timerBadge}`}
                      >
                        {elapsed >= 1440
                          ? `${Math.floor(elapsed / 1440)}d ${Math.floor((elapsed % 1440) / 60)}h`
                          : elapsed >= 60
                          ? `${Math.floor(elapsed / 60)}h ${elapsed % 60}m`
                          : `${elapsed}m ago`}
                      </span>
                      <div className="text-[10px] font-bold mt-1 text-slate-400 uppercase tracking-wider">
                        {isCritical
                          ? "Critically Late"
                          : isLate
                          ? "Late"
                          : isAttention
                          ? "Priority"
                          : "Normal"}
                      </div>
                    </div>
                  </div>

                  {/* Target Duration Setter Strip */}
                  <div className="px-3.5 py-2 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-slate-400">
                      <i className="fa-regular fa-clock text-[11px]" />
                      <span>Target:</span>
                      {order.prepEstimate ? (
                        <span className="font-bold px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-200 border border-purple-500/40 font-mono text-[10px]">
                          {order.prepEstimate.minutes}m
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Unset</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {[10, 15, 20, 30].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => handleSetPrepTime(order.id, mins)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                            order.prepEstimate?.minutes === mins
                              ? "bg-purple-600 text-white shadow-xs"
                              : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                          }`}
                          title={`Set target cook time to ${mins} minutes`}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dish List */}
                  <div className="p-3.5 space-y-2 text-xs">
                    {order.order_items.map((item) => {
                      const isItemServed = item.item_status === "served";
                      const isItemCooking = item.item_status === "preparing";
                      const isItemHighlighted = highlightDish === item.menu_items?.name;

                      return (
                        <div
                          key={item.id}
                          className={`p-2.5 rounded-xl flex items-center justify-between gap-2 transition-all border ${
                            isItemHighlighted
                              ? "ring-2 ring-purple-400 bg-purple-950/50 border-purple-500"
                              : isItemServed
                              ? "bg-slate-950/40 border-slate-800/60 opacity-60"
                              : isItemCooking
                              ? "bg-amber-950/30 border-amber-500/40 shadow-xs"
                              : "bg-slate-950 border-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                item.menu_items?.is_veg ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            />
                            <div className="min-w-0">
                              <div
                                className={`font-bold text-sm truncate ${
                                  isItemServed
                                    ? "line-through text-slate-500"
                                    : "text-slate-100"
                                }`}
                              >
                                <span className="text-purple-400 font-mono font-black mr-1">
                                  {item.qty}×
                                </span>
                                {item.menu_items?.name || "Dish"}
                              </div>
                              {item.notes && (
                                <div className="text-[10px] font-bold mt-0.5 text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-600/40 inline-flex items-center gap-1">
                                  <i className="fa-solid fa-circle-exclamation text-[9px]" />
                                  <span>Note: {item.notes}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 1-Tap Cook / Ready Button */}
                          <div className="shrink-0 flex items-center gap-1.5">
                            {item.item_status === "pending" && (
                              <button
                                type="button"
                                onClick={() => bumpItem(item.id, "pending")}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all cursor-pointer shadow-xs flex items-center gap-1"
                                title="Start cooking this dish"
                              >
                                <i className="fa-solid fa-fire text-xs" />
                                <span>Cook</span>
                              </button>
                            )}

                            {item.item_status === "preparing" && (
                              <button
                                type="button"
                                onClick={() => bumpItem(item.id, "preparing")}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer shadow-xs flex items-center gap-1 animate-pulse"
                                title="Mark dish ready for pickup"
                              >
                                <i className="fa-solid fa-check text-xs" />
                                <span>Ready</span>
                              </button>
                            )}

                            {item.item_status === "served" && (
                              <span className="px-2.5 py-1 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 flex items-center gap-1">
                                <i className="fa-solid fa-check text-xs" />
                                <span>Done</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Direct Action Bump Bar */}
                <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2">
                  {!isAllPreparing && (
                    <button
                      type="button"
                      onClick={() => bumpOrder(order.id, "preparing")}
                      className="flex-1 h-10 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <i className="fa-solid fa-fire text-xs" />
                      <span>Start All</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => bumpOrder(order.id, "served")}
                    className="flex-1 h-10 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <i className="fa-solid fa-check-double text-xs" />
                    <span>Complete Order</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Day-Wise Analytics Modal */}
      {isDayWiseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl p-6 space-y-5 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
                  <i className="fa-solid fa-chart-line text-sm" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Day-Wise Kitchen Velocity Analytics
                  </h3>
                  <p className="text-xs text-slate-400">
                    Shift cooking speed &amp; order volume across the last 7 days
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDayWiseModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            {/* 7-Day Velocity KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                  7-Day Total
                </span>
                <span className="text-2xl font-black text-purple-400 font-mono mt-0.5 block">
                  {dayWiseStats.reduce((sum, d) => sum + d.totalOrders, 0)}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                  Total Served
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono mt-0.5 block">
                  {dayWiseStats.reduce((sum, d) => sum + d.completedOrders, 0)}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                  Dishes Cooked
                </span>
                <span className="text-2xl font-black text-blue-400 font-mono mt-0.5 block">
                  {dayWiseStats.reduce((sum, d) => sum + d.totalDishes, 0)}
                </span>
              </div>
            </div>

            {/* Day Breakdown List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {dayWiseStats.map((item) => {
                const completionRate =
                  item.totalOrders > 0
                    ? Math.round((item.completedOrders / item.totalOrders) * 100)
                    : 0;

                return (
                  <div
                    key={item.date}
                    className="p-3.5 rounded-2xl border border-slate-800 bg-slate-950 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold text-white">{item.label}</strong>
                        <span className="text-[10px] text-slate-500 font-mono">({item.date})</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-2.5">
                        <span>
                          Cooked: <strong className="text-slate-200">{item.totalDishes}</strong> dishes
                        </span>
                        <span>•</span>
                        <span>
                          Completed:{" "}
                          <strong className="text-emerald-400">{item.completedOrders}</strong> /{" "}
                          {item.totalOrders}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-black text-purple-400 font-mono">
                        {item.totalOrders} <span className="text-xs font-normal text-slate-400">Orders</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {completionRate}% Dispatched
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDayWiseModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer transition-colors"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
