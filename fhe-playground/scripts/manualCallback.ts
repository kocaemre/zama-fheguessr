import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  // Initialize FHE for Sepolia
  try {
    await hre.fhevm.initializeCLIApi();
    console.log("FHE initialized for Sepolia");
  } catch (error: any) {
    console.log("FHE initialization error:", error.message);
  }

  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // Get deployed contract
  const contractAddress = "0x6e3AB6f2cbEFAa97080C94AA632E0419eF6d0578";
  const FHEGeoGuessr = await ethers.getContractAt("FHEGeoGuessr", contractAddress);

  // Check current round
  const currentRound = await FHEGeoGuessr.getCurrentRound();
  console.log("Current round ID:", currentRound.toString());

  if (currentRound === BigInt(0)) {
    console.log("No active round found");
    return;
  }

  // Get round players
  const players = await FHEGeoGuessr.getRoundPlayers(currentRound);
  console.log("Players in current round:", players);

  if (players.length === 0) {
    console.log("No players in current round");
    return;
  }

  // Check each player for pending requests
  for (const player of players) {
    console.log(`\nChecking player: ${player}`);

    const hasGuessed = await FHEGeoGuessr.hasPlayerGuessed(currentRound, player);
    console.log(`Has guessed: ${hasGuessed}`);

    if (hasGuessed) {
      const isPending = await FHEGeoGuessr.isDistancePending(currentRound, player);
      console.log(`Distance pending: ${isPending}`);

      if (isPending) {
        console.log("Found pending distance request!");

        // Try to manually trigger callback with mock distance
        const mockDistance = 12345; // Mock sum of squares
        const requestId = await FHEGeoGuessr.decryptionRequests(currentRound, player);
        console.log(`Request ID: ${requestId}`);

        try {
          console.log("Attempting manual callback...");
          const tx = await FHEGeoGuessr.callbackPlayerDistance(
            requestId,
            mockDistance,
            [] // Empty signatures for now
          );
          await tx.wait();
          console.log("✅ Manual callback successful!");
          console.log("Transaction hash:", tx.hash);
        } catch (error) {
          console.error("❌ Manual callback failed:", error);
        }
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });