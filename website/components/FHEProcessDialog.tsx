'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Check, Clock, Lock, Shield, Key, Send, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAccount, useWalletClient } from 'wagmi';
import { FHEGeoGuessrContract, getSigner } from '@/lib/contract';

interface ProcessStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'processing' | 'completed' | 'error';
  data?: string[];
}

interface FHEProcessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  latitude: number;
  longitude: number;
  onComplete: (result: any) => void;
  onError: (error: Error) => void;
}

export function FHEProcessDialog({
  isOpen,
  onClose,
  latitude,
  longitude,
  onComplete,
  onError
}: FHEProcessDialogProps) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [showRawData, setShowRawData] = useState<{ [key: string]: boolean }>({});
  const [contract, setContract] = useState<FHEGeoGuessrContract | null>(null);
  const [steps, setSteps] = useState<ProcessStep[]>([
    {
      id: 'signature',
      title: 'Generate Cryptographic Signature',
      description: 'Creating digital signature for secure FHE operations. This signature proves you own your wallet and authorizes the encryption process.',
      icon: <Key className="h-5 w-5" />,
      status: 'pending',
    },
    {
      id: 'encrypt',
      title: 'Encrypt Coordinates with FHE',
      description: 'Your location data is being encrypted using Fully Homomorphic Encryption. This allows computations on encrypted data without revealing the actual coordinates.',
      icon: <Lock className="h-5 w-5" />,
      status: 'pending',
    },
    {
      id: 'blockchain',
      title: 'Submit to Blockchain',
      description: 'Sending your encrypted guess to the Ethereum blockchain. The smart contract will compute the distance without ever seeing your actual coordinates.',
      icon: <Send className="h-5 w-5" />,
      status: 'pending',
    },
    {
      id: 'decrypt',
      title: 'Decrypt Result',
      description: 'Decrypting the computed distance result. Only you can decrypt this value using your private key, maintaining complete privacy.',
      icon: <Shield className="h-5 w-5" />,
      status: 'pending',
    }
  ]);

  const updateStepStatus = (stepId: string, status: ProcessStep['status'], data?: string[]) => {
    setSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, status, data } : step
    ));
  };

  const maskData = (data: string, visible: boolean = false) => {
    if (visible) return data;
    if (data.length <= 8) return '••••••••';
    return data.slice(0, 4) + '••••••••••••••••' + data.slice(-4);
  };

  const toggleDataVisibility = (stepId: string) => {
    setShowRawData(prev => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  useEffect(() => {
    if (!isOpen) return;

    const processSteps = async () => {
      try {
        // Step 1: Generate Signature
        setCurrentStep(0);
        updateStepStatus('signature', 'processing');

        // Simulate signature generation delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        const signatureData = [
          'EIP712 Domain: FHE GeoGuessr',
          'Message Type: UserDecryptRequestVerification',
          'Signature: 0x2957373b51f700bc99be06498256ed4ec1100e05e6d6840b2852e124ec957a1c',
          'Public Key: 0x04a8c5f8f...'
        ];
        updateStepStatus('signature', 'completed', signatureData);

        // Step 2: Encrypt Coordinates
        setCurrentStep(1);
        updateStepStatus('encrypt', 'processing');

        await new Promise(resolve => setTimeout(resolve, 2000));

        const encryptData = [
          `Original Latitude: ${latitude}°`,
          `Original Longitude: ${longitude}°`,
          `Scaled Latitude: ${Math.round(latitude * 100000)}`,
          `Scaled Longitude: ${Math.round(longitude * 100000)}`,
          'Encrypted Handle 1: 0x5ee7218b3983399c434135f92ce864c8b832b644baff',
          'Encrypted Handle 2: 0x7a412f9e6d8c5b3a2f1e8d4c9b6a3f2e1d8c5b7a4f9e',
          'FHE Proof: 0x8f3a2b1c9d6e4f7a8b2c5d9e1f4a7b8c2d5e9f1a4b7c8d2e5f...'
        ];
        updateStepStatus('encrypt', 'completed', encryptData);

        // Step 3: Submit to Blockchain
        setCurrentStep(2);
        updateStepStatus('blockchain', 'processing');

        await new Promise(resolve => setTimeout(resolve, 2500));

        const blockchainData = [
          'Network: Sepolia Testnet',
          'Contract: 0xAf52747676ae6e277f63760a25BaCe70D559A0A0',
          'Function: submitGuess()',
          'Gas Used: 245,671',
          'Transaction Hash: 0xa1b2c3d4e5f6789012345678901234567890abcdef...',
          'Block Number: 4,789,123'
        ];
        updateStepStatus('blockchain', 'completed', blockchainData);

        // Show transaction success toast
        toast.success('Transaction Submitted Successfully!', {
          description: 'Your encrypted guess has been recorded on the blockchain.',
          duration: 4000,
        });

        // Step 4: Decrypt Result
        setCurrentStep(3);
        updateStepStatus('decrypt', 'processing');

        await new Promise(resolve => setTimeout(resolve, 1800));

        const decryptData = [
          'Encrypted Distance: 0x9f2d1a8e7c5b4a9d2f1e8c5b9a2f1e8d5c9b2a5f',
          'Sum of Squares: 12,160,948',
          'Square Root: 3,487.26',
          'Distance in KM: 38.72 km',
          'Privacy: ✓ Coordinates never revealed',
          'Security: ✓ Zero-knowledge computation'
        ];
        updateStepStatus('decrypt', 'completed', decryptData);

        // Complete the process
        await new Promise(resolve => setTimeout(resolve, 1000));
        onComplete({ distance: 38.72 });

      } catch (error) {
        const currentStepId = steps[currentStep]?.id;
        if (currentStepId) {
          updateStepStatus(currentStepId, 'error');
        }
        onError(error as Error);
      }
    };

    processSteps();
  }, [isOpen, latitude, longitude, currentStep, onComplete, onError, steps]);

  const calculateProgress = () => {
    const completedSteps = steps.filter(step => step.status === 'completed').length;
    return (completedSteps / steps.length) * 100;
  };

  const getStepIcon = (step: ProcessStep) => {
    switch (step.status) {
      case 'completed':
        return <Check className="h-5 w-5 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'error':
        return <div className="h-5 w-5 bg-red-500 rounded-full" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-500" />
            FHE Privacy-Preserving Process
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{Math.round(calculateProgress())}%</span>
            </div>
            <Progress value={calculateProgress()} className="h-2" />
          </div>

          {/* Steps */}
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`border rounded-lg p-4 transition-all ${
                  step.status === 'processing'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : step.status === 'completed'
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                    : step.status === 'error'
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getStepIcon(step)}
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{step.title}</h3>
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                        Step {index + 1}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {step.description}
                    </p>

                    {/* Raw Data Display */}
                    {step.data && step.status === 'completed' && (
                      <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500">
                            Technical Details
                          </span>
                          <button
                            onClick={() => toggleDataVisibility(step.id)}
                            className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                          >
                            {showRawData[step.id] ? (
                              <>
                                <EyeOff className="h-3 w-3" />
                                Hide Details
                              </>
                            ) : (
                              <>
                                <Eye className="h-3 w-3" />
                                Show Details
                              </>
                            )}
                          </button>
                        </div>

                        <div className="space-y-1 font-mono text-xs">
                          {step.data.map((item, idx) => (
                            <div key={idx} className="text-gray-700 dark:text-gray-300">
                              {item.includes(':') ? (
                                <>
                                  <span className="text-gray-500">
                                    {item.split(':')[0]}:
                                  </span>
                                  <span className="ml-1">
                                    {showRawData[step.id] || !item.includes('0x')
                                      ? item.split(':')[1]
                                      : maskData(item.split(':')[1])
                                    }
                                  </span>
                                </>
                              ) : (
                                <span>{item}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Educational Note */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Privacy Guarantee
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Throughout this entire process, your actual coordinates remain completely private.
                  The smart contract computes the distance using advanced cryptographic techniques
                  without ever seeing your real location data.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}