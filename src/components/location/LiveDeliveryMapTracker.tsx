"use client";

import React, { useEffect, useRef } from "react";
import { LatLng, DEFAULT_RESTO_COORDINATES, calculateHaversineDistanceKm } from "@/lib/geo/geo-utils";

interface LiveDeliveryMapTrackerProps {
  orderNumber: string;
  stage: "received" | "preparing" | "ready" | "on_the_way" | "delivered";
  customerAddress: string;
  customerCoords?: LatLng | null;
  restoCoords?: LatLng;
  restoName?: string;
  estimatedMinutes?: number;
  customerPhone?: string;
  riderName?: string | null;
  riderPhone?: string | null;
  onClose?: () => void;
}

export default function LiveDeliveryMapTracker({
  orderNumber,
  stage,
  customerAddress,
  customerCoords,
  restoCoords = DEFAULT_RESTO_COORDINATES,
  restoName = "OrderDesk Kitchen",
  estimatedMinutes = 25,
  customerPhone,
  riderName,
  riderPhone,
  onClose,
}: LiveDeliveryMapTrackerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  // Fallback customer coordinates if not explicitly set (offset slightly from restaurant)
  const destCoords: LatLng = customerCoords && customerCoords.lat && customerCoords.lng
    ? customerCoords
    : {
        lat: restoCoords.lat + 0.012,
        lng: restoCoords.lng + 0.015,
      };

  const distanceKm = calculateHaversineDistanceKm(restoCoords, destCoords);

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    async function initTrackerMap() {
      const L = (await import("leaflet")).default;
      if (!isMounted || !mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Center between restaurant and customer
      const midLat = (restoCoords.lat + destCoords.lat) / 2;
      const midLng = (restoCoords.lng + destCoords.lng) / 2;

      const map = L.map(mapContainerRef.current, {
        center: [midLat, midLng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });
      mapInstanceRef.current = map;

      // OpenStreetMap clean tiles (100% free, no API key, zero watermarks)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        subdomains: ["a", "b", "c"],
      }).addTo(map);

      // Restaurant Icon
      const restoIcon = L.divIcon({
        className: "custom-tracker-resto",
        html: `
          <div style="background-color: #0f172a; color: white; padding: 4px 10px; border-radius: 9999px; font-weight: 800; font-size: 11px; border: 2px solid #f59e0b; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
            <span>🍳</span> <span>${restoName}</span>
          </div>
        `,
        iconSize: [120, 30],
        iconAnchor: [60, 15],
      });
      L.marker([restoCoords.lat, restoCoords.lng], { icon: restoIcon }).addTo(map);

      // Customer Destination Icon
      const customerIcon = L.divIcon({
        className: "custom-tracker-customer",
        html: `
          <div style="background-color: #10b981; color: white; padding: 4px 10px; border-radius: 9999px; font-weight: 800; font-size: 11px; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
            <span>📍</span> <span>Delivery Point</span>
          </div>
        `,
        iconSize: [110, 30],
        iconAnchor: [55, 15],
      });
      L.marker([destCoords.lat, destCoords.lng], { icon: customerIcon }).addTo(map);

      // Connecting Route Line
      const routeLine = L.polyline(
        [
          [restoCoords.lat, restoCoords.lng],
          [destCoords.lat, destCoords.lng],
        ],
        {
          color: "#3b82f6",
          weight: 4,
          opacity: 0.8,
          dashArray: "8, 8",
        }
      ).addTo(map);

      // Fit bounds with padding so both markers are visible
      map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

      // Rider Marker (Position based on order stage)
      let riderFraction = 0.1;
      if (stage === "preparing") riderFraction = 0.2;
      if (stage === "ready" || stage === "on_the_way") riderFraction = 0.65;
      if (stage === "delivered") riderFraction = 1.0;

      const riderLat = restoCoords.lat + (destCoords.lat - restoCoords.lat) * riderFraction;
      const riderLng = restoCoords.lng + (destCoords.lng - restoCoords.lng) * riderFraction;

      const riderIcon = L.divIcon({
        className: "custom-tracker-rider",
        html: `
          <div style="background-color: #f59e0b; color: black; width: 34px; height: 34px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.35); animation: pulse 2s infinite;">
            🛵
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      L.marker([riderLat, riderLng], { icon: riderIcon }).addTo(map);
    }

    initTrackerMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [stage, customerCoords]);

  // Stage details
  const getStageInfo = () => {
    switch (stage) {
      case "received":
        return {
          title: "Order Placed & Confirmed",
          desc: "The kitchen has received your order and is reviewing items.",
          badge: "bg-slate-800 text-slate-200",
          eta: `~${estimatedMinutes} mins`,
          progressWidth: "25%",
        };
      case "preparing":
        return {
          title: "Food Cooking in Kitchen",
          desc: "Our master chefs are preparing your hot dishes fresh.",
          badge: "bg-amber-500/20 text-amber-600 border border-amber-500/30",
          eta: `~${Math.max(5, estimatedMinutes - 10)} mins`,
          progressWidth: "55%",
        };
      case "ready":
      case "on_the_way":
        return {
          title: "Out for Delivery",
          desc: "Your meal has left the outlet and is rushing to your doorstep.",
          badge: "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30",
          eta: "Arriving Soon (~10 mins)",
          progressWidth: "85%",
        };
      case "delivered":
        return {
          title: "Delivered & Enjoyed",
          desc: "Your order has been handed over. Bon Appétit!",
          badge: "bg-emerald-600 text-white",
          eta: "Delivered",
          progressWidth: "100%",
        };
      default:
        return {
          title: "Processing Order",
          desc: "Tracking live updates from restaurant.",
          badge: "bg-slate-800 text-slate-200",
          eta: `~${estimatedMinutes} mins`,
          progressWidth: "30%",
        };
    }
  };

  const stageInfo = getStageInfo();

  return (
    <div className="w-full bg-white rounded-3xl overflow-hidden border border-stone-200 shadow-xl flex flex-col">
      {/* Top Header */}
      <div className="p-3.5 bg-stone-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <div>
            <h3 className="text-xs font-black tracking-tight leading-tight">
              Live Order Tracking · #{orderNumber}
            </h3>
            <p className="text-[10px] text-stone-400">
              {restoName} ➔ Your Doorstep ({distanceKm} km)
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-stone-800 hover:bg-stone-700 text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Interactive Map View */}
      <div className="relative w-full h-52 sm:h-64 bg-stone-100">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* ETA Badge Overlay */}
        <div className="absolute top-3 right-3 z-10 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-lg border border-stone-200">
          <span className="text-[9px] uppercase font-bold text-stone-500 block">
            Estimated Arrival
          </span>
          <span className="text-xs font-black text-stone-900 font-mono">
            {stageInfo.eta}
          </span>
        </div>
      </div>

      {/* Progress Bar & Status Details */}
      <div className="p-4 space-y-3 bg-white">
        {/* Animated Progress Bar */}
        <div>
          <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
              style={{ width: stageInfo.progressWidth }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold text-stone-400 mt-1">
            <span>Confirmed</span>
            <span>Cooking</span>
            <span>On The Way</span>
            <span>Delivered</span>
          </div>
        </div>

        {/* Current Stage Card */}
        <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-stone-900">
              {stageInfo.title}
            </h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stageInfo.badge}`}>
              {stage.toUpperCase()}
            </span>
          </div>
          <p className="text-[11px] text-stone-600 leading-relaxed">
            {stageInfo.desc}
          </p>
        </div>

        {/* Assigned Delivery Captain Card */}
        {riderName && (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-black text-sm shadow-sm shrink-0">
                🛵
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-amber-600 block leading-tight">
                  Assigned Delivery Captain
                </span>
                <span className="text-xs font-black text-stone-900 truncate block">
                  {riderName}
                </span>
              </div>
            </div>
            {riderPhone && (
              <a
                href={`tel:${riderPhone}`}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                <i className="fa-solid fa-phone text-[10px]" />
                <span>Call</span>
              </a>
            )}
          </div>
        )}

        {/* Delivery Address Card */}
        <div className="text-xs flex items-start gap-2 text-stone-700 bg-stone-50/50 p-2.5 rounded-xl border border-stone-150">
          <span className="text-rose-500 shrink-0 mt-0.5">📍</span>
          <div className="min-w-0">
            <span className="font-bold text-stone-900 block text-[11px]">
              Delivering To:
            </span>
            <span className="text-[11px] text-stone-600 line-clamp-2">
              {customerAddress}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
