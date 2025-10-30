import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // Get deployed contract
  const contractAddress = "0xAf52747676ae6e277f63760a25BaCe70D559A0A0"; // V3 contract
  const FHEGeoGuessr = await ethers.getContractAt("FHEGeoGuessr", contractAddress);

  console.log("Ending current round...");

  try {
    const currentRoundId = await FHEGeoGuessr.getCurrentRound();
    console.log("Current round ID:", currentRoundId.toString());

    if (currentRoundId === BigInt(0)) {
      console.log("❌ No active round to end");
      return;
    }

    // End the current round
    const tx = await FHEGeoGuessr.endRound(currentRoundId);
    console.log("✅ Transaction submitted:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
    console.log("🎯 Round", currentRoundId.toString(), "ended successfully!");

  } catch (error) {
    console.error("❌ Failed to end round:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });