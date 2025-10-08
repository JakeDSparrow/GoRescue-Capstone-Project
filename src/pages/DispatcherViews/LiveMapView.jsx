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


export default function LiveMapView({ mapRef, notifications = [], reportLogs = [], cleanupInfo }) {
  //Refs for each type of map layer for proper management
  const markersRef = useRef(new L.LayerGroup());
  const pathsRef = useRef(new L.LayerGroup());
  const responderMarkersRef = useRef(new L.LayerGroup());
  const lastCleanTimestampRef = useRef(0);
  const incidentIdToLayerRefs = useRef({}); // track marker/path/responder per-incident
  
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
    // Use normalized hyphenated statuses to avoid retaining completed markers
    const activeStatuses = [
      "pending",
      "acknowledged",
      "en-route",
      "in-progress",
      "on-scene",
      "transferring",
      "heading-back"
    ];

    // This listener will handle ALL dynamic data
    const unsubscribe = onSnapshot(incidentsRef, (snapshot) => {
      // Defensive cleanup: remove stray emergency markers/circles, keep base tile/grid layer
      try {
        const map = mapRef.current;
        if (window.emergencyMarker && map) {
          map.removeLayer(window.emergencyMarker);
          window.emergencyMarker = null;
        }
        if (map && typeof map.eachLayer === 'function') {
          map.eachLayer((layer) => {
            const isOurGroup = (layer === markersRef.current || layer === pathsRef.current || layer === responderMarkersRef.current);
            if (isOurGroup) return;
            // Preserve base layers: GoogleMutant is a GridLayer, standard tiles are TileLayer
            if ((typeof L.GridLayer !== 'undefined' && layer instanceof L.GridLayer) || (layer instanceof L.TileLayer)) return;
            const isCircle = (layer instanceof L.Circle) || (layer instanceof L.CircleMarker);
            let isEmergencyMarker = false;
            try {
              const icon = layer?.options?.icon;
              const className = icon?.options?.className || layer?.options?.className;
              if (className && String(className).includes('emergency-marker')) {
                isEmergencyMarker = true;
              }
            } catch (_) {}
            if (isCircle || isEmergencyMarker) {
              try { map.removeLayer(layer); } catch (_) {}
            }
          });
        }
      } catch (_) {}
      // Ensure groups and per-incident registry are empty before redrawing
      markersRef.current.clearLayers();
      pathsRef.current.clearLayers();
      responderMarkersRef.current.clearLayers();
      incidentIdToLayerRefs.current = {};

      // Step 2: Skip drawing reportLog-based markers entirely to avoid stale local markers
      const normalize = (v) => String(v || '').toLowerCase().replace(/\s+/g, '-');
      const inactive = new Set(['completed', 'cancelled', 'canceled', 'recalled']);

      // Step 3: Draw incidents, paths, and responders from Firebase
      snapshot.forEach((doc) => {
        const incident = { id: doc.id, ...doc.data() };
        const status = String(incident.status || "").toLowerCase().replace(/\s+/g, "-");
        const incidentCoords = parseCoords(incident.location);

        if (!incidentCoords) return;

        // Only draw markers for active statuses; skip completed/cancelled/recalled
        if (activeStatuses.includes(status)) {
          const m = L.marker([incidentCoords.lat, incidentCoords.lng], { icon: getReportIcon(incident) })
            .bindPopup(`<b>🚨 Incident</b><br/>Status: ${incident.status || 'N/A'}`);
          m.addTo(markersRef.current);
          if (!incidentIdToLayerRefs.current[incident.id]) incidentIdToLayerRefs.current[incident.id] = {};
          incidentIdToLayerRefs.current[incident.id].marker = m;
        }

        // Draw path and responder marker ONLY if the incident is active
        if (activeStatuses.includes(status) && Array.isArray(incident.responderPath) && incident.responderPath.length > 0) {
          const polylinePoints = incident.responderPath.map(p => parseCoords(p)).filter(Boolean);

          if (polylinePoints.length > 1) {
            const pl = L.polyline(polylinePoints.map(p => [p.lat, p.lng]), { color: "#007bff", weight: 5, opacity: 0.8 }).addTo(pathsRef.current);
            if (!incidentIdToLayerRefs.current[incident.id]) incidentIdToLayerRefs.current[incident.id] = {};
            incidentIdToLayerRefs.current[incident.id].path = pl;
          }
          
          const currentLoc = parseCoords(incident.responderLocation || incident.responderPath[incident.responderPath.length - 1]);
          if (currentLoc) {
            const rm = L.marker([currentLoc.lat, currentLoc.lng], { icon: getResponderIcon() })
              .bindPopup(`Responder for Incident #${incident.id.substring(0, 5)}`);
            rm.addTo(responderMarkersRef.current);
            if (!incidentIdToLayerRefs.current[incident.id]) incidentIdToLayerRefs.current[incident.id] = {};
            incidentIdToLayerRefs.current[incident.id].responder = rm;
          }
        }
      });

      // Persist a minimal cache snapshot for sync/cleanup heuristics
      try {
        const cache = {
          lastDrawAt: Date.now(),
          activeMarkerCount: markersRef.current.getLayers().length,
          activePathCount: pathsRef.current.getLayers().length,
          activeResponderCount: responderMarkersRef.current.getLayers().length
        };
        sessionStorage.setItem('liveMapCache', JSON.stringify(cache));
      } catch (_) {}
    });

    return () => unsubscribe(); // Cleanup listener on component unmount
  }, [mapRef, notifications, reportLogs]); // Rerun if map is ready or props change

  // 5. React to external cleanup info: remove layers for completed incident id immediately
  useEffect(() => {
    if (!cleanupInfo || !cleanupInfo.incidentId) return;
    const { incidentId } = cleanupInfo;
    const refs = incidentIdToLayerRefs.current[incidentId];
    const map = mapRef.current;
    if (refs && map) {
      try { if (refs.marker) map.removeLayer(refs.marker); } catch(_) {}
      try { if (refs.path) map.removeLayer(refs.path); } catch(_) {}
      try { if (refs.responder) map.removeLayer(refs.responder); } catch(_) {}
      delete incidentIdToLayerRefs.current[incidentId];
    }
    // Also clear any global emergency marker
    try { if (window.emergencyMarker && map) { map.removeLayer(window.emergencyMarker); window.emergencyMarker = null; } } catch(_) {}
  }, [cleanupInfo]);

  // 3. Cleanup function similar to endMissionCleanup
  const endMissionCleanup = () => {
    // Stop any tracking-related intervals/listeners owned by this view (none explicit here)
    // Reset map dynamic layers
    if (markersRef.current) markersRef.current.clearLayers();
    if (pathsRef.current) pathsRef.current.clearLayers();
    if (responderMarkersRef.current) responderMarkersRef.current.clearLayers();

    // Clear stale cache so completed incidents do not reappear from persisted state
    try {
      sessionStorage.removeItem('liveMapCache');
      const dispatcherData = sessionStorage.getItem('dispatcherData');
      if (dispatcherData) {
        const parsed = JSON.parse(dispatcherData);
        // remove any completed items from notifications and reportLogs
        const normalize = (v) => String(v || '').toLowerCase().replace(/\s+/g, '-');
        const inactive = new Set(['completed', 'cancelled', 'canceled', 'recalled']);
        const cleanedNotifs = Array.isArray(parsed.notifications)
          ? parsed.notifications.filter(n => !inactive.has(normalize(n.type)))
          : [];
        const cleanedReports = Array.isArray(parsed.reportLogs)
          ? parsed.reportLogs.filter(r => !inactive.has(normalize(r.status)))
          : [];
        sessionStorage.setItem('dispatcherData', JSON.stringify({
          ...parsed,
          notifications: cleanedNotifs,
          reportLogs: cleanedReports,
          timestamp: Date.now()
        }));
      }
    } catch (_) {}
    lastCleanTimestampRef.current = Date.now();
  };

  // 4. Add a small control to trigger cleanup
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const CleanControl = L.Control.extend({
      onAdd: function() {
        const btn = L.DomUtil.create('button', 'map-control');
        btn.title = 'Clean Map';
        btn.innerHTML = '<i class="fas fa-broom"></i>';
        L.DomEvent.on(btn, 'click', (e) => {
          L.DomEvent.stopPropagation(e);
          endMissionCleanup();
        });
        return btn;
      }
    });
    const ctrl = new CleanControl({ position: 'topright' });
    map.addControl(ctrl);
    return () => {
      try { map.removeControl(ctrl); } catch(_) {}
    };
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