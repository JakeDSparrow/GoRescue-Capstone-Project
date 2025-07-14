import React, { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function LiveMapView({ mapRef }) {
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

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
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
