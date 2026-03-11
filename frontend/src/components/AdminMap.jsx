/**
 * Admin Map Component
 * Displays live location of ALL active buses
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './BusMap.css'; // Reusing existing map styles

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function AdminMap({ buses = [], routes = [], height = '500px' }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const busMarkersRef = useRef(new Map()); // busId -> marker
    const routeLinesRef = useRef(new Map()); // routeId -> polyline

    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        // Initialize map
        const map = L.map(mapRef.current).setView([28.6139, 77.2090], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Handle Buses Updates
    useEffect(() => {
        if (!mapInstanceRef.current) return;
        const map = mapInstanceRef.current;

        // 1. Process Buses
        buses.forEach(bus => {
            // Only show if bus has location data
            if (!bus.current_lat || !bus.current_lng) return;

            if (busMarkersRef.current.has(bus.id)) {
                // Update existing marker
                const marker = busMarkersRef.current.get(bus.id);
                marker.setLatLng([bus.current_lat, bus.current_lng]);

                // Update popup content dynamically if needed
                const popupContent = createBusPopup(bus);
                if (marker.getPopup()) {
                    marker.setPopupContent(popupContent);
                }
            } else {
                // Create new marker
                const busIcon = L.divIcon({
                    className: 'custom-bus-marker',
                    html: `
                        <div class="bus-marker-inner" style="background: ${getBusColor(bus.status)}">
                            <div class="bus-icon">🚌</div>
                        </div>
                    `,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20],
                });

                const marker = L.marker([bus.current_lat, bus.current_lng], {
                    icon: busIcon
                }).addTo(map);

                marker.bindPopup(createBusPopup(bus));
                busMarkersRef.current.set(bus.id, marker);
            }
        });

        // Remove markers for buses that are no longer in the list (if any)
        // (Optional optimization: simplistic approach for now)

    }, [buses]);

    // Helper functions
    const createBusPopup = (bus) => `
        <div class="map-popup">
            <h4>🚌 Bus ${bus.bus_number}</h4>
            <p><strong>Driver:</strong> ${bus.driver_name || 'Unassigned'}</p>
            <p><strong>Route:</strong> ${bus.route_name || 'N/A'}</p>
            <p><strong>Status:</strong> ${bus.status}</p>
            <p class="text-xs text-muted">Last update: ${new Date().toLocaleTimeString()}</p>
        </div>
    `;

    const getBusColor = (status) => {
        switch (status) {
            case 'active': return '#10b981'; // Green
            case 'breakdown': return '#ef4444'; // Red
            case 'maintenance': return '#f59e0b'; // Amber
            default: return '#6366f1'; // Indigo
        }
    };

    return (
        <div className="admin-map-container" style={{ marginBottom: '2rem' }}>
            <div
                ref={mapRef}
                className="admin-map"
                style={{ height, width: '100%', borderRadius: '1rem', border: '1px solid var(--color-border)' }}
            />
        </div>
    );
}

export default AdminMap;
