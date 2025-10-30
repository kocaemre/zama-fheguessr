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

  const player = "0x2787b58E6c7c9e0C824f2187BA99a2076B23491c";
  const roundId = 1;

  console.log(`Requesting distances for all guesses of player ${player} in round ${roundId}`);

  // Request distance for each guess index
  for (let guessIndex = 0; guessIndex < 4; guessIndex++) {
    console.log(`\nRequesting distance for guess index ${guessIndex}...`);

    try {
      const tx = await FHEGeoGuessr.requestPlayerDistance(roundId, player, guessIndex);
      console.log(`✅ Request sent! TX: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ Transaction confirmed`);

      // Check if pending
      const isPending = await FHEGeoGuessr.isDistancePending(roundId, player);
      console.log(`Is distance pending: ${isPending}`);

    } catch (error) {
      console.error(`❌ Failed to request distance for guess ${guessIndex}:`, error);
    }
  }

  console.log("\n🎯 All distance requests sent! Checking status...");

  // Check final status
  const isPending = await FHEGeoGuessr.isDistancePending(roundId, player);
  console.log(`Final pending status: ${isPending}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });