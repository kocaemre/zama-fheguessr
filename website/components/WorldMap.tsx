'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
// Leaflet CSS is imported in globals.css to avoid SSR issues

// Fix for default markers in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom red marker icon for guess location
const guessIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface WorldMapProps {
  onMapClick: (lat: number, lng: number) => void;
  selectedLocation?: { lat: number; lng: number } | null;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      onMapClick(lat, lng);
    },
  });
  return null;
}

export default function WorldMap({ onMapClick, selectedLocation }: WorldMapProps) {
  const mapRef = useRef<L.Map | null>(null);

  // Update map view when selectedLocation changes
  useEffect(() => {
    if (selectedLocation && mapRef.current) {
      mapRef.current.setView([selectedLocation.lat, selectedLocation.lng], 4);
    }
  }, [selectedLocation]);

  return (
    <MapContainer
      center={[20, 0]} // Centered on world
      zoom={2}
      style={{ height: '100%', width: '100%' }}
      ref={(map) => {
        if (map) {
          mapRef.current = map;
        }
      }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={10}
        minZoom={2}
      />

      <MapClickHandler onMapClick={onMapClick} />

      {selectedLocation && (
        <Marker
          position={[selectedLocation.lat, selectedLocation.lng]}
          icon={guessIcon}
        />
      )}
    </MapContainer>
  );
}