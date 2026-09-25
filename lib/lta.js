/**
 * Singapore Land Transport Authority (LTA) DataMall Client
 * Handles real-time carpark availability and EV charging locations.
 */

const LTA_BASE_URL = 'https://datamall2.mytransport.sg/ltaodataservice';

/**
 * Calculates the great-circle distance between two coordinates in meters (Haversine formula).
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of Earth in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Parses coordinate string formats such as "1.293 103.857" or "1.293, 103.857"
 */
export function parseCoordinates(locationStr) {
  if (!locationStr || typeof locationStr !== 'string') return null;
  const parts = locationStr.trim().split(/[\s,]+/);
  if (parts.length >= 2) {
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }
  return null;
}

/**
 * Fetch helper with standard LTA DataMall headers.
 * Never leaks API keys into output or logs.
 */
async function fetchLTA(endpoint) {
  const headers = {
    accept: 'application/json',
  };
  if (process.env.LTA_ACCOUNT_KEY) {
    headers.AccountKey = process.env.LTA_ACCOUNT_KEY;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${LTA_BASE_URL}/${endpoint}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const error = new Error(`LTA upstream request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

/**
 * Finds carparks in Singapore by reading every page of LTA results using $skip.
 * Returns at most 10 carparks sorted by distance.
 *
 * @param {Object} options
 * @param {number} [options.lat] Latitude
 * @param {number} [options.lng] Longitude
 * @param {number} [options.radius_m] Search radius in meters
 * @param {number} [options.min_lots] Minimum available lots filter
 */
export async function findCarparks({ lat, lng, radius_m, min_lots } = {}) {
  const allCarparks = [];
  let skip = 0;
  const PAGE_SIZE = 500;

  // LTA CarParkAvailabilityv2 paginates in batches of 500
  while (true) {
    const data = await fetchLTA(`CarParkAvailabilityv2?$skip=${skip}`);
    const items = Array.isArray(data.value) ? data.value : [];
    allCarparks.push(...items);

    if (items.length < PAGE_SIZE) {
      break;
    }
    skip += PAGE_SIZE;
    // Safety guard against infinite loops
    if (skip > 25000) break;
  }

  let results = allCarparks.map((cp) => {
    let distance_m = null;
    const coords = parseCoordinates(cp.Location);
    if (lat != null && lng != null && coords) {
      distance_m = calculateDistanceMeters(lat, lng, coords.lat, coords.lng);
    }
    return {
      carpark_id: cp.CarParkID,
      area: cp.Area,
      development: cp.Development,
      location: cp.Location,
      available_lots: cp.AvailableLots,
      lot_type: cp.LotType,
      agency: cp.Agency,
      ...(distance_m != null ? { distance_m } : {}),
      ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
    };
  });

  if (min_lots != null && !isNaN(min_lots)) {
    results = results.filter((cp) => (cp.available_lots ?? 0) >= min_lots);
  }

  if (lat != null && lng != null) {
    if (radius_m != null && !isNaN(radius_m) && radius_m > 0) {
      results = results.filter((cp) => cp.distance_m != null && cp.distance_m <= radius_m);
    }
    results.sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity));
  }

  const finalItems = results.slice(0, 10);

  return {
    source: 'LTA DataMall CarParkAvailabilityv2',
    fetched_at: new Date().toISOString(),
    items: finalItems,
    carparks: finalItems,
  };
}

export const carpark = findCarparks;

/**
 * Finds EV charging stations in Singapore.
 * Returns at most 10 locations without the nested chargingPoints detail.
 *
 * @param {Object} options
 * @param {number} [options.lat] Latitude
 * @param {number} [options.lng] Longitude
 * @param {number} [options.radius_m] Search radius in meters
 * @param {string} [options.plug_type] Filter by connector/plug type (e.g. Type 2, CCS2)
 */
export async function findEvChargers({ lat, lng, radius_m, plug_type } = {}) {
  let stations = [];
  const data = await fetchLTA('EVCBatch');

  if (data && Array.isArray(data.value) && data.value[0]?.Link) {
    const feedRes = await fetch(data.value[0].Link);
    if (!feedRes.ok) {
      const error = new Error(`LTA EV feed download failed with status ${feedRes.status}`);
      error.status = feedRes.status;
      throw error;
    }
    const feedData = await feedRes.json();
    stations = Array.isArray(feedData) ? feedData : (feedData.value || feedData.data || []);
  } else if (data && Array.isArray(data.value)) {
    stations = data.value;
  } else if (Array.isArray(data)) {
    stations = data;
  }

  // Filter by plug_type if specified before stripping nested chargingPoints
  if (plug_type && typeof plug_type === 'string') {
    const queryPlug = plug_type.toLowerCase().trim();
    stations = stations.filter((st) => {
      const points = st.chargingPoints || st.ChargingPoints || st.connectors || [];
      if (!Array.isArray(points)) return false;
      return points.some((p) => {
        const pt = (p.plugType || p.plug_type || p.connectorType || p.type || p.standard || '')
          .toString()
          .toLowerCase();
        return pt.includes(queryPlug);
      });
    });
  }

  // Calculate distances
  let results = stations.map((st) => {
    let itemLat = st.latitude ?? st.Latitude ?? st.lat;
    let itemLng = st.longitude ?? st.Longitude ?? st.lng;
    if ((itemLat == null || itemLng == null) && st.Location) {
      const coords = parseCoordinates(st.Location);
      if (coords) {
        itemLat = coords.lat;
        itemLng = coords.lng;
      }
    }

    let distance_m = null;
    if (lat != null && lng != null && itemLat != null && itemLng != null) {
      distance_m = calculateDistanceMeters(lat, lng, parseFloat(itemLat), parseFloat(itemLng));
    }

    // Strip nested chargingPoints / ChargingPoints / connectors detail as instructed
    const { chargingPoints, ChargingPoints, connectors, ...cleanStation } = st;

    return {
      ...cleanStation,
      ...(distance_m != null ? { distance_m } : {}),
      ...(itemLat != null ? { latitude: parseFloat(itemLat) } : {}),
      ...(itemLng != null ? { longitude: parseFloat(itemLng) } : {}),
    };
  });

  if (lat != null && lng != null) {
    if (radius_m != null && !isNaN(radius_m) && radius_m > 0) {
      results = results.filter((st) => st.distance_m != null && st.distance_m <= radius_m);
    }
    results.sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity));
  }

  const finalItems = results.slice(0, 10);

  return {
    source: 'LTA DataMall EVCBatch',
    fetched_at: new Date().toISOString(),
    items: finalItems,
    locations: finalItems,
  };
}

export const ev = findEvChargers;
export const evCharger = findEvChargers;
