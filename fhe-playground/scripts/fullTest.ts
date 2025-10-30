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
  console.log("Testing with account:", deployer.address);

  // Get deployed contract
  const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // Local contract
  const FHEGeoGuessr = await ethers.getContractAt("FHEGeoGuessr", contractAddress);

  console.log("\n=== STEP 1: Create Round ===");

  // Admin page coordinates: Germany location
  const actualLatitude = 49.011202;
  const actualLongitude = 8.404121;

  // Scale coordinates (multiply by 100,000)
  const latInt = Math.round(actualLatitude * 100000);
  const lngInt = Math.round(actualLongitude * 100000);

  console.log("Creating round with Germany coordinates:");
  console.log("Original:", { actualLatitude, actualLongitude });
  console.log("Scaled:", { latInt, lngInt });

  // Create FHE encrypted input for actual coordinates
  const roundInput = await hre.fhevm
    .createEncryptedInput(contractAddress, deployer.address)
    .add32(latInt)
    .add32(lngInt)
    .encrypt();

  const panoramaUrl = "https://www.mapillary.com/embed?map_style=Mapillary%20light&image_key=667448292761911&x=0.4434276458632255&y=0.5141403693415442&style=photo";

  try {
    const createTx = await FHEGeoGuessr.createRound(
      panoramaUrl,
      roundInput.handles[0],
      roundInput.handles[1],
      roundInput.inputProof
    );

    await createTx.wait();
    console.log("✅ Round created successfully!");
    console.log("Transaction hash:", createTx.hash);

    const currentRoundId = await FHEGeoGuessr.currentRoundId();
    console.log("Current round ID:", currentRoundId.toString());

    console.log("\n=== STEP 2: Submit Guess ===");

    // Test coordinates: Paris, France (should be about 442km from Germany)
    const guessLatitude = 48.8566;
    const guessLongitude = 2.3522;

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

    // Scale guess coordinates
    const guessLatInt = Math.round(guessLatitude * 100000);
    const guessLngInt = Math.round(guessLongitude * 100000);

    console.log("Scaled guess coordinates:", { guessLatInt, guessLngInt });

    // Create FHE encrypted input for guess coordinates
    const guessInput = await hre.fhevm
      .createEncryptedInput(contractAddress, deployer.address)
      .add32(guessLatInt)
      .add32(guessLngInt)
      .encrypt();

    console.log("Submitting guess...");

    const guessTx = await FHEGeoGuessr.submitGuess(
      currentRoundId,
      guessInput.handles[0],
      guessInput.handles[1],
      guessInput.inputProof
    );

    await guessTx.wait();
    console.log("✅ Guess submitted successfully!");
    console.log("Transaction hash:", guessTx.hash);

    console.log("\n=== STEP 3: Check Results ===");

    // Try to get the guess data
    try {
      const guesses = await FHEGeoGuessr.getPlayerGuesses(deployer.address, currentRoundId);
      console.log("Player guesses count:", guesses.length);

      if (guesses.length > 0) {
        const latestGuess = guesses[guesses.length - 1];
        console.log("Latest guess data:");
        console.log("  Player:", latestGuess.player);
        console.log("  Distance (encrypted):", latestGuess.distance);
        console.log("  Score:", latestGuess.score.toString());

        // Wait for round to end and reveal distances
        console.log("\nWaiting for round to end (2 minutes)...");
        console.log("You can manually call revealDistances after round ends");

        console.log("\n=== SUMMARY ===");
        console.log("✅ Round created with FHE encryption");
        console.log("✅ Guess submitted with FHE encryption");
        console.log("📍 Manual calculation: Germany ↔ Paris =", expectedDistance.toFixed(2), "km");
        console.log("🔐 Contract has encrypted distance (can be revealed after round ends)");
        console.log("🎯 Test completed successfully!");
      }
    } catch (error) {
      console.log("Could not retrieve guess data:", error);
    }

  } catch (error) {
    console.error("Failed during test:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });