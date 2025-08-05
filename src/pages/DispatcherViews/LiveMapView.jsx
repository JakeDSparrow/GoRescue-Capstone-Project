import React, { useEffect } from 'react';
import L from 'leaflet';
import { emergencyTypeMap } from '../../constants/dispatchConstants';
import 'leaflet/dist/leaflet.css';

export default function LiveMapView({ mapRef, notifications = [] }) {
  useEffect(() => {
    const mapContainer = document.getElementById('map');

    if (mapContainer && mapContainer._leaflet_id) {
      mapContainer._leaflet_id = null; // reset for hot reloads
    }

    const victoriaTarlac = [15.5784, 120.6819];

    const map = L.map(mapContainer).setView(victoriaTarlac, 14);

    L.tileLayer(`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=499958bc884b4b8cae36c651db0a3d7d`, {
      attribution: 'Powered by Geoapify',
      maxZoom: 20,
    }).addTo(map);

    // 🔴 Add markers for each notification
    const markers = notifications.map(notification => {
      if (!notification.coordinates) return null;

      const coords = typeof notification.coordinates === 'string'
        ? JSON.parse(notification.coordinates)
        : notification.coordinates;

      if (!coords || !coords.lat || !coords.lng) return null;

      const typeMeta = emergencyTypeMap[notification.type] || {};
      const markerColor = typeMeta.color || '#555';

      return L.marker([coords.lat, coords.lng], {
        icon: L.divIcon({
          html: `<div style="
              background-color: ${markerColor};
              border: 2px solid white;
              border-radius: 50%;
              width: 20px;
              height: 20px;
              box-shadow: 0 0 6px ${markerColor};
            " title="${typeMeta.label || 'Emergency'}"></div>`,
          className: 'emergency-marker',
          iconSize: [20, 20],
        })
      }).addTo(map).bindPopup(`${typeMeta.label || notification.type}<br>${notification.location}`);
    }).filter(Boolean);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapRef, notifications]);


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
        <button className="map-control" title="Locate Me" onClick={() => {
          if (navigator.geolocation && mapRef.current) {
            navigator.geolocation.getCurrentPosition(pos => {
              const coords = [pos.coords.latitude, pos.coords.longitude];
              mapRef.current.setView(coords, 16);
              L.marker(coords).addTo(mapRef.current).bindPopup("You are here").openPopup();
            });
          }
        }}>
          <i className="fas fa-location-arrow" />
        </button>
      </div>
    </div>
  );
}
