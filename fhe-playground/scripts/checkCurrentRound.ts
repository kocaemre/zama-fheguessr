import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // Get deployed contract
  const contractAddress = "0xAf52747676ae6e277f63760a25BaCe70D559A0A0"; // V3 contract
  const FHEGeoGuessr = await ethers.getContractAt("FHEGeoGuessr", contractAddress);

  console.log("Checking contract status...");

  try {
    const currentRoundId = await FHEGeoGuessr.getCurrentRound();
    console.log("Current round ID:", currentRoundId.toString());

    if (currentRoundId === BigInt(0)) {
      console.log("❌ No active round found");
    } else {
      const round = await FHEGeoGuessr.getRound(currentRoundId);
      console.log("✅ Active round found:", {
        id: currentRoundId.toString(),
        panoramaUrl: round.panoramaUrl,
        isActive: round.isActive,
        creator: round.creator
      });
    }

    const owner = await FHEGeoGuessr.owner();
    console.log("Contract owner:", owner);

  } catch (error) {
    console.error("Error:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });