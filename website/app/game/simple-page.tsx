"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Globe, ArrowLeft, MapPin, Loader2, Lock, Send, Shield, Check, Eye } from "lucide-react";
import { useAccount } from 'wagmi';
import { WalletConnection } from "@/components/WalletConnection";
import { encryptCoordinates, CONTRACT_CONFIG } from "@/lib/fhe";
import { FHEGeoGuessrContract, getSigner } from "@/lib/contract";
import * as Dialog from "@radix-ui/react-dialog";
import { useWalletClient } from 'wagmi';

// MapLibre GL JS imports
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';

export default function SimpleGamePage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [currentRound, setCurrentRound] = useState<any>(null);
  const [isLoadingRound, setIsLoadingRound] = useState(true);
  const [showMapModal, setShowMapModal] = useState(false);
  const [currentGuess, setCurrentGuess] = useState<{ lat: number; lng: number } | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [contract, setContract] = useState<FHEGeoGuessrContract | null>(null);
  const [playerGuesses, setPlayerGuesses] = useState<any[]>([]);
  const [showDistanceResult, setShowDistanceResult] = useState(false);
  const [latestDistance, setLatestDistance] = useState<number | null>(null);
  const [isLoadingDistance, setIsLoadingDistance] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultModalStep, setResultModalStep] = useState<'waiting' | 'result'>('waiting');
  const [progressStep, setProgressStep] = useState<'encrypting' | 'submitting' | 'decrypting' | 'completed'>('encrypting');
  const [progressMessage, setProgressMessage] = useState('');
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);


  // Initialize contract when wallet connects
  useEffect(() => {
    const initContract = async () => {
      if (walletClient && isConnected) {
        try {
          const signer = await getSigner(walletClient);
          const contractInstance = new FHEGeoGuessrContract(signer);
          setContract(contractInstance);
          console.log("Contract initialized");
        } catch (error) {
          console.error("Failed to initialize contract:", error);
        }
      }
    };

    initContract();
  }, [walletClient, isConnected]);

  // Load current round from contract
  useEffect(() => {
    const loadCurrentRound = async () => {
      try {
        setIsLoadingRound(true);
        console.log("Loading current round from smart contract...");

        // Always try to load from contract, even without wallet connection
        if (contract) {
          console.log("Using wallet-connected contract instance");
          const round = await contract.getCurrentRound();

          if (round && round.isActive) {
            console.log("Active round found:", round);
            setCurrentRound(round);
          } else {
            console.log("No active round found");
            setCurrentRound(null);
          }
        } else {
          // Create a read-only contract instance for checking rounds
          console.log("Creating read-only contract instance");
          const { FHEGeoGuessrContract, getProvider } = await import("@/lib/contract");
          const provider = getProvider();
          const readOnlyContract = new FHEGeoGuessrContract(provider);

          const round = await readOnlyContract.getCurrentRound();

          if (round && round.isActive) {
            console.log("Active round found via read-only contract:", round);
            setCurrentRound(round);
          } else {
            console.log("No active round found");
            setCurrentRound(null);
          }
        }
      } catch (error) {
        console.error("Failed to load round from contract:", error);
        setCurrentRound(null);
      } finally {
        setIsLoadingRound(false);
      }
    };

    loadCurrentRound();
  }, [contract]);


  // Load player distances when contract and round are available
  useEffect(() => {
    if (contract && currentRound && address && isConnected) {
      loadPlayerDistances();
    }
  }, [contract, currentRound, address, isConnected]);


  // Initialize MapLibre map
  const initializeMap = () => {
    if (!mapContainer.current || mapRef.current) return;

    try {
      console.log('Initializing MapLibre map...');

      const mapInstance = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap Contributors'
            }
          },
          layers: [
            {
              id: 'osm',
              type: 'raster',
              source: 'osm'
            }
          ]
        },
        center: [0, 0],
        zoom: 2
      });

      mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');

      // Wait for map to load before adding events
      mapInstance.on('load', () => {
        console.log('Map loaded successfully');

        // Add click event for guessing
        mapInstance.on('click', (e) => {
          const { lng, lat } = e.lngLat;
          setCurrentGuess({ lat, lng });
          console.log('Selected location:', { lat, lng });

          // Remove existing marker if any
          const existingMarker = document.querySelector('.maplibregl-marker');
          if (existingMarker) {
            existingMarker.remove();
          }

          // Add marker at clicked location
          new maplibregl.Marker({ color: '#ff0000' })
            .setLngLat([lng, lat])
            .addTo(mapInstance);
        });
      });

      mapInstance.on('error', (e) => {
        console.error('Map error:', e);
      });

      mapRef.current = mapInstance;
      console.log('Map instance created');

    } catch (error) {
      console.error('Failed to initialize map:', error);
    }
  };

  const handleMakeGuess = () => {
    setShowMapModal(true);
    // Give the modal time to render and CSS to load before initializing map
    setTimeout(() => {
      if (mapContainer.current) {
        initializeMap();
      } else {
        // Retry if container not ready
        setTimeout(initializeMap, 200);
      }
    }, 300);
  };

  // Load player's guesses and distances from contract
  const loadPlayerDistances = async () => {
    if (!contract || !address || !currentRound) return;

    try {
      setIsLoadingDistance(true);
      console.log("Loading player distances from contract...");

      const guesses = await contract.getPlayerGuesses(currentRound.id, address);
      setPlayerGuesses(guesses);

      // Check if we have any revealed distances
      if (guesses.length > 0) {
        const latestGuess = guesses[guesses.length - 1];
        if (latestGuess.revealed && latestGuess.distance > 0) {
          // Convert from meters to kilometers (contract returns in meters)
          const distanceInKm = latestGuess.distance / 1000;
          setLatestDistance(distanceInKm);

          // Show result in modal if it's currently showing
          if (showResultModal && resultModalStep === 'waiting') {
            setResultModalStep('result');
          }


          console.log("Latest distance from contract:", distanceInKm, "km");
        }
      }
    } catch (error) {
      console.error("Failed to load player distances:", error);
    } finally {
      setIsLoadingDistance(false);
    }
  };

  // Submit encrypted guess using FHE and smart contract with immediate distance calculation
  const submitEncryptedGuess = async (latitude: number, longitude: number) => {
    if (!isConnected || !address || !contract) {
      alert("Please connect your wallet first");
      return;
    }

    if (!currentRound) {
      alert("No active round found");
      return;
    }

    try {
      setIsEncrypting(true);
      console.log("Submitting guess to smart contract...");

      // Reset map modal
      setShowMapModal(false);
      setCurrentGuess(null);

      // Show waiting modal with first step
      setProgressStep('encrypting');
      setProgressMessage('Encrypting coordinates...');
      setResultModalStep('waiting');
      setShowResultModal(true);

      // Small delay to show encryption step
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update to submitting step
      setProgressStep('submitting');
      setProgressMessage('Submitting guess to blockchain...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Submit guess and get encrypted distance immediately
      const result = await contract.submitGuess(latitude, longitude, address);
      console.log("Guess submitted successfully:", result);

      // Update to blockchain confirmation
      setProgressMessage('Confirmed on blockchain ✓');
      await new Promise(resolve => setTimeout(resolve, 800));

      // If we got an encrypted distance, decrypt it immediately
      if (result.encryptedDistance) {
        setProgressStep('decrypting');
        setProgressMessage('Decrypting distance...');
        console.log("Decrypting distance immediately...");

        try {
          const decryptedDistance = await contract.decryptDistance(result.encryptedDistance, address);
          console.log("Distance decrypted:", decryptedDistance, "km");

          setProgressStep('completed');
          setProgressMessage('Decryption completed ✓');
          await new Promise(resolve => setTimeout(resolve, 800));

          setLatestDistance(decryptedDistance);
          setResultModalStep('result');
        } catch (decryptError) {
          console.error("Failed to decrypt distance:", decryptError);
          setProgressMessage(`Decryption error: ${decryptError.message}`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          setResultModalStep('result');
          setLatestDistance(null);
        }
      } else {
        console.warn("No encrypted distance received from contract");
        setProgressMessage('No encrypted distance received');
        await new Promise(resolve => setTimeout(resolve, 1000));
        setResultModalStep('result');
        setLatestDistance(null);
      }

    } catch (error: any) {
      console.error('Failed to submit guess:', error);
      setProgressMessage(`Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      setShowResultModal(false);
    } finally {
      setIsEncrypting(false);
    }
  };

  // Handle dialog close
  const handleDialogChange = (open: boolean) => {
    setShowMapModal(open);
    if (!open) {
      setCurrentGuess(null);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    }
  };

  return (
    <div className="h-screen bg-black relative overflow-hidden">
      {/* Full Screen Panorama */}
      <div className="absolute inset-0 w-full h-full z-0">
        {isLoadingRound ? (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-12 w-12 text-cyan-400 mx-auto mb-4 animate-spin" />
              <p className="text-white text-lg">Loading round...</p>
            </div>
          </div>
        ) : currentRound ? (
          <>
            <iframe
              key={currentRound.id}
              width="100%"
              height="100%"
              src={currentRound.panoramaUrl}
              frameBorder="0"
              className="w-full h-full"
              title="360° Mystery Location"
              allowFullScreen
              onLoad={() => console.log("Iframe loaded successfully:", currentRound.panoramaUrl)}
              onError={() => console.error("Iframe failed to load:", currentRound.panoramaUrl)}
            />
            {/* Overlay to hide any UI buttons */}
            <div className="absolute top-4 right-4 w-32 h-12 bg-transparent pointer-events-none z-20"></div>
          </>
        ) : (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <div className="text-center">
              <Globe className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
              <p className="text-white text-lg">No active round</p>
              <p className="text-white/70 text-sm">Wait for an admin to create a new round on the smart contract</p>
            </div>
          </div>
        )}
      </div>

      {/* Top Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="bg-black/70 backdrop-blur-sm border-b border-white/20">
          <div className="flex items-center justify-between px-6 py-4">
            {/* Logo and Back */}
            <Link
              href="/"
              className="flex items-center gap-2 text-white hover:text-white/80 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <Globe className="h-6 w-6" />
              <span className="font-semibold tracking-wider">FHE GEOGUESSR</span>
            </Link>

            {/* Wallet Connection */}
            <div className="flex items-center gap-2">
              <WalletConnection />
            </div>
          </div>
        </div>
      </div>


      {/* Bottom Left Make Guess Button */}
      {isConnected && currentRound && !isLoadingRound && (
        <div className="absolute bottom-6 left-6 z-10">
          <button
            onClick={handleMakeGuess}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 shadow-lg"
          >
            <MapPin className="h-5 w-5" />
            Make Guess
          </button>
        </div>
      )}

      {/* Connect Wallet Prompt - Show when wallet not connected */}
      {!isConnected && (
        <div className="absolute bottom-6 left-6 z-10">
          <div className="bg-black/80 backdrop-blur-sm border border-white/20 rounded-lg p-6 w-80">
            <div className="text-center">
              <h3 className="text-white font-semibold mb-2">Connect Wallet to Play</h3>
              <p className="text-white/70 text-sm mb-4">
                Connect your Web3 wallet to start playing FHE GeoGuessr
              </p>
              <div className="flex justify-center">
                <WalletConnection />
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Shadcn Dialog for Map */}
      <Dialog.Root open={showMapModal} onOpenChange={handleDialogChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-black border border-white/20 rounded-xl overflow-hidden z-50">
            <Dialog.Title className="p-6 border-b border-white/20">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white tracking-wide">
                  🗺️ Select Your Guess Location
                </h3>
                <Dialog.Close className="text-white/70 hover:text-white transition-colors">
                  ✕
                </Dialog.Close>
              </div>
              <div className="mt-4">
                <p className="text-white/70 text-sm">
                  Click anywhere on the world map below to make your guess
                </p>
              </div>
            </Dialog.Title>

            {/* MapLibre Interactive Map */}
            <div className="p-6">
              <div
                ref={mapContainer}
                className="w-full h-96 rounded-lg border border-white/20 bg-gray-800"
                style={{ minHeight: '400px', width: '100%', height: '400px' }}
              />

              {!currentGuess && (
                <div className="text-center py-4">
                  <p className="text-white/50 text-sm">
                    🎯 Click on the map above to select your guess location
                  </p>
                </div>
              )}

              {/* Current Guess Display & Submit */}
              {currentGuess && (
                <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-400 text-sm font-medium mb-1">Your guess:</p>
                      <div className="text-green-300 font-mono text-sm">
                        📍 {currentGuess.lat.toFixed(4)}, {currentGuess.lng.toFixed(4)}
                      </div>
                    </div>
                    <button
                      onClick={() => submitEncryptedGuess(currentGuess.lat, currentGuess.lng)}
                      className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                      disabled={isEncrypting || !isConnected}
                    >
                      {isEncrypting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Encrypting...
                        </>
                      ) : (
                        <>
                          🔐 Submit Encrypted Guess
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Result Modal - Waiting & Distance Display */}
      <Dialog.Root open={showResultModal} onOpenChange={(open) => {
        if (!open) {
          setShowResultModal(false);
          setResultModalStep('waiting');
          setLatestDistance(null);
          setProgressStep('encrypting');
          setProgressMessage('');
        }
      }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-black border border-white/20 rounded-xl overflow-hidden z-50">
            <Dialog.Title className="sr-only">
              {resultModalStep === 'waiting' ? 'Processing Your Guess' : 'Distance Result'}
            </Dialog.Title>

            {/* Waiting Step */}
            {resultModalStep === 'waiting' && (
              <>
                <div className="p-8 text-center">
                  {/* Main Icon */}
                  <div className="mb-6">
                    {progressStep === 'completed' ? (
                      <div className="h-20 w-20 bg-green-500 rounded-full mx-auto flex items-center justify-center animate-pulse">
                        <Check className="h-10 w-10 text-white" />
                      </div>
                    ) : (
                      <div className="h-20 w-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full mx-auto flex items-center justify-center animate-pulse">
                        <Shield className="h-10 w-10 text-white" />
                      </div>
                    )}
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-2">
                    {progressStep === 'completed' ? '🎉 Process Complete' : '🔐 FHE Privacy Processing'}
                  </h3>
                  <p className="text-gray-400 text-sm mb-8">
                    {progressStep === 'completed'
                      ? 'Your distance has been calculated securely!'
                      : 'Your coordinates are being processed with complete privacy'
                    }
                  </p>

                  {/* Progress Steps */}
                  <div className="space-y-4 mb-8">
                    {/* Step 1: Encrypting */}
                    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-500 ${
                      progressStep === 'encrypting' ? 'bg-blue-500/20 border-blue-500/50 shadow-lg shadow-blue-500/20' :
                      ['submitting', 'decrypting', 'completed'].includes(progressStep) ? 'bg-green-500/10 border-green-500/30' :
                      'bg-gray-500/10 border-gray-500/30'
                    }`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        progressStep === 'encrypting' ? 'bg-blue-500' :
                        ['submitting', 'decrypting', 'completed'].includes(progressStep) ? 'bg-green-500' :
                        'bg-gray-500'
                      }`}>
                        {['submitting', 'decrypting', 'completed'].includes(progressStep) ? (
                          <Check className="h-4 w-4 text-white" />
                        ) : progressStep === 'encrypting' ? (
                          <Lock className="h-4 w-4 text-white animate-pulse" />
                        ) : (
                          <Lock className="h-4 w-4 text-white opacity-50" />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="text-white font-medium">Encrypting Coordinates</h4>
                        <p className="text-gray-400 text-sm">Converting your guess into encrypted data using FHE</p>
                      </div>
                      {progressStep === 'encrypting' && (
                        <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                      )}
                    </div>

                    {/* Step 2: Submitting */}
                    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-500 ${
                      progressStep === 'submitting' ? 'bg-blue-500/20 border-blue-500/50 shadow-lg shadow-blue-500/20' :
                      ['decrypting', 'completed'].includes(progressStep) ? 'bg-green-500/10 border-green-500/30' :
                      'bg-gray-500/10 border-gray-500/30'
                    }`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        progressStep === 'submitting' ? 'bg-blue-500' :
                        ['decrypting', 'completed'].includes(progressStep) ? 'bg-green-500' :
                        'bg-gray-500'
                      }`}>
                        {['decrypting', 'completed'].includes(progressStep) ? (
                          <Check className="h-4 w-4 text-white" />
                        ) : progressStep === 'submitting' ? (
                          <Send className="h-4 w-4 text-white animate-pulse" />
                        ) : (
                          <Send className="h-4 w-4 text-white opacity-50" />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="text-white font-medium">Blockchain Submission</h4>
                        <p className="text-gray-400 text-sm">Sending encrypted guess to smart contract</p>
                      </div>
                      {progressStep === 'submitting' && (
                        <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                      )}
                    </div>

                    {/* Step 3: Decrypting */}
                    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-500 ${
                      progressStep === 'decrypting' ? 'bg-blue-500/20 border-blue-500/50 shadow-lg shadow-blue-500/20' :
                      progressStep === 'completed' ? 'bg-green-500/10 border-green-500/30' :
                      'bg-gray-500/10 border-gray-500/30'
                    }`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        progressStep === 'decrypting' ? 'bg-blue-500' :
                        progressStep === 'completed' ? 'bg-green-500' :
                        'bg-gray-500'
                      }`}>
                        {progressStep === 'completed' ? (
                          <Check className="h-4 w-4 text-white" />
                        ) : progressStep === 'decrypting' ? (
                          <Eye className="h-4 w-4 text-white animate-pulse" />
                        ) : (
                          <Eye className="h-4 w-4 text-white opacity-50" />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="text-white font-medium">Decrypting Result</h4>
                        <p className="text-gray-400 text-sm">Revealing your distance using your private key</p>
                      </div>
                      {progressStep === 'decrypting' && (
                        <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                      )}
                    </div>
                  </div>

                  {/* Current Progress Message */}
                  <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-4 mb-6">
                    <p className="text-cyan-300 font-medium">
                      {progressMessage || 'Initializing secure FHE process...'}
                    </p>
                  </div>

                  {/* Privacy Info */}
                  <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-green-400" />
                      <span className="text-green-400 font-medium text-sm">Privacy Guaranteed</span>
                    </div>
                    <p className="text-green-300 text-xs leading-relaxed">
                      Your coordinates are encrypted before leaving your device. The smart contract calculates distance without ever seeing your actual location using Zama's FHE technology.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Result Step */}
            {resultModalStep === 'result' && latestDistance !== null && (
              <>
                <div className="p-8 text-center">
                  <div className="mb-6">
                    <div className="h-16 w-16 text-green-400 mx-auto flex items-center justify-center text-4xl">
                      🎯
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-6">
                    🎯 Distance Calculated!
                  </h3>

                  <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-6 mb-6">
                    <div className="text-4xl font-bold text-green-300 mb-2">
                      {latestDistance.toFixed(2)} km
                    </div>
                    <p className="text-green-400 text-sm">
                      🔐 Calculated with FHE encryption
                    </p>
                  </div>

                  <div className="space-y-3 text-white/80 text-sm mb-6">
                    <p>
                      The smart contract has calculated the distance between your encrypted guess and the target location.
                    </p>
                    <p>
                      Your private coordinates were never revealed during this process thanks to Fully Homomorphic Encryption!
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setShowResultModal(false);
                      setResultModalStep('waiting');
                      setLatestDistance(null);
                      setProgressStep('encrypting');
                      setProgressMessage('');
                    }}
                    className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Continue Playing
                  </button>
                </div>
              </>
            )}

          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}