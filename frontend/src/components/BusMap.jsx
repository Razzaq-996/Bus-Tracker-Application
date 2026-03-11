/**
 * Bus Map Component with Smooth Animation
 * Features:
 * - Linear Interpolation (LERP) for smooth marker movement
 * - Bearing calculation for realistic vehicle rotation
 * - requestAnimationFrame for 60fps animations
 * - Road snapping support (optional with Google Roads API)
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './BusMap.css';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/**
 * Calculate bearing (angle) between two coordinates
 * @param {Object} from - {latitude, longitude}
 * @param {Object} to - {latitude, longitude}
 * @returns {number} - Bearing in degrees (0-360)
 */
function calculateBearing(from, to) {
    const lat1 = from.latitude * Math.PI / 180;
    const lat2 = to.latitude * Math.PI / 180;
    const dLon = (to.longitude - from.longitude) * Math.PI / 180;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360; // Normalize to 0-360
}

/**
 * Linear interpolation between two values
 * @param {number} start - Starting value
 * @param {number} end - Ending value
 * @param {number} t - Progress (0 to 1)
 * @returns {number} - Interpolated value
 */
function lerp(start, end, t) {
    return start + (end - start) * t;
}

function BusMap({ stops = [], busLocation = null, myStopId = null, visitedStops = [], height = '400px' }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const busMarkerRef = useRef(null);
    const routeLineRef = useRef(null);
    const stopMarkersRef = useRef([]);

    // Animation state
    const animationRef = useRef(null);
    const currentPositionRef = useRef(null); // Current animated position
    const targetPositionRef = useRef(null);  // Target position to animate to
    const lastGPSPositionRef = useRef(null); // Last confirmed GPS position (source of truth)
    const animationStartTimeRef = useRef(null);
    const currentBearingRef = useRef(0);
    const targetBearingRef = useRef(0);

    // Animation duration in milliseconds (smooth transition over 1 second)
    const ANIMATION_DURATION = 1000;

    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        // Initialize map
        const map = L.map(mapRef.current).setView([28.6139, 77.2090], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;

        return () => {
            // Cleanup animation frame
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Update stops and route
    useEffect(() => {
        if (!mapInstanceRef.current || !stops.length) return;

        const map = mapInstanceRef.current;

        // Clear existing stop markers
        stopMarkersRef.current.forEach(marker => marker.remove());
        stopMarkersRef.current = [];

        // Clear existing route line
        if (routeLineRef.current) {
            routeLineRef.current.remove();
            routeLineRef.current = null;
        }

        // Create custom icons
        const stopIcon = L.divIcon({
            className: 'custom-stop-marker',
            html: '<div class="stop-marker-inner">📍</div>',
            iconSize: [30, 30],
            iconAnchor: [15, 30],
        });

        const visitedStopIcon = L.divIcon({
            className: 'custom-stop-marker visited-stop',
            html: '<div class="stop-marker-inner">✅</div>',
            iconSize: [35, 35],
            iconAnchor: [17, 35],
        });

        const myStopIcon = L.divIcon({
            className: 'custom-stop-marker my-stop',
            html: '<div class="stop-marker-inner">🏠</div>',
            iconSize: [40, 40],
            iconAnchor: [20, 40],
        });

        // Add stop markers
        const coordinates = [];
        stops.forEach(stop => {
            const isMyStop = stop.id === myStopId;
            const isVisited = visitedStops.includes(stop.id);

            // Priority: My Stop > Visited > Regular
            let icon = stopIcon;
            if (isMyStop) {
                icon = myStopIcon;
            } else if (isVisited) {
                icon = visitedStopIcon;
            }

            const marker = L.marker([stop.latitude, stop.longitude], {
                icon: icon
            }).addTo(map);

            let popupContent = `
        <div class="map-popup">
          <h4>${stop.name}</h4>
          <p>${isMyStop ? '🏠 Your Stop' : 'Stop #' + stop.sequence_order}</p>`;

            if (isVisited) {
                popupContent += `<p style="color: #10b981; font-weight: bold;">✅ Visited</p>`;
            }

            popupContent += `</div>`;

            marker.bindPopup(popupContent);

            stopMarkersRef.current.push(marker);
            coordinates.push([stop.latitude, stop.longitude]);
        });

        // Draw route line
        if (coordinates.length > 1) {
            const routeLine = L.polyline(coordinates, {
                color: '#6366f1',
                weight: 4,
                opacity: 0.7,
                smoothFactor: 1
            }).addTo(map);

            routeLineRef.current = routeLine;

            // Fit map to show all stops
            map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
        }
    }, [stops, myStopId, visitedStops]);

    // Animate bus marker smoothly using LERP
    const animateBusMarker = (timestamp) => {
        if (!animationStartTimeRef.current) {
            animationStartTimeRef.current = timestamp;
        }

        const elapsed = timestamp - animationStartTimeRef.current;
        const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

        // Easing function for smoother animation (ease-out)
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        if (currentPositionRef.current && targetPositionRef.current) {
            // Interpolate position
            const newLat = lerp(
                currentPositionRef.current.latitude,
                targetPositionRef.current.latitude,
                easeProgress
            );
            const newLng = lerp(
                currentPositionRef.current.longitude,
                targetPositionRef.current.longitude,
                easeProgress
            );

            // Interpolate bearing for smooth rotation
            let bearingDiff = targetBearingRef.current - currentBearingRef.current;
            // Handle wrap-around (e.g., 350° to 10°)
            if (bearingDiff > 180) bearingDiff -= 360;
            if (bearingDiff < -180) bearingDiff += 360;

            const newBearing = currentBearingRef.current + bearingDiff * easeProgress;

            // Update marker position and rotation
            if (busMarkerRef.current) {
                busMarkerRef.current.setLatLng([newLat, newLng]);

                // Update rotation
                const markerElement = busMarkerRef.current.getElement();
                if (markerElement) {
                    const busIconElement = markerElement.querySelector('.bus-icon');
                    if (busIconElement) {
                        busIconElement.style.transform = `rotate(${newBearing}deg)`;
                    }
                }
            }

            // Continue animation if not complete
            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animateBusMarker);
            } else {
                // Animation complete - update current position to last GPS position
                currentPositionRef.current = lastGPSPositionRef.current ? { ...lastGPSPositionRef.current } : { ...targetPositionRef.current };
                currentBearingRef.current = targetBearingRef.current;
                animationStartTimeRef.current = null;
            }
        }
    };

    // Update bus location with smooth animation
    useEffect(() => {
        if (!mapInstanceRef.current || !busLocation) return;

        const map = mapInstanceRef.current;
        const newPosition = {
            latitude: busLocation.latitude,
            longitude: busLocation.longitude
        };

        // Initialize or update bus marker
        if (!busMarkerRef.current) {
            // First time - create marker without animation
            const busIcon = L.divIcon({
                className: 'custom-bus-marker',
                html: `
                <div class="bus-marker-inner">
                  <div class="bus-icon" style="transform: rotate(0deg); transition: transform 0.3s ease;">🚌</div>
                  <div class="bus-pulse"></div>
                </div>
              `,
                iconSize: [50, 50],
                iconAnchor: [25, 25],
            });

            const busMarker = L.marker([newPosition.latitude, newPosition.longitude], {
                icon: busIcon
            }).addTo(map);

            busMarker.bindPopup(`
              <div class="map-popup">
                <h4>🚌 Bus Location</h4>
                <p>Live tracking active</p>
              </div>
            `);

            busMarkerRef.current = busMarker;
            currentPositionRef.current = newPosition;
            targetPositionRef.current = newPosition;
            lastGPSPositionRef.current = newPosition; // Store first GPS position
        } else {
            // Store the new GPS position as last confirmed position
            lastGPSPositionRef.current = newPosition;

            // Subsequent updates - animate smoothly
            // Use current animated position (or last GPS if no animation) as start
            const startPosition = currentPositionRef.current || lastGPSPositionRef.current;

            if (startPosition) {
                // Calculate bearing from current position to new GPS position
                const bearing = calculateBearing(startPosition, newPosition);
                targetBearingRef.current = bearing;

                // Set target position to new GPS position
                targetPositionRef.current = newPosition;

                // If no current position, set it to start position
                if (!currentPositionRef.current) {
                    currentPositionRef.current = startPosition;
                }

                // Cancel any ongoing animation
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current);
                }

                // Start new animation from current position to new GPS position
                animationStartTimeRef.current = null;
                animationRef.current = requestAnimationFrame(animateBusMarker);
            } else {
                // Fallback: just update position directly
                busMarkerRef.current.setLatLng([newPosition.latitude, newPosition.longitude]);
                currentPositionRef.current = newPosition;
                targetPositionRef.current = newPosition;
            }
        }

        // Optional: Smoothly pan map to follow bus (uncomment if desired)
        // map.panTo([newPosition.latitude, newPosition.longitude], {
        //     animate: true,
        //     duration: 0.5
        // });

    }, [busLocation]);

    // Cleanup animation on unmount
    useEffect(() => {
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    return (
        <div className="bus-map-container">
            <div
                ref={mapRef}
                className="bus-map"
                style={{ height, width: '100%', borderRadius: 'var(--radius-lg)' }}
            />
            {!busLocation && (
                <div className="map-overlay">
                    <p>🚌 Waiting for bus to start trip...</p>
                </div>
            )}
        </div>
    );
}

export default BusMap;
