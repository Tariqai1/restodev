"use client";

import React, { useState, useEffect } from "react";
import AdminKPICard from "@/components/admin/ui/AdminKPICard";
import AdminBadge from "@/components/admin/ui/AdminBadge";
import AdminButton from "@/components/admin/ui/AdminButton";
import { CustomerDemandItem } from "@/lib/platform/state";

interface CustomerDemandsViewProps {
  restaurantId: string;
  onOpenAddDishModal?: (prefilledName?: string) => void;
}

export default function CustomerDemandsView({
  restaurantId,
  onOpenAddDishModal,
}: CustomerDemandsViewProps) {
  const [demands, setDemands] = useState<CustomerDemandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "added_to_menu" | "dismissed">("all");

  const fetchDemands = async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/demands?restaurantId=${encodeURIComponent(restaurantId)}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.demands)) {
        setDemands(data.demands);
      }
    } catch (err) {
      console.error("Failed to load customer demands:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemands();
  }, [restaurantId]);

  const handleUpdateStatus = async (demandId: string, status: "pending" | "added_to_menu" | "dismissed") => {
    try {
      const res = await fetch("/api/admin/demands", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, demandId, status }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.demands)) {
        setDemands(data.demands);
      }
    } catch (err) {
      console.error("Failed to update demand status:", err);
    }
  };

  const handleDelete = async (demandId: string) => {
    if (!confirm("Are you sure you want to remove this demand log?")) return;
    try {
      const res = await fetch(
        `/api/admin/demands?restaurantId=${encodeURIComponent(restaurantId)}&demandId=${encodeURIComponent(demandId)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.ok && Array.isArray(data.demands)) {
        setDemands(data.demands);
      }
    } catch (err) {
      console.error("Failed to delete demand:", err);
    }
  };

  const filtered = demands.filter((d) => {
    const matchesSearch =
      d.itemName.toLowerCase().includes(search.toLowerCase()) ||
      (d.categoryHint && d.categoryHint.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalDemandsCount = demands.reduce((acc, d) => acc + d.count, 0);
  const pendingCount = demands.filter((d) => d.status === "pending").length;
  const topDemand = [...demands].sort((a, b) => b.count - a.count)[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#EDE8E1] flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 text-sm">
              <i className="fa-solid fa-magnifying-glass-chart" />
            </span>
            Customer Demand Insights
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              AI Powered
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-[#A89F91] mt-1">
            Real-time dishes & items requested by customers through the AI Waiter that are not currently on your menu.
          </p>
        </div>

        <AdminButton variant="outline" size="sm" onClick={fetchDemands} leftIcon="fa-rotate">
          Refresh
        </AdminButton>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AdminKPICard
          title="Total Missing Item Requests"
          value={totalDemandsCount.toString()}
          subtext="Customer inquiries logged by AI"
          icon="fa-fire"
          change={`${demands.length} unique`}
          isPositive={true}
        />
        <AdminKPICard
          title="Top Requested Dish"
          value={topDemand ? topDemand.itemName : "None Yet"}
          subtext={topDemand ? `Requested ${topDemand.count} times by guests` : "No demand logged"}
          icon="fa-trophy"
        />
        <AdminKPICard
          title="Pending Review"
          value={pendingCount.toString()}
          subtext="Items to consider adding to menu"
          icon="fa-clock"
        />
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[#110D0A] p-3 rounded-xl border border-[#261E17]">
        <div className="relative flex-1 max-w-sm">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#786D5F] text-xs" />
          <input
            type="text"
            placeholder="Search requested dish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#1C1611] border border-[#2E231B] rounded-lg text-xs text-white placeholder-[#786D5F] focus:outline-hidden focus:border-[#D96B27]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            { key: "all", label: "All" },
            { key: "pending", label: "Pending" },
            { key: "added_to_menu", label: "Added to Menu" },
            { key: "dismissed", label: "Dismissed" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key as any)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === tab.key
                  ? "bg-[#D96B27] text-white shadow-xs"
                  : "bg-[#1C1611] text-[#A89F91] hover:text-white border border-[#2E231B]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Demands List */}
      {loading ? (
        <div className="py-16 text-center text-[#786D5F]">
          <i className="fa-solid fa-spinner fa-spin text-2xl mb-2" />
          <p className="text-xs">Loading customer demands...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center bg-[#110D0A] rounded-2xl border border-[#261E17] p-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto text-xl mb-3">
            <i className="fa-solid fa-bowl-food" />
          </div>
          <h3 className="text-base font-bold text-white">No Customer Demands Logged</h3>
          <p className="text-xs text-[#A89F91] max-w-md mx-auto mt-1">
            When guests ask the AI Waiter for dishes that aren't on your menu (such as Pizza, Burger, Momos, or specific desserts), they will appear here automatically with count analytics!
          </p>
        </div>
      ) : (
        <div className="bg-[#110D0A] rounded-2xl border border-[#261E17] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1C1611] text-[#8C8275] uppercase text-[10px] font-mono tracking-wider border-b border-[#261E17]">
                <tr>
                  <th className="py-3 px-4">Requested Dish</th>
                  <th className="py-3 px-4">Demand Count</th>
                  <th className="py-3 px-4">Category Hint</th>
                  <th className="py-3 px-4">Last Requested</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F1711]">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-[#16120E] transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-white text-sm block">
                        {item.itemName}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        <i className="fa-solid fa-fire text-[10px]" />
                        {item.count} {item.count === 1 ? "guest" : "guests"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#A89F91]">
                      {item.categoryHint || "Special Request"}
                    </td>
                    <td className="py-3.5 px-4 text-[#8C8275] font-mono text-[11px]">
                      {new Date(item.lastRequestedAt).toLocaleString("en-IN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.status === "pending" && (
                        <AdminBadge variant="pending">Pending Review</AdminBadge>
                      )}
                      {item.status === "added_to_menu" && (
                        <AdminBadge variant="approved">Added to Menu</AdminBadge>
                      )}
                      {item.status === "dismissed" && (
                        <AdminBadge variant="neutral">Dismissed</AdminBadge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {onOpenAddDishModal && item.status !== "added_to_menu" && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenAddDishModal(item.itemName);
                              handleUpdateStatus(item.id, "added_to_menu");
                            }}
                            className="px-2.5 py-1 rounded-md bg-[#D96B27] hover:bg-[#E07935] text-white font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                            title="Add directly to restaurant menu"
                          >
                            <i className="fa-solid fa-plus text-[10px]" />
                            <span>Add to Menu</span>
                          </button>
                        )}
                        {item.status === "pending" ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(item.id, "added_to_menu")}
                            className="px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium text-[11px] cursor-pointer"
                            title="Mark as Added"
                          >
                            Mark Added
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(item.id, "pending")}
                            className="px-2 py-1 rounded-md bg-stone-800 hover:bg-stone-700 text-[#A89F91] text-[11px] cursor-pointer"
                            title="Reset to Pending"
                          >
                            Reset
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="w-7 h-7 rounded-md hover:bg-red-500/10 text-stone-500 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
                          title="Delete Demand"
                        >
                          <i className="fa-solid fa-trash text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
