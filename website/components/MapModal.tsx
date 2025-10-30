'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { X, MapPin, Check } from 'lucide-react';

// Dynamically import the map component to avoid SSR issues
const MapComponent = dynamic(() => import('./WorldMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-gray-500">Loading map...</div>
    </div>
  )
});

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (lat: number, lng: number) => void;
  currentGuess?: { lat: number; lng: number } | null;
}

export function MapModal({ isOpen, onClose, onSelectLocation, currentGuess }: MapModalProps) {
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(
    currentGuess || null
  );

  useEffect(() => {
    setSelectedLocation(currentGuess || null);
  }, [currentGuess]);

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng });
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onSelectLocation(selectedLocation.lat, selectedLocation.lng);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-cyan-600" />
              Select Your Guess Location
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <p className="text-gray-600 text-sm mt-2">
            Click anywhere on the map to place your guess marker
          </p>
        </div>

        {/* Map Container */}
        <div className="p-6">
          <div className="w-full h-96 border-2 border-gray-200 rounded-lg overflow-hidden">
            <MapComponent
              onMapClick={handleMapClick}
              selectedLocation={selectedLocation}
            />
          </div>

          {/* Selected Location Display */}
          {selectedLocation && (
            <div className="mt-4 p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
              <div className="flex items-center gap-2 text-cyan-800">
                <MapPin className="h-4 w-4" />
                <span className="font-medium">Selected Location:</span>
                <span>{selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedLocation}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            Confirm Guess
          </button>
        </div>
      </div>
    </div>
  );
}