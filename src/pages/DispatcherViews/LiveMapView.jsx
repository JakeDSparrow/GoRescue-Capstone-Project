import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.gridlayer.googlemutant';
import { getFirestore, collection, onSnapshot } from "firebase/firestore";
import { emergencySeverityMap, emergencyTypeMap } from '../../constants/dispatchConstants';
import 'leaflet/dist/leaflet.css';

const db = getFirestore();

// Helper function to parse coordinates robustly
const parseCoords = (loc) => {
  if (!loc) return null;
  if (typeof loc === 'object' && loc !== null) {
    const lat = Number(loc.lat ?? loc.latitude);
    const lng = Number(loc.lng ?? loc.lon ?? loc.longitude);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  // Add other parsing logic from your original code if needed (string, JSON, etc.)
  return null;
};

// Custom marker icon functions (assuming these are correct)
const getNotificationIcon = (notif) => {
  const typeMeta = emergencyTypeMap[notif.type?.toLowerCase()] || {};
  const color = typeMeta.color || '#555';
  return L.divIcon({
    html: `<div style="background-color:${color};border:2px solid white;border-radius:50%;width:30px;height:30px;box-shadow:0 0 6px ${color};display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;" title="${typeMeta.label || 'Unknown'}">N</div>`,
    className: 'emergency-marker notification-marker',
    iconSize: [30, 30],
  });
};

const getReportIcon = (report) => {
  const severityMeta = emergencySeverityMap[report.emergencySeverity?.toLowerCase()] || {};
  const color = severityMeta.color || '#e74c3c';
  return L.divIcon({
    html: `<div style="background-color:${color};border:2px solid white;border-radius:50%;width:35px;height:35px;box-shadow:0 0 8px ${color};display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;" title="${severityMeta.label || 'Unknown'}">R</div>`,
    className: 'emergency-marker report-marker',
    iconSize: [35, 35],
  });
};

// Responder icon
const getResponderIcon = () => L.divIcon({
  html: `<div style="background-color:#007bff;border:2px solid white;border-radius:50%;width:25px;height:25px;box-shadow:0 0 6px #007bff;display:flex;align-items:center;justify-content:center;color:white;font-size:10px;">📍</div>`,
  className: 'responder-marker',
  iconSize: [25, 25],
});


export default function LiveMapView({ mapRef, notifications = [], reportLogs = [] }) {
  //Refs for each type of map layer for proper management
  const markersRef = useRef(new L.LayerGroup());
  const pathsRef = useRef(new L.LayerGroup());
  const responderMarkersRef = useRef(new L.LayerGroup());
  
  const victoriaTarlac = [15.5784, 120.6819];

  // 1. Map Initialization Effect (runs only once)
  useEffect(() => {
    const mapContainer = document.getElementById('map');
    if (mapContainer && !mapContainer._leaflet_id) {
        const map = L.map(mapContainer).setView(victoriaTarlac, 14);

        L.gridLayer.googleMutant({
            type: 'roadmap',
            maxZoom: 21,
            attribution: '© Google Maps'
        }).addTo(map);

        // Add all layer groups to the map
        markersRef.current.addTo(map);
        pathsRef.current.addTo(map);
        responderMarkersRef.current.addTo(map);

        mapRef.current = map;
    }

    return () => {
        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
        }
    };
  }, [mapRef]); // Depend only on mapRef

  // 2. Consolidated Data and Drawing Effect
  useEffect(() => {
    if (!mapRef.current) return;

    const incidentsRef = collection(db, "incidents");
    const activeStatuses = ["acknowledged", "in progress", "on scene", "transferring patient"];

    // This listener will handle ALL dynamic data
    const unsubscribe = onSnapshot(incidentsRef, (snapshot) => {
      // Step 1: ALWAYS clear all dynamic layers before redrawing
      markersRef.current.clearLayers();
      pathsRef.current.clearLayers();
      responderMarkersRef.current.clearLayers();

      // Step 2: Draw markers from props (notifications, reportLogs)
      notifications.forEach((notif) => {
        const coords = parseCoords(notif.coordinates || notif.location);
        if (!coords) return;
        L.marker([coords.lat, coords.lng], { icon: getNotificationIcon(notif) })
          .bindPopup(`<b>📢 Notification</b><br/>Type: ${notif.type || 'N/A'}`)
          .addTo(markersRef.current);
      });
      
      reportLogs.forEach((report) => {
        const coords = parseCoords(report.location);
        if (!coords) return;
        L.marker([coords.lat, coords.lng], { icon: getReportIcon(report) })
         .bindPopup(`<b>🚨 Report</b><br/>Severity: ${report.emergencySeverity || 'N/A'}`)
         .addTo(markersRef.current);
      });

      // Step 3: Draw incidents, paths, and responders from Firebase
      snapshot.forEach((doc) => {
        const incident = { id: doc.id, ...doc.data() };
        const status = (incident.status || "").toLowerCase();
        const incidentCoords = parseCoords(incident.location);

        if (!incidentCoords) return;

        // Incident marker
        L.marker([incidentCoords.lat, incidentCoords.lng], { icon: getReportIcon(incident) })
          .bindPopup(`<b>🚨 Incident #${incident.id.substring(0, 5)}</b><br/>Status: ${incident.status}`)
          .addTo(markersRef.current);

        // Draw path and responder marker ONLY if the incident is active
        if (activeStatuses.includes(status) && Array.isArray(incident.responderPath) && incident.responderPath.length > 0) {
          const polylinePoints = incident.responderPath.map(p => parseCoords(p)).filter(Boolean);

          if (polylinePoints.length > 1) {
            L.polyline(polylinePoints.map(p => [p.lat, p.lng]), { color: "#007bff", weight: 5, opacity: 0.8 }).addTo(pathsRef.current);
          }
          
          const currentLoc = parseCoords(incident.responderLocation || incident.responderPath[incident.responderPath.length - 1]);
          if (currentLoc) {
            L.marker([currentLoc.lat, currentLoc.lng], { icon: getResponderIcon() })
              .bindPopup(`Responder for Incident #${incident.id.substring(0, 5)}`)
              .addTo(responderMarkersRef.current);
          }
        }
      });
    });

    return () => unsubscribe(); // Cleanup listener on component unmount
  }, [mapRef, notifications, reportLogs]); // Rerun if map is ready or props change

  return (
    <div className="map-container">
      <div id="map" className="leaflet-map" />
      {/* Your map controls and legend JSX can remain here as they were */}
       <div className="map-controls">
         <button className="map-control" title="Zoom In" onClick={() => mapRef.current?.zoomIn()}>
           <i className="fas fa-plus" />
         </button>
         <button className="map-control" title="Zoom Out" onClick={() => mapRef.current?.zoomOut()}>
           <i className="fas fa-minus" />
         </button>
         <button className="map-control" title="Reset View" onClick={() => mapRef.current?.setView(victoriaTarlac, 14)}>
           <i className="fas fa-home" />
         </button>
       </div>
       <div className="map-legend">
         <div className="legend-item">
           <div className="legend-marker" style={{ backgroundColor: '#e74c3c' }}>R</div>
           <span>Reports/Incidents</span>
         </div>
         <div className="legend-item">
           <div className="legend-marker" style={{ backgroundColor: '#555' }}>N</div>
           <span>Notifications</span>
         </div>
       </div>
    </div>
  );
}