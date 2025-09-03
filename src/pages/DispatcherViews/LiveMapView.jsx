import React, { useEffect } from 'react';
import L from 'leaflet';
import { emergencySeverityMap, emergencyTypeMap } from '../../constants/dispatchConstants';
import 'leaflet/dist/leaflet.css';

export default function LiveMapView({ mapRef, notifications = [], reportLogs = [] }) {
  useEffect(() => {
    const mapContainer = document.getElementById('map');
    if (mapContainer && mapContainer._leaflet_id) {
      mapContainer._leaflet_id = null; // reset for hot reloads
    }

    const victoriaTarlac = [15.5784, 120.6819];
    const map = L.map(mapContainer).setView(victoriaTarlac, 14);
    

    L.tileLayer(
      `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=499958bc884b4b8cae36c651db0a3d7d`,
      {
        attribution: 'Powered by Geoapify',
        maxZoom: 20,
      }
    ).addTo(map);

    // FIXED: Enhanced coordinate parsing function
    const parseCoords = (loc) => {
      console.log('Parsing coordinates:', loc, typeof loc);
      
      if (!loc) {
        console.log('No location data provided');
        return null;
      }
      
      // Handle object format (new format from CreateRescueModal)
      if (typeof loc === 'object' && loc !== null) {
        const lat = Number(loc.lat || loc.latitude);
        const lng = Number(loc.lng || loc.lon || loc.longitude);
        
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          console.log('✅ Parsed object coordinates:', { lat, lng });
          return { lat, lng };
        } else {
          console.warn('Invalid coordinates in object:', loc);
          return null;
        }
      }
      
      // Handle string format (legacy format)
      if (typeof loc === 'string') {
        try {
          // Try to parse as JSON first
          const parsed = JSON.parse(loc);
          const lat = Number(parsed.lat || parsed.latitude);
          const lng = Number(parsed.lng || parsed.lon || parsed.longitude);
          
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            console.log('✅ Parsed JSON string coordinates:', { lat, lng });
            return { lat, lng };
          }
        } catch (jsonError) {
          console.log('Not valid JSON, trying comma-separated format');
          
          // Try comma-separated format: "lat,lng"
          if (loc.includes(',')) {
            const [latStr, lngStr] = loc.split(',');
            const lat = Number(latStr.trim());
            const lng = Number(lngStr.trim());
            
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              console.log('✅ Parsed comma-separated coordinates:', { lat, lng });
              return { lat, lng };
            }
          }
        }
      }
      
      console.warn('❌ Could not parse coordinates:', loc);
      return null;
    };

    // Clear existing markers before re-rendering
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    console.log(`Processing ${notifications.length} notifications and ${reportLogs.length} reports`);

    // Markers from notifications
    notifications.forEach((notif, index) => {
      console.log(`Processing notification ${index}:`, notif);
      
      const coords = parseCoords(notif.coordinates || notif.location);
      if (!coords || !coords.lat || !coords.lng) {
        console.warn(`❌ Skipping notification ${index} due to invalid coordinates:`, notif);
        return;
      }

      console.log(`✅ Adding notification marker at:`, coords);

      const typeMeta = emergencyTypeMap[notif.type?.toLowerCase()] || {};
      const color = typeMeta.color || '#555';
      const label = typeMeta.label || notif.type || 'Unknown';

      L.marker([coords.lat, coords.lng], {
        icon: L.divIcon({
          html: `<div style="
            background-color: ${color};
            border: 2px solid white;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            box-shadow: 0 0 6px ${color};
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 12px;
          " title="${label}">N</div>`,
          className: 'emergency-marker notification-marker',
          iconSize: [30, 30],
        }),
      })
      .addTo(map)
      .bindPopup(
        `<div class="marker-popup">
          <b>📢 Notification</b><br/>
          <strong>Type:</strong> ${label}<br/>
          <strong>Location:</strong> ${notif.location || notif.locationText || 'N/A'}<br/>
          <strong>Coordinates:</strong> ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}
        </div>`
      );
    });

    // Markers from reportLogs
    reportLogs.forEach((report, index) => {
      console.log(`Processing report ${index}:`, report);
      
      const coords = parseCoords(report.location);
      if (!coords || !coords.lat || !coords.lng) {
        console.warn(`❌ Skipping report ${index} due to invalid coordinates:`, report);
        return;
      }

      console.log(`✅ Adding report marker at:`, coords);

      const severityMeta = emergencySeverityMap[report.emergencySeverity?.toLowerCase()] || {};
      const color = severityMeta.color || '#555';
      const label = severityMeta.label || report.emergencySeverity || 'Unknown';

      // Different marker style for reports
      L.marker([coords.lat, coords.lng], {
        icon: L.divIcon({
          html: `<div style="
            background-color: ${color};
            border: 2px solid white;
            border-radius: 50%;
            width: 35px;
            height: 35px;
            box-shadow: 0 0 8px ${color};
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 12px;
          " title="${label}">R</div>`,
          className: 'emergency-marker report-marker',
          iconSize: [35, 35],
        }),
      })
      .addTo(map)
      .bindPopup(
        `<div class="marker-popup">
          <b>🚨 Report #${report.reportId || report.id}</b><br/>
          <strong>Severity:</strong> ${label}<br/>
          <strong>Type:</strong> ${emergencyTypeMap[report.emergencyType?.toLowerCase()]?.label || report.emergencyType || 'N/A'}<br/>
          <strong>Reporter:</strong> ${report.reporterName || report.reporter || 'N/A'}<br/>
          <strong>Location:</strong> ${report.locationText || report.matchedLocation || 'N/A'}<br/>
          <strong>Team:</strong> ${report.respondingTeam || 'N/A'}<br/>
          <strong>Status:</strong> ${(report.status || 'N/A').toUpperCase()}<br/>
          <strong>Coordinates:</strong> ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}
          ${report.locationPrecision ? `<br/><strong>Precision:</strong> ${report.locationPrecision}` : ''}
        </div>`
      );
    });

    console.log(`✅ Map initialized with ${notifications.length} notifications and ${reportLogs.length} reports`);

    mapRef.current = map;

    return () => {
      if (map) {
        map.remove();
      }
      mapRef.current = null;
    };
  }, [mapRef, notifications, reportLogs]);

  return (
    <div className="map-container">
      <div id="map" className="leaflet-map" />
      <div className="map-controls">
        <button className="map-control" title="Zoom In" onClick={() => mapRef.current?.zoomIn()}>
          <i className="fas fa-plus" />
        </button>
        <button className="map-control" title="Zoom Out" onClick={() => mapRef.current?.zoomOut()}>
          <i className="fas fa-minus" />
        </button>
        <button
          className="map-control"
          title="Locate Me"
          onClick={() => {
            if (navigator.geolocation && mapRef.current) {
              navigator.geolocation.getCurrentPosition((pos) => {
                const coords = [pos.coords.latitude, pos.coords.longitude];
                mapRef.current.setView(coords, 16);
                L.marker(coords, {
                  icon: L.divIcon({
                    html: `<div style="
                      background-color: #007bff;
                      border: 2px solid white;
                      border-radius: 50%;
                      width: 25px;
                      height: 25px;
                      box-shadow: 0 0 6px #007bff;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      color: white;
                      font-size: 10px;
                    ">📍</div>`,
                    className: 'user-location-marker',
                    iconSize: [25, 25],
                  }),
                }).addTo(mapRef.current).bindPopup('You are here').openPopup();
              });
            }
          }}
        >
          <i className="fas fa-location-arrow" />
        </button>
        <button
          className="map-control"
          title="Reset View"
          onClick={() => {
            if (mapRef.current) {
              mapRef.current.setView([15.5784, 120.6819], 14);
            }
          }}
        >
          <i className="fas fa-home" />
        </button>
      </div>
      
      {/* Map Legend */}
      <div className="map-legend">
        <div className="legend-item">
          <div className="legend-marker" style={{ backgroundColor: '#e74c3c' }}>R</div>
          <span>Reports</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker" style={{ backgroundColor: '#555' }}>N</div>
          <span>Notifications</span>
        </div>
      </div>
    </div>
  );
}
