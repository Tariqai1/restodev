"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  LatLng,
  DEFAULT_RESTO_COORDINATES,
  checkDeliveryServiceability,
  reverseGeocodeCoords,
  searchLocality,
  LocalitySearchResult,
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
  const [gpsNotice, setGpsNotice] = useState<{
    type: "info" | "warning" | "error";
    message: string;
  } | null>(null);

  // Search locality state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LocalitySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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
        attributionControl: false, // 100% remove Leaflet attribution watermark
      });

      mapInstanceRef.current = map;

      // Clean OpenStreetMap tiles without any watermark/attribution overlay
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        subdomains: ["a", "b", "c"],
      }).addTo(map);

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
      setGpsNotice({
        type: "warning",
        message: "GPS Geolocation is not supported by your browser. Please drag the pin on the map to your address.",
      });
      return;
    }

    setIsLocatingGps(true);
    setGpsNotice(null);

    const applyPosition = async (pos: GeolocationPosition) => {
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
    };

    // Phase 1: Try GPS with 6s timeout & cached positions accepted up to 60s
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyPosition(pos);
      },
      (err) => {
        console.warn("[GPS Phase 1 High Accuracy Failed, trying Phase 2 network fallback]", err);
        // Phase 2 fallback: standard network / cellular / wifi location with cached positions up to 5 mins
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            applyPosition(pos);
          },
          (fallbackErr) => {
            console.warn("[GPS Phase 2 Fallback Failed]", fallbackErr);
            setIsLocatingGps(false);
            if (fallbackErr.code === 1 /* PERMISSION_DENIED */) {
              setGpsNotice({
                type: "warning",
                message: "Location blocked in browser. Tap 🔒 in address bar to Allow, or search locality above / drag the pin to your doorstep.",
              });
              setTimeout(() => {
                setGpsNotice((cur) => (cur?.type === "warning" ? null : cur));
              }, 7000);
            } else {
              setGpsNotice({
                type: "info",
                message: "Unable to detect exact satellite GPS. Please search your locality above or drag the pin on the map.",
              });
              setTimeout(() => {
                setGpsNotice((cur) => (cur?.type === "info" ? null : cur));
              }, 5000);
            }
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  };

  // ─────────────────────────────────────────────────────────────
  // SEARCH LOCALITY (Zepto / Swiggy Instant Area FlyTo)
  // ─────────────────────────────────────────────────────────────
  const handleSearchLocality = async (val: string) => {
    setSearchQuery(val);
    if (val.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchLocality(val);
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectLocality = (item: LocalitySearchResult) => {
    setSearchQuery("");
    setSearchResults([]);
    const targetCoords = { lat: item.lat, lng: item.lng };
    setCurrentCoords(targetCoords);
    setAreaText(item.displayName);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([item.lat, item.lng], 16, { animate: true, duration: 1.2 });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 3. SUBMIT & CONFIRM
  // ─────────────────────────────────────────────────────────────
  const handleConfirm = () => {
    if (!serviceCheck.isServiceable) {
      setGpsNotice({
        type: "error",
        message: serviceCheck.message,
      });
      return;
    }

    if (!flatNo.trim()) {
      setGpsNotice({
        type: "warning",
        message: "Please enter your House / Flat / Floor Number.",
      });
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

        {/* GPS / Validation Status Banner */}
        {gpsNotice && (
          <div
            className={`px-4 py-2.5 text-xs flex items-center justify-between gap-2 border-b shrink-0 transition-all ${
              gpsNotice.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : gpsNotice.type === "warning"
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-blue-50 border-blue-200 text-blue-900"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0 text-sm">
                {gpsNotice.type === "error" ? "⚠️" : gpsNotice.type === "warning" ? "📍" : "ℹ️"}
              </span>
              <span className="text-[11px] font-semibold leading-tight">{gpsNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setGpsNotice(null)}
              className="p-1 rounded-md text-stone-400 hover:text-stone-700 shrink-0 cursor-pointer"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Locality / Area Search Bar (Zepto & Swiggy Style) */}
        <div className="relative px-4 py-2 bg-stone-50 border-b border-stone-200 shrink-0 z-20">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search area, locality, street (e.g. Indiranagar, Civil Lines)..."
              value={searchQuery}
              onChange={(e) => handleSearchLocality(e.target.value)}
              className="w-full text-xs font-semibold pl-8 pr-8 py-2 rounded-xl bg-white border border-stone-300 text-stone-900 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-xs"
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 text-xs animate-spin">
                ⏳
              </span>
            )}
            {searchQuery && !isSearching && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs cursor-pointer p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute left-4 right-4 top-full mt-1 bg-white rounded-2xl shadow-2xl border border-stone-200 z-30 max-h-52 overflow-y-auto divide-y divide-stone-100">
              {searchResults.map((res, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectLocality(res)}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-stone-50 transition-colors flex items-start gap-2.5 cursor-pointer"
                >
                  <span className="text-emerald-600 text-xs mt-0.5 shrink-0">📍</span>
                  <span className="text-xs font-semibold text-stone-800 leading-snug line-clamp-2">
                    {res.displayName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Global style to 100% remove Leaflet attribution watermark */}
        <style dangerouslySetInnerHTML={{ __html: `
          .leaflet-control-attribution,
          .leaflet-attribution {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            width: 0 !important;
            pointer-events: none !important;
          }
        ` }} />

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
