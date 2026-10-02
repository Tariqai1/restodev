"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  LatLng,
  DEFAULT_RESTO_COORDINATES,
  checkDeliveryServiceability,
  reverseGeocodeCoords,
} from "@/lib/geo/geo-utils";

export interface SelectedLocationData {
  lat: number;
  lng: number;
  formattedAddress: string;
  flatNo: string;
  area: string;
  landmark: string;
  tag: "home" | "work" | "other";
  distanceKm: number;
  isServiceable: boolean;
}

interface MapLocationPickerProps {
  isOpen: boolean;
  onClose: () => void;
  restoCoords?: LatLng;
  restoName?: string;
  deliveryRadiusKm?: number;
  onConfirmLocation: (location: SelectedLocationData) => void;
}

export default function MapLocationPicker({
  isOpen,
  onClose,
  restoCoords = DEFAULT_RESTO_COORDINATES,
  restoName = "Our Restaurant",
  deliveryRadiusKm = 5,
  onConfirmLocation,
}: MapLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const circleLayerRef = useRef<any>(null);

  // User pin position (center of map)
  const [currentCoords, setCurrentCoords] = useState<LatLng>(restoCoords);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isMapDragging, setIsMapDragging] = useState(false);

  // Address form fields
  const [flatNo, setFlatNo] = useState("");
  const [areaText, setAreaText] = useState("");
  const [landmark, setLandmark] = useState("");
  const [addressTag, setAddressTag] = useState<"home" | "work" | "other">("home");

  // Serviceability state
  const serviceCheck = checkDeliveryServiceability(
    restoCoords,
    currentCoords,
    deliveryRadiusKm
  );

  // ─────────────────────────────────────────────────────────────
  // 1. INITIALIZE LEAFLET MAP DYNAMICALLY ON MOUNT
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    async function initLeaflet() {
      const L = (await import("leaflet")).default;

      if (!isMounted || !mapContainerRef.current) return;

      // Clean up previous instance if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Initial center: either restaurant coords or user position
      const initialCenter: [number, number] = [currentCoords.lat, currentCoords.lng];

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 15,
        zoomControl: false,
      });

      mapInstanceRef.current = map;

      // Add Zoom Control to bottom-right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // CartoDB Voyager clean modern map tiles (Swiggy / Zepto style)
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 19,
        }
      ).addTo(map);

      // Draw Delivery Radius Circle around restaurant
      circleLayerRef.current = L.circle([restoCoords.lat, restoCoords.lng], {
        radius: deliveryRadiusKm * 1000,
        color: "#10b981",
        fillColor: "#10b981",
        fillOpacity: 0.08,
        weight: 2,
        dashArray: "6, 6",
      }).addTo(map);

      // Restaurant Marker with custom HTML icon
      const restoIcon = L.divIcon({
        className: "custom-resto-pin",
        html: `
          <div style="background-color: #0f172a; color: white; padding: 4px 8px; border-radius: 9999px; font-weight: 800; font-size: 11px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2px solid #f59e0b; display: flex; align-items: center; gap: 4px; white-space: nowrap;">
            <span>🍽️</span> <span>${restoName}</span>
          </div>
        `,
        iconSize: [120, 30],
        iconAnchor: [60, 15],
      });

      L.marker([restoCoords.lat, restoCoords.lng], { icon: restoIcon }).addTo(map);

      // Map drag listeners
      map.on("dragstart", () => {
        setIsMapDragging(true);
      });

      map.on("dragend moveend", async () => {
        setIsMapDragging(false);
        const center = map.getCenter();
        const nextCoords = { lat: center.lat, lng: center.lng };
        setCurrentCoords(nextCoords);

        // Reverse geocode to get address
        setIsGeocoding(true);
        try {
          const geo = await reverseGeocodeCoords(nextCoords.lat, nextCoords.lng);
          setAreaText(geo.road ? `${geo.road}, ${geo.suburb || geo.city}` : geo.formattedAddress);
        } finally {
          setIsGeocoding(false);
        }
      });

      // Trigger initial reverse geocode
      setIsGeocoding(true);
      reverseGeocodeCoords(currentCoords.lat, currentCoords.lng)
        .then((geo) => {
          setAreaText(geo.road ? `${geo.road}, ${geo.suburb || geo.city}` : geo.formattedAddress);
        })
        .finally(() => setIsGeocoding(false));
    }

    initLeaflet();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  // ─────────────────────────────────────────────────────────────
  // 2. GPS AUTO-DETECT LOCATION
  // ─────────────────────────────────────────────────────────────
  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      alert("GPS Geolocation is not supported by your browser.");
      return;
    }

    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        const newCoords = { lat: userLat, lng: userLng };

        setCurrentCoords(newCoords);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([userLat, userLng], 16, { animate: true, duration: 1.2 });
        }

        setIsGeocoding(true);
        try {
          const geo = await reverseGeocodeCoords(userLat, userLng);
          setAreaText(geo.road ? `${geo.road}, ${geo.suburb || geo.city}` : geo.formattedAddress);
        } finally {
          setIsGeocoding(false);
          setIsLocatingGps(false);
        }
      },
      (err) => {
        console.warn("[GPS Error]", err);
        setIsLocatingGps(false);
        alert("Unable to fetch your current GPS position. Please drag the map manually.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // ─────────────────────────────────────────────────────────────
  // 3. SUBMIT & CONFIRM
  // ─────────────────────────────────────────────────────────────
  const handleConfirm = () => {
    if (!serviceCheck.isServiceable) {
      alert(serviceCheck.message);
      return;
    }

    if (!flatNo.trim()) {
      alert("Please enter your House / Flat / Floor Number.");
      return;
    }

    const fullFormatted = [flatNo.trim(), areaText.trim(), landmark.trim() ? `Near ${landmark.trim()}` : ""]
      .filter(Boolean)
      .join(", ");

    onConfirmLocation({
      lat: currentCoords.lat,
      lng: currentCoords.lng,
      formattedAddress: fullFormatted,
      flatNo: flatNo.trim(),
      area: areaText.trim(),
      landmark: landmark.trim(),
      tag: addressTag,
      distanceKm: serviceCheck.distanceKm,
      isServiceable: serviceCheck.isServiceable,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs overscroll-contain animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-stone-200">
        {/* Header */}
        <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between bg-stone-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm">
              📍
            </span>
            <div>
              <h3 className="text-sm font-black text-stone-900 leading-tight">
                Select Delivery Location
              </h3>
              <p className="text-[11px] text-stone-500 font-medium">
                Drag map to drop pin at your exact doorstep
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Interactive Map Area with Floating Center Pin */}
        <div className="relative w-full h-64 sm:h-72 bg-stone-100 shrink-0">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Floating Center Pin (Uber / Swiggy Style) */}
          <div
            className={`pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-10 transition-transform duration-150 flex flex-col items-center ${
              isMapDragging ? "-translate-y-[120%] scale-110" : ""
            }`}
          >
            <div className="bg-stone-950 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap mb-1 flex items-center gap-1 border border-amber-400">
              <span>Order will be delivered here</span>
            </div>
            <div className="text-3xl filter drop-shadow-md">📍</div>
            <div className="w-3 h-1 bg-black/30 rounded-full blur-[1px]" />
          </div>

          {/* Floating GPS Button */}
          <button
            type="button"
            onClick={handleDetectGps}
            disabled={isLocatingGps}
            className="absolute right-3 bottom-3 z-10 bg-white hover:bg-stone-50 active:scale-95 text-stone-900 text-xs font-bold px-3 py-2 rounded-xl shadow-lg border border-stone-200 flex items-center gap-1.5 cursor-pointer transition-all"
          >
            {isLocatingGps ? (
              <span className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-emerald-600">🎯</span>
            )}
            <span>{isLocatingGps ? "Locating..." : "Use Current Location"}</span>
          </button>

          {/* Live Delivery Zone Indicator Pill */}
          <div className="absolute top-3 left-3 z-10">
            <div
              className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold shadow-md border flex items-center gap-1.5 backdrop-blur-md ${
                serviceCheck.isServiceable
                  ? "bg-emerald-500/90 text-white border-emerald-400"
                  : "bg-rose-500/95 text-white border-rose-400 animate-pulse"
              }`}
            >
              <span>{serviceCheck.isServiceable ? "✓ Deliverable" : "✕ Too Far"}</span>
              <span className="opacity-75 font-mono">({serviceCheck.distanceKm} km)</span>
            </div>
          </div>
        </div>

        {/* Address Inputs & Confirmation */}
        <div className="p-4 overflow-y-auto space-y-3 bg-white">
          {/* Detected Area */}
          <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200">
            <div className="flex items-center justify-between text-[11px] text-stone-500 font-bold mb-1">
              <span>DETECTED LOCATION</span>
              {isGeocoding && <span className="text-amber-600 animate-pulse">Fetching address...</span>}
            </div>
            <p className="text-xs font-bold text-stone-800 leading-snug line-clamp-2">
              {areaText || "Move map pin to detect your street..."}
            </p>
          </div>

          {/* House / Flat No & Landmark */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-stone-600 mb-1">
                House / Flat / Floor No. <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Flat 302, Royal Residency"
                value={flatNo}
                onChange={(e) => setFlatNo(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-600 mb-1">
                Nearby Landmark (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Behind City Hospital"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Save As Tag */}
          <div>
            <label className="block text-[11px] font-bold text-stone-600 mb-1.5">
              Save Address As
            </label>
            <div className="flex items-center gap-2">
              {[
                { tag: "home", label: "🏠 Home" },
                { tag: "work", label: "🏢 Work" },
                { tag: "other", label: "📍 Other" },
              ].map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => setAddressTag(t.tag as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    addressTag === t.tag
                      ? "bg-stone-900 text-white border-stone-900 shadow-xs"
                      : "bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Confirm Button */}
          <div className="pt-2">
            <button
              type="button"
              disabled={!serviceCheck.isServiceable || !flatNo.trim()}
              onClick={handleConfirm}
              className={`w-full py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                serviceCheck.isServiceable && flatNo.trim()
                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-98"
                  : "bg-stone-200 text-stone-400 cursor-not-allowed"
              }`}
            >
              <span>Confirm & Deliver Here</span>
              <span className="text-xs font-normal">
                ({serviceCheck.distanceKm} km)
              </span>
            </button>
            {!serviceCheck.isServiceable && (
              <p className="text-[11px] text-rose-600 font-bold text-center mt-1.5">
                {serviceCheck.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
