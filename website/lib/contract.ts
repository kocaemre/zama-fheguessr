// Smart contract interaction utilities
import { ethers } from "ethers";
import contractABI from "./FHEGeoGuessr.abi.json";
import { CONTRACT_CONFIG, encryptCoordinates, decryptDistance, initFHE } from "./fhe";

export class FHEGeoGuessrContract {
  private contract: ethers.Contract;
  private provider: ethers.Provider;
  private signer?: ethers.Signer;

  constructor(providerOrSigner: ethers.Provider | ethers.Signer) {
    if ('sendTransaction' in providerOrSigner) {
      this.signer = providerOrSigner as ethers.Signer;
      this.provider = (providerOrSigner as ethers.Signer).provider!;
    } else {
      this.provider = providerOrSigner as ethers.Provider;
    }

    this.contract = new ethers.Contract(
      CONTRACT_CONFIG.address,
      contractABI,
      this.signer || this.provider
    );
  }

  // Get current round information
  async getCurrentRound() {
    try {
      // Use a reliable RPC provider
      const provider = new ethers.JsonRpcProvider(CONTRACT_CONFIG.rpcUrl);
      const readOnlyContract = new ethers.Contract(
        CONTRACT_CONFIG.address,
        contractABI,
        provider
      );

      const currentRoundId = await readOnlyContract.getCurrentRound();

      if (currentRoundId === BigInt(0) || Number(currentRoundId) === 0) {
        return null; // No active rounds
      }

      const round = await readOnlyContract.getRound(currentRoundId);

      return {
        id: Number(currentRoundId),
        panoramaUrl: round.panoramaUrl,
        startTime: Number(round.startTime),
        endTime: Number(round.endTime),
        isActive: round.isActive,
        creator: round.creator
      };
    } catch (error) {
      console.error("Failed to get current round:", error);
      // Return null instead of throwing to prevent app crashes
      return null;
    }
  }

  // Create a new round with encrypted coordinates
  async createRound(panoramaUrl: string, latitude: number, longitude: number, userAddress: string) {
    if (!this.signer) {
      throw new Error("Signer required to create round");
    }

    try {
      console.log("Creating new round with encrypted coordinates...");

      // Encrypt coordinates
      const encrypted = await encryptCoordinates(
        CONTRACT_CONFIG.address,
        userAddress,
        latitude,
        longitude
      );

      console.log("Submitting new round to contract:", {
        panoramaUrl,
        handles: encrypted.handles,
        proof: encrypted.inputProof
      });

      // Submit to smart contract
      const tx = await this.contract.createRound(
        panoramaUrl,               // panorama URL
        encrypted.handles[0],      // encrypted latitude
        encrypted.handles[1],      // encrypted longitude
        encrypted.inputProof       // proof
      );

      console.log("Transaction submitted:", tx.hash);

      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);

      // Extract round ID from events
      const roundCreatedEvent = receipt.logs.find((log: any) =>
        log.topics[0] === this.contract.interface.getEvent('RoundCreated').topicHash
      );

      let roundId = null;
      if (roundCreatedEvent) {
        const parsedLog = this.contract.interface.parseLog(roundCreatedEvent);
        roundId = Number(parsedLog.args.roundId);
      }

      return {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        roundId: roundId,
        encrypted: encrypted
      };
    } catch (error) {
      console.error("Failed to create round:", error);
      throw error;
    }
  }

  // Submit encrypted guess for current round and decrypt distance immediately
  async submitGuess(latitude: number, longitude: number, userAddress: string) {
    if (!this.signer) {
      throw new Error("Signer required to submit guess");
    }

    try {
      // Get current round ID
      const currentRound = await this.getCurrentRound();
      if (!currentRound) {
        throw new Error("No active round found");
      }

      // Encrypt coordinates
      const encrypted = await encryptCoordinates(
        CONTRACT_CONFIG.address,
        userAddress,
        latitude,
        longitude
      );

      console.log("Submitting encrypted guess:", {
        roundId: currentRound.id,
        handles: encrypted.handles,
        proof: encrypted.inputProof
      });

      // Submit to smart contract with roundId and capture encrypted distance
      const tx = await this.contract.submitGuess(
        currentRound.id,          // roundId
        encrypted.handles[0],     // encrypted latitude
        encrypted.handles[1],     // encrypted longitude
        encrypted.inputProof      // proof
      );

      console.log("Transaction submitted:", tx.hash);

      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);

      // Extract encrypted distance from transaction result
      let encryptedDistance = null;
      try {
        // The return value is in the transaction result
        const returnData = await this.contract.submitGuess.staticCall(
          currentRound.id,
          encrypted.handles[0],
          encrypted.handles[1],
          encrypted.inputProof
        );
        encryptedDistance = returnData;
        console.log("Encrypted distance received:", encryptedDistance);
      } catch (staticError) {
        console.error("Failed to get encrypted distance from static call:", staticError);
      }

      return {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        roundId: currentRound.id,
        encrypted: encrypted,
        encryptedDistance: encryptedDistance
      };
    } catch (error) {
      console.error("Failed to submit guess:", error);
      throw error;
    }
  }

  // Request distance calculation for a player
  async requestPlayerDistance(roundId: number, playerAddress: string, guessIndex: number = 0) {
    if (!this.signer) {
      throw new Error("Signer required to request distance");
    }

    try {
      const tx = await this.contract.requestPlayerDistance(roundId, playerAddress, guessIndex);
      const receipt = await tx.wait();

      return {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        requestId: receipt.events?.[0]?.args?.requestId
      };
    } catch (error) {
      console.error("Failed to request distance:", error);
      throw error;
    }
  }

  // Get player's round data
  async getPlayerRoundData(roundId: number, playerAddress: string) {
    try {
      const provider = new ethers.JsonRpcProvider(CONTRACT_CONFIG.rpcUrl);
      const readOnlyContract = new ethers.Contract(
        CONTRACT_CONFIG.address,
        contractABI,
        provider
      );

      const [hasGuessed, guessCount] = await Promise.all([
        readOnlyContract.hasPlayerGuessed(roundId, playerAddress),
        readOnlyContract.getPlayerGuessCount(roundId, playerAddress)
      ]);

      return {
        hasGuessed,
        guessCount: Number(guessCount)
      };
    } catch (error) {
      console.error("Failed to get player round data:", error);
      // Return default values instead of throwing
      return {
        hasGuessed: false,
        guessCount: 0
      };
    }
  }


  // Listen for round events
  onRoundCreated(callback: (roundId: number, data: any) => void) {
    this.contract.on("RoundCreated", (roundId, panoramaUrl, startTime, endTime) => {
      callback(Number(roundId), {
        panoramaUrl,
        startTime: Number(startTime),
        endTime: Number(endTime)
      });
    });
  }

  onGuessSubmitted(callback: (roundId: number, player: string) => void) {
    this.contract.on("GuessSubmitted", (roundId, player) => {
      callback(Number(roundId), player);
    });
  }

  onDistancesRevealed(callback: (roundId: number) => void) {
    this.contract.on("DistancesRevealed", (roundId) => {
      callback(Number(roundId));
    });
  }

  // Get player's guesses for a round
  async getPlayerGuesses(roundId: number, playerAddress: string) {
    try {
      const provider = new ethers.JsonRpcProvider(CONTRACT_CONFIG.rpcUrl);
      const readOnlyContract = new ethers.Contract(
        CONTRACT_CONFIG.address,
        contractABI,
        provider
      );

      const { distances, timestamps, revealed } = await readOnlyContract.getPlayerGuesses(roundId, playerAddress);

      return distances.map((distance: any, index: number) => ({
        distance: Number(distance),
        timestamp: Number(timestamps[index]),
        revealed: revealed[index],
        index
      }));
    } catch (error) {
      console.error("Failed to get player guesses:", error);
      return [];
    }
  }

  // Get player's rank in round
  async getPlayerRank(roundId: number, playerAddress: string) {
    try {
      const provider = new ethers.JsonRpcProvider(CONTRACT_CONFIG.rpcUrl);
      const readOnlyContract = new ethers.Contract(
        CONTRACT_CONFIG.address,
        contractABI,
        provider
      );

      const rank = await readOnlyContract.getPlayerRank(roundId, playerAddress);
      return Number(rank);
    } catch (error) {
      console.error("Failed to get player rank:", error);
      return 0;
    }
  }

  // Check if distance calculation is pending
  async isDistancePending(roundId: number, playerAddress: string) {
    try {
      const provider = new ethers.JsonRpcProvider(CONTRACT_CONFIG.rpcUrl);
      const readOnlyContract = new ethers.Contract(
        CONTRACT_CONFIG.address,
        contractABI,
        provider
      );

      return await readOnlyContract.isDistancePending(roundId, playerAddress);
    } catch (error) {
      console.error("Failed to check distance pending:", error);
      return false;
    }
  }

  // Decrypt distance from encrypted bytes32
  async decryptDistance(encryptedDistance: string, userAddress: string) {
    try {
      console.log("Decrypting distance:", { encryptedDistance, userAddress });

      // Use the FHE decryption function
      const distance = await decryptDistance(
        CONTRACT_CONFIG.address,
        userAddress,
        encryptedDistance
      );

      console.log("Decrypted distance:", distance);
      return distance;
    } catch (error) {
      console.error("Failed to decrypt distance:", error);
      throw error;
    }
  }

  // Clean up event listeners
  removeAllListeners() {
    this.contract.removeAllListeners();
  }
}

// Helper to get provider
export function getProvider() {
  return new ethers.JsonRpcProvider(CONTRACT_CONFIG.rpcUrl);
}

// Helper to get signer from wallet
export async function getSigner(wallet: any) {
  const provider = new ethers.BrowserProvider(wallet);
  return await provider.getSigner();
}