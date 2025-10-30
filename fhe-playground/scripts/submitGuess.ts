import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  // Initialize FHE
  try {
    await hre.fhevm.initializeCLIApi();
    console.log("FHE initialized");
  } catch (error: any) {
    console.log("FHE initialization error:", error.message);
    throw error;
  }

  const [deployer] = await ethers.getSigners();
  console.log("Submitting guess with account:", deployer.address);

  // Get deployed contract
  const contractAddress = "0x3FD97bdF2B3BBC4ae46Fabf8c2819ed90C686710"; // Updated Sepolia contract
  const FHEGeoGuessr = await ethers.getContractAt("FHEGeoGuessr", contractAddress);

  // Test coordinates: Paris, France (should be about 500km from Germany location)
  const guessLatitude = 48.8566;   // Paris latitude
  const guessLongitude = 2.3522;   // Paris longitude

  // Actual coordinates from admin page (Germany)
  const actualLatitude = 49.011202;
  const actualLongitude = 8.404121;

  // Manual distance calculation using Haversine formula
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
  }

  const expectedDistance = calculateDistance(actualLatitude, actualLongitude, guessLatitude, guessLongitude);
  console.log("Manual calculation:");
  console.log("Actual (Germany):", { actualLatitude, actualLongitude });
  console.log("Guess (Paris):", { guessLatitude, guessLongitude });
  console.log("Expected distance:", expectedDistance.toFixed(2), "km");

  // Scale coordinates (multiply by 100,000)
  const guessLatInt = Math.round(guessLatitude * 100000);
  const guessLngInt = Math.round(guessLongitude * 100000);

  console.log("Scaled guess coordinates:", { guessLatInt, guessLngInt });

  // Create FHE encrypted input for guess coordinates
  const encryptedInput = await hre.fhevm
    .createEncryptedInput(contractAddress, deployer.address)
    .add32(guessLatInt)  // encrypted guess latitude
    .add32(guessLngInt)  // encrypted guess longitude
    .encrypt();

  console.log("FHE encryption completed:", {
    handlesLength: encryptedInput.handles.length,
    proofLength: encryptedInput.inputProof.length
  });

  console.log("Submitting guess...");

  try {
    // Use round ID 1 (latest round we created with new contract)
    const currentRoundId = 1;
    console.log("Using round ID:", currentRoundId);

    const tx = await FHEGeoGuessr.submitGuess(
      currentRoundId,
      encryptedInput.handles[0],  // encrypted guess latitude
      encryptedInput.handles[1],  // encrypted guess longitude
      encryptedInput.inputProof   // FHE proof
    );

    await tx.wait();
    console.log("Guess submitted successfully!");
    console.log("Transaction hash:", tx.hash);

    // Try to get the calculated distance (this might be encrypted)
    try {
      const guesses = await FHEGeoGuessr.getPlayerGuesses(deployer.address, currentRoundId);
      console.log("Player guesses count:", guesses.length);

      if (guesses.length > 0) {
        const latestGuess = guesses[guesses.length - 1];
        console.log("Latest guess data:");
        console.log("  Player:", latestGuess.player);
        console.log("  Distance (encrypted):", latestGuess.distance);
        console.log("  Score:", latestGuess.score.toString());

        // Try to decrypt the distance if possible
        try {
          const decryptedDistance = await hre.fhevm.userDecryptEuint32(
            latestGuess.distance,
            contractAddress,
            deployer
          );
          console.log("Contract calculated distance:", Number(decryptedDistance) / 1000, "km");
          console.log("Manual calculation:", expectedDistance.toFixed(2), "km");
          console.log("Difference:", Math.abs(Number(decryptedDistance) / 1000 - expectedDistance).toFixed(2), "km");
        } catch (decryptError) {
          console.log("Could not decrypt distance (might need different method)");
        }
      }
    } catch (error) {
      console.log("Could not retrieve guess data:", error);
    }

  } catch (error) {
    console.error("Failed to submit guess:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });