import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.gridlayer.googlemutant';
import { getFirestore, collection, onSnapshot} from "firebase/firestore";
import { emergencySeverityMap, emergencyTypeMap } from '../../constants/dispatchConstants';
import 'leaflet/dist/leaflet.css';


const db = getFirestore();
// Custom marker icon functions
const getNotificationIcon = (notif) => {
  const typeMeta = emergencyTypeMap[notif.type?.toLowerCase()] || {};
  const color = typeMeta.color || '#555';
  const label = typeMeta.label || notif.type || 'Unknown';
  return L.divIcon({
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
  });
}; 

const getReportIcon = (report) => {
  const severityMeta = emergencySeverityMap[report.emergencySeverity?.toLowerCase()] || {};
  const color = severityMeta.color || '#e74c3c';
  const label = severityMeta.label || report.emergencySeverity || 'Unknown';
  return L.divIcon({
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
  });
};

export default function LiveMapView({ mapRef, notifications = [], reportLogs = [], setReportLogs=[] }) {
  // CORRECT: useRef is called inside the component function
  const markersRef = useRef(new L.LayerGroup()); 
  const victoriaTarlac = [15.5784, 120.6819];

  // 1. Map Initialization Effect (runs only once)
  useEffect(() => {
    const mapContainer = document.getElementById('map');
    if (mapContainer && mapContainer._leaflet_id) {
      mapContainer._leaflet_id = null;
    }

    const initMap = () => {
      const map = L.map(mapContainer).setView(victoriaTarlac, 14);

      L.gridLayer.googleMutant({
        type: 'roadmap',
        maxZoom: 21,
        attribution: '© Google Maps'
      }).addTo(map);

      markersRef.current.addTo(map);
      mapRef.current = map;
    };

    if (window.google && window.google.maps) {
      initMap();
    } else {
      const scriptId = 'google-maps-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyCF2-KnVOheWhoZbFAWs3MMyvEb-IC-o54&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = initMap;
        document.body.appendChild(script);
      } else {
        document.getElementById(scriptId).onload = initMap;
      }
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapRef]);

  // 2. Marker Update Effect (runs on every data change)
  useEffect(() => {
    const parseCoords = (loc) => {
      if (!loc) return null;

      if (typeof loc === 'object' && loc !== null) {
        const lat = Number(loc.lat ?? loc.latitude);
        const lng = Number(loc.lng ?? loc.lon ?? loc.longitude);
        if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
      }

      if (typeof loc === 'string') {
        try {
          const parsed = JSON.parse(loc);
          const lat = Number(parsed.lat ?? parsed.latitude);
          const lng = Number(parsed.lng ?? parsed.lon ?? parsed.longitude);
          if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
        } catch {
          if (loc.includes(',')) {
            const [latStr, lngStr] = loc.split(',');
            const lat = Number(latStr.trim());
            const lng = Number(lngStr.trim());
            if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
          }
        }
      }

      return null;
    };

    markersRef.current.clearLayers();

    notifications.forEach((notif) => {
      const coords = parseCoords(notif.coordinates || notif.location);
      if (!coords) return;
      L.marker([coords.lat, coords.lng], { icon: getNotificationIcon(notif) })
        .bindPopup(`
          <div class="marker-popup">
            <b>📢 Notification</b><br/>
            <strong>Type:</strong> ${emergencyTypeMap[notif.type?.toLowerCase()]?.label || notif.type || 'Unknown'}<br/>
            <strong>Location:</strong> ${notif.location || notif.locationText || 'N/A'}<br/>
            <strong>Coordinates:</strong> ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}
          </div>
        `)
        .addTo(markersRef.current);
      // Add this inside notifications.forEach
        if (notif.acknowledgedDevice) {
        const ack = notif.acknowledgedDevice;
        const ackCoords = parseCoords(ack.location || ack.coordinates);
        if (ackCoords) {
          L.marker([ackCoords.lat, ackCoords.lng], {
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
              className: 'ack-device-marker',
              iconSize: [25, 25],
            })
          }).bindPopup(`<b>${ack.name || "Device"}</b>`).addTo(markersRef.current);
        }
      }
    });

    reportLogs.forEach((report) => {
      const coords = parseCoords(report.location);
      if (!coords) return;
      L.marker([coords.lat, coords.lng], { icon: getReportIcon(report) })
        .bindPopup(`
          <div class="marker-popup">
            <b>🚨 Report #${report.reportId || report.id}</b><br/>
            <strong>Severity:</strong> ${emergencySeverityMap[report.emergencySeverity?.toLowerCase()]?.label || report.emergencySeverity || 'N/A'}<br/>
            <strong>Type:</strong> ${emergencyTypeMap[report.emergencyType?.toLowerCase()]?.label || report.emergencyType || 'N/A'}<br/>
            <strong>Reporter:</strong> ${report.reporterName || report.reporter || 'N/A'}<br/>
            <strong>Location:</strong> ${report.locationText || report.matchedLocation || 'N/A'}<br/>
            <strong>Team:</strong> ${report.respondingTeam || 'N/A'}<br/>
            <strong>Status:</strong> ${(report.status || 'N/A').toUpperCase()}<br/>
            <strong>Coordinates:</strong> ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}
            ${report.locationPrecision ? `<br/><strong>Precision:</strong> ${report.locationPrecision}` : ''}
          </div>
        `)
        .addTo(markersRef.current);
    });
  }, [notifications, reportLogs]); 

useEffect(() => {
  if (!mapRef.current) return;

  const db = getFirestore();
  const incidentsRef = collection(db, "incidents");

  const activeStatuses = ["pending", "in-progress", "partially-complete"]; // lowercase for comparison

  const unsubscribe = onSnapshot(incidentsRef, (snapshot) => {
    markersRef.current.clearLayers(); // clear old markers

    snapshot.forEach((doc) => {
      const incident = doc.data();
      const status = (incident.status || "").toLowerCase();

      const incidentCoords = incident.location;
      if (!incidentCoords?.lat || !incidentCoords?.lng) return; // safety check

      // Incident marker
      L.marker([incidentCoords.lat, incidentCoords.lng], { icon: getReportIcon(incident) })
        .bindPopup(`
          <div class="marker-popup">
            <b>🚨 Incident #${incident.reportId || incident.incidentCode}</b><br/>
            <strong>Severity:</strong> ${incident.emergencySeverity}<br/>
            <strong>Type:</strong> ${incident.emergencyType}<br/>
            <strong>Team:</strong> ${incident.respondingTeam}<br/>
            <strong>Status:</strong> ${incident.status}<br/>
            <strong>Location:</strong> ${incident.locationText || incident.matchedLocation || 'N/A'}
          </div>
        `)
        .addTo(markersRef.current);

      // Only show responder path and current location for active statuses
      if (activeStatuses.includes(status) && Array.isArray(incident.responderPath) && incident.responderPath.length > 0) {
        const polylinePoints = incident.responderPath
          .map(p => (p?.lat != null && p?.lng != null ? [p.lat, p.lng] : null))
          .filter(Boolean);

        if (polylinePoints.length > 0) {
          L.polyline(polylinePoints, { color: "blue", weight: 4, opacity: 0.7 }).addTo(mapRef.current);

          // Current responder location
          const currentLoc = incident.responderLocation || incident.responderPath[incident.responderPath.length - 1];
          if (currentLoc?.lat != null && currentLoc?.lng != null) {
            L.marker([currentLoc.lat, currentLoc.lng], {
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
                className: 'responder-marker',
                iconSize: [25, 25],
              })
            }).bindPopup(`Responder: ${incident.respondingTeam}`).addTo(mapRef.current);
          }
        }
      }
    });
  });

  return () => unsubscribe();
}, [mapRef]);

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
              mapRef.current.setView(victoriaTarlac, 14);
            }
          }}
        >
          <i className="fas fa-home" />
        </button>
      </div>
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