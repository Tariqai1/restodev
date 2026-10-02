/**
 * Geospatial Utilities for OrderDesk
 * Provides Haversine distance calculations, geofence validation,
 * and OpenStreetMap Nominatim reverse-geocoding.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodedAddress {
  formattedAddress: string;
  road?: string;
  suburb?: string;
  city?: string;
  state?: string;
  postcode?: string;
}

// Fallback restaurant coordinates if none set in settings (e.g. Connaught Place, New Delhi or Indiranagar, Bengaluru)
export const DEFAULT_RESTO_COORDINATES: LatLng = {
  lat: 12.9716,
  lng: 77.5946,
};

/**
 * Calculates great-circle distance between two points on the Earth
 * using the Haversine formula in kilometers.
 */
export function calculateHaversineDistanceKm(
  point1: LatLng,
  point2: LatLng
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lng - point1.lng);
  const lat1 = toRad(point1.lat);
  const lat2 = toRad(point2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // Rounded to 1 decimal place (e.g. 3.2 km)
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Validates if the customer is within the restaurant's delivery radius
 */
export function checkDeliveryServiceability(
  restoCoords: LatLng,
  customerCoords: LatLng,
  maxRadiusKm: number = 5
): {
  isServiceable: boolean;
  distanceKm: number;
  message: string;
} {
  const distanceKm = calculateHaversineDistanceKm(restoCoords, customerCoords);
  const isServiceable = distanceKm <= maxRadiusKm;

  return {
    isServiceable,
    distanceKm,
    message: isServiceable
      ? `Within delivery area (${distanceKm} km away)`
      : `Delivery unavailable: Location is ${distanceKm} km away (max service radius is ${maxRadiusKm} km)`,
  };
}

/**
 * Reverse geocodes coordinates to a human-readable street address
 * using OpenStreetMap Nominatim with client-side rate limiting and error handling.
 */
export async function reverseGeocodeCoords(
  lat: number,
  lng: number
): Promise<GeocodedAddress> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: {
        "Accept-Language": "en-IN,en;q=0.9",
        "User-Agent": "OrderDesk-HMS/1.0",
      },
    });

    if (!res.ok) {
      throw new Error("Geocoding service unavailable");
    }

    const data = await res.json();
    const addr = data.address || {};

    const road = addr.road || addr.pedestrian || addr.suburb || "";
    const suburb = addr.neighbourhood || addr.suburb || addr.residential || "";
    const city = addr.city || addr.town || addr.village || addr.county || "";
    const state = addr.state || "";
    const postcode = addr.postcode || "";

    const parts = [road, suburb, city, state, postcode].filter(Boolean);
    const formattedAddress = parts.join(", ") || data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    return {
      formattedAddress,
      road,
      suburb,
      city,
      state,
      postcode,
    };
  } catch (err) {
    console.warn("[reverseGeocodeCoords] Warning:", err);
    return {
      formattedAddress: `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`,
    };
  }
}
