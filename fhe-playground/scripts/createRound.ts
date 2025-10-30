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
  const contractAddress = "0xAf52747676ae6e277f63760a25BaCe70D559A0A0"; // V3 contract
  const FHEGeoGuessr = await ethers.getContractAt("FHEGeoGuessr", contractAddress);

  console.log("Creating new round...");

  // Admin page Germany coordinates (exact from admin page)
  const latitude = 49.011202;
  const longitude = 8.404121;
  const panoramaUrl = "https://www.mapillary.com/embed?map_style=Mapillary%20light&image_key=667448292761911&x=0.4434276458632255&y=0.5141403693415442&style=photo";

  try {
    // Encrypt coordinates first
    console.log("Encrypting coordinates...");

    // Scale coordinates by 100,000 to match contract
    const latInt = Math.round(latitude * 100000);
    const lngInt = Math.round(longitude * 100000);

    console.log("Scaled coordinates:", { latInt, lngInt });

    // Use fhevm.createEncryptedInput for Sepolia network
    const contractInstance = await hre.fhevm.createEncryptedInput(contractAddress, deployer.address);
    contractInstance.add32(latInt);
    contractInstance.add32(lngInt);
    const encryptedInput = await contractInstance.encrypt();

    console.log("Encrypted coordinates generated");

    // Create round with encrypted coordinates
    const tx = await FHEGeoGuessr.createRound(
      panoramaUrl,
      encryptedInput.handles[0],
      encryptedInput.handles[1],
      encryptedInput.inputProof
    );

    console.log("✅ Transaction submitted:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

    // Check the new round (skip if there's an error)
    try {
      const currentRoundId = await FHEGeoGuessr.getCurrentRound();
      console.log("🎯 New round created! ID:", currentRoundId.toString());
    } catch (error) {
      console.log("🎯 Round created successfully, but couldn't fetch current round ID");
    }

  } catch (error) {
    console.error("❌ Failed to create round:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });