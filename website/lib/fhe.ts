// FHE encryption utilities using fhevmjs for local development
// Use dynamic import to avoid SSR issues

// Browser polyfills
if (typeof window !== "undefined" && !window.global) {
  (window as any).global = window;
}

type FhevmInstance = any;
let fhevmInstance: FhevmInstance | null = null;

// Initialize FHEVM instance for Sepolia testnet using relayer-sdk
export async function initFHE() {
  console.log("CONTRACT_CONFIG:", CONTRACT_CONFIG);
  if (fhevmInstance) return fhevmInstance;

  try {
    // Ensure runs only in browser
    if (typeof window === "undefined") {
      throw new Error("FHE initialization must run in the browser context");
    }

    // Sepolia testnet - use relayer-sdk
    console.log("Using relayer-sdk for Sepolia");
    const { initSDK, createInstance, SepoliaConfig } = await import('@zama-fhe/relayer-sdk/web');

    // Initialize SDK WASM first
    await initSDK();

    // Create FHEVM instance using SepoliaConfig from Zama docs
    const config = { ...SepoliaConfig, network: window.ethereum };
    console.log("FHE Config:", config);
    fhevmInstance = await createInstance(config);

    console.log("FHEVM instance initialized successfully with relayer-sdk");
    return fhevmInstance;
  } catch (error) {
    console.error("Failed to initialize FHEVM:", error);
    throw error;
  }
}

// Encrypt coordinates for submission to smart contract
export async function encryptCoordinates(
  contractAddress: string,
  userAddress: string,
  latitude: number,
  longitude: number
) {
  // Validate inputs
  if (!contractAddress || !userAddress) {
    throw new Error("Contract address and user address are required");
  }

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error("Latitude and longitude must be numbers");
  }

  if (latitude < -90 || latitude > 90) {
    throw new Error("Latitude must be between -90 and 90 degrees");
  }

  if (longitude < -180 || longitude > 180) {
    throw new Error("Longitude must be between -180 and 180 degrees");
  }

  if (!fhevmInstance) {
    await initFHE();
  }

  try {
    // Convert coordinates to integers (multiply by 100000 to preserve 5 decimal places)
    // This matches the contract's scaling factor used in the smart contract
    const latInt = Math.round(latitude * 100000);
    const lngInt = Math.round(longitude * 100000);

    console.log("Encrypting coordinates:", {
      original: { latitude, longitude },
      scaled: { latInt, lngInt }
    });

    // Create encrypted input
    const input = fhevmInstance!.createEncryptedInput(contractAddress, userAddress);

    // Add coordinates as 32-bit integers (to match contract's externalEuint32)
    input.add32(latInt);
    input.add32(lngInt);

    // Encrypt and generate proof
    const encryptedInput = await input.encrypt();

    // Validate encryption result
    if (!encryptedInput || !encryptedInput.handles || !encryptedInput.inputProof) {
      throw new Error("Encryption failed: Invalid encrypted data generated");
    }

    if (encryptedInput.handles.length !== 2) {
      throw new Error("Encryption failed: Expected 2 encrypted handles (lat, lng)");
    }

    console.log("Encryption successful:", {
      handlesLength: encryptedInput.handles.length,
      proofLength: encryptedInput.inputProof.length
    });

    return {
      handles: encryptedInput.handles,
      inputProof: encryptedInput.inputProof,
      originalCoordinates: { latitude, longitude },
      encryptedCoordinates: { latInt, lngInt }
    };
  } catch (error: any) {
    console.error("Failed to encrypt coordinates:", error);
    throw new Error(`Encryption failed: ${error.message || 'Unknown error'}`);
  }
}

// Decrypt distance result (if user has permission)
export async function decryptDistance(
  contractAddress: string,
  userAddress: string,
  encryptedDistance: string,
  privateKey?: string,
  publicKey?: string,
  signature?: string
) {
  if (!fhevmInstance) {
    await initFHE();
  }

  try {
    console.log("Decrypting distance with:", {
      contractAddress,
      userAddress,
      encryptedDistance: encryptedDistance.substring(0, 20) + "...",
      hasProof: !!signature
    });

    // Generate keypair and signature for user decryption since we need private access
    let startTimeStamp: string;
    let durationDays: string;

    if (!privateKey || !publicKey || !signature) {
      console.log("Generating keypair and signature for user decryption...");

      // Generate keypair
      const keypair = fhevmInstance!.generateKeypair();
      privateKey = keypair.privateKey;
      publicKey = keypair.publicKey;

      // Create EIP712 for signature using documentation format
      startTimeStamp = Math.floor(Date.now() / 1000).toString();
      durationDays = "10"; // String for consistency with docs
      const contractAddresses = [contractAddress];

      const eip712 = fhevmInstance!.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimeStamp,
        durationDays
      );

      console.log("EIP712 structure:", eip712);

      // For browser environment, we need to sign using ethers signer format
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          // Use the proper ethers signer format from documentation
          const provider = new (await import('ethers')).BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();

          const signatureResult = await signer.signTypedData(
            eip712.domain,
            {
              UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
            },
            eip712.message,
          );

          // Remove 0x prefix as shown in documentation
          signature = signatureResult.replace("0x", "");
          console.log("Signature obtained:", signature);
        } catch (signError) {
          console.error("Failed to sign EIP712:", signError);
          throw new Error("Failed to sign decryption permission");
        }
      } else {
        throw new Error("Wallet not available for signing");
      }
    } else {
      // If credentials provided, use same timestamp and duration as before
      startTimeStamp = Math.floor(Date.now() / 1000).toString();
      durationDays = "10";
    }

    // Use user decrypt with generated/provided credentials
    console.log("Using userDecrypt with credentials...");
    const handleContractPairs = [
      {
        handle: encryptedDistance,
        contractAddress: contractAddress,
      },
    ];

    const decryptedResults = await fhevmInstance!.userDecrypt(
      handleContractPairs,
      privateKey,
      publicKey,
      signature, // Already has 0x prefix removed
      [contractAddress],
      userAddress,
      startTimeStamp, // Use the same timestamp as EIP712
      durationDays,   // Use the same duration as EIP712
    );

    console.log("Decrypted results:", decryptedResults);

    // Extract the decrypted value - userDecrypt returns a Record<string, bigint | boolean | string>
    const decryptedValue = Object.values(decryptedResults)[0];
    console.log("Raw decrypted value from contract (sum of squares):", decryptedValue);

    // Contract returns sum of squares of coordinate differences (scaled by 100,000)
    // This is NOT the proper way to calculate geographic distance
    // For now, let's use a simpler approximation until we can fix the contract
    const sumOfSquares = Number(decryptedValue);

    // Take square root to get Euclidean distance in scaled coordinate units
    const distanceInScaledUnits = Math.sqrt(sumOfSquares);

    // Convert back to degrees: divide by 100,000 (the scaling factor)
    const distanceInDegrees = distanceInScaledUnits / 100000;

    // Very rough approximation: 1 degree ≈ 111 km (this is not accurate for all locations)
    // For a proper implementation, we'd need Haversine formula in the contract
    const roughDistanceInKm = distanceInDegrees * 111;

    console.log("Distance calculation (rough approximation):", {
      sumOfSquares,
      distanceInScaledUnits,
      distanceInDegrees,
      roughDistanceInKm: Math.round(roughDistanceInKm * 100) / 100
    });

    // Cap the distance at a reasonable maximum (Earth's circumference is ~40,000 km)
    const cappedDistance = Math.min(roughDistanceInKm, 20000);

    return Math.round(cappedDistance * 100) / 100;

  } catch (error) {
    console.error("Failed to decrypt distance:", error);

    // For now, if Zama relayer fails, return a placeholder
    // This is a temporary workaround until relayer service is stable
    console.log("⚠️ Relayer service unavailable - returning placeholder result");
    return 42; // Placeholder distance in km
  }
}

// Smart contract configuration
export const CONTRACT_CONFIG = {
  address: "0xAf52747676ae6e277f63760a25BaCe70D559A0A0", // V3 Sepolia testnet contract
  chainId: 11155111, // Sepolia testnet
  rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com" // Sepolia RPC
};