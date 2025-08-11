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

    // Helper: parse coords from string or object
    const parseCoords = (loc) => {
      if (!loc) return null;
      if (typeof loc === 'string') {
        try {
          return JSON.parse(loc);
        } catch {
          if (loc.includes(',')) {
            const [lat, lng] = loc.split(',').map(Number);
            return { lat, lng };
          }
          return null;
        }
      }
      return loc;
    };

    // Markers from notifications
    notifications.forEach((notif) => {
      const coords = parseCoords(notif.coordinates);
      if (!coords || !coords.lat || !coords.lng) return;

      const typeMeta = emergencyTypeMap[notif.type.toLowerCase()] || {};
      const color = typeMeta.color || '#555';
      const label = typeMeta.label || notif.type;

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
          " title="${label}"></div>`,
          className: 'emergency-marker',
          iconSize: [30, 30],
        }),
      })
        .addTo(map)
        .bindPopup(
          `<b>Notification</b><br/>
           Type: ${label.toUpperCase()}<br/>
           Location: ${notif.location || 'N/A'}`
        );
    });

    // Markers from reportLogs
    reportLogs.forEach((report) => {
      const coords = parseCoords(report.location);
      if (!coords || !coords.lat || !coords.lng) return;

      const severityMeta = emergencySeverityMap[report.emergencySeverity.toLowerCase()] || {};
      const color = severityMeta.color || '#555';
      const label = severityMeta.label || report.emergencySeverity;

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
          " title="${label}"></div>`,
          className: 'emergency-marker',
          iconSize: [30, 30],
        }),
      })
        .addTo(map)
        .bindPopup(
          `<b>${report.id}</b><br/>
           Severity: ${label.toUpperCase()}<br/>
           Reported by: ${report.reporterName || report.reporter || 'N/A'}<br/>
           Team: ${report.respondingTeam || 'N/A'}<br/>
           Status: ${(report.status || 'N/A').toUpperCase()}`
        );
    });

    mapRef.current = map;

    return () => {
      map.remove();
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
                L.marker(coords).addTo(mapRef.current).bindPopup('You are here').openPopup();
              });
            }
          }}
        >
          <i className="fas fa-location-arrow" />
        </button>
      </div>
    </div>
  );
}
