/**
 * Haversine Distance Calculation
 * Calculates the distance between two GPS coordinates in meters
 */

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters

    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in meters

    return distance;
}

/**
 * Check if a point is within a geofence radius
 * @param {number} lat1 - Latitude of point 1 (driver)
 * @param {number} lon1 - Longitude of point 1 (driver)
 * @param {number} lat2 - Latitude of point 2 (stop)
 * @param {number} lon2 - Longitude of point 2 (stop)
 * @param {number} radiusMeters - Geofence radius in meters
 * @returns {boolean} True if within geofence
 */
function isWithinGeofence(lat1, lon1, lat2, lon2, radiusMeters = 40) {
    const distance = haversineDistance(lat1, lon1, lat2, lon2);
    return distance <= radiusMeters;
}

module.exports = {
    haversineDistance,
    isWithinGeofence
};
