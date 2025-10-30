import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Checking round status with account:", deployer.address);

  // Get deployed contract
  const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // Local contract
  const FHEGeoGuessr = await ethers.getContractAt("FHEGeoGuessr", contractAddress);

  try {
    const currentRoundId = await FHEGeoGuessr.currentRoundId();
    console.log("Current round ID from contract:", currentRoundId.toString());

    if (currentRoundId > 0) {
      const round = await FHEGeoGuessr.rounds(currentRoundId);
      console.log("Round details:");
      console.log("  ID:", round.id.toString());
      console.log("  Start time:", new Date(Number(round.startTime) * 1000));
      console.log("  End time:", new Date(Number(round.endTime) * 1000));
      console.log("  Current time:", new Date());
      console.log("  Is active:", round.isActive);
      console.log("  Is revealed:", round.isRevealed);
      console.log("  Creator:", round.creator);
      console.log("  Panorama URL:", round.panoramaUrl);

      const now = Math.floor(Date.now() / 1000);
      console.log("Time comparison:");
      console.log("  Current timestamp:", now);
      console.log("  Start timestamp:", Number(round.startTime));
      console.log("  End timestamp:", Number(round.endTime));
      console.log("  Time left:", Number(round.endTime) - now, "seconds");
    }
  } catch (error) {
    console.error("Error checking round:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });