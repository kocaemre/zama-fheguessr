import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  // Initialize FHE for Sepolia
  try {
    await hre.fhevm.initializeCLIApi();
    console.log("FHE initialized for Sepolia");
  } catch (error: any) {
    console.log("FHE initialization error:", error.message);
    throw error; // Stop if FHE fails
  }

  const [deployer] = await ethers.getSigners();

  console.log("Creating test round with account:", deployer.address);

  // Get deployed contract
  const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const FHEGeoGuessr = await ethers.getContractAt("FHEGeoGuessr", contractAddress);

  // Coordinates from user: Germany location
  const latitude = 49.011202;
  const longitude = 8.404121;

  // Scale coordinates (multiply by 100,000)
  const latInt = Math.round(latitude * 100000);
  const lngInt = Math.round(longitude * 100000);

  console.log("Scaled coordinates:", { latInt, lngInt });
  console.log("Original coordinates:", { latitude, longitude });

  // Create FHE encrypted input for coordinates
  const encryptedInput = await hre.fhevm
    .createEncryptedInput(contractAddress, deployer.address)
    .add32(latInt)  // encrypted latitude
    .add32(lngInt)  // encrypted longitude
    .encrypt();

  console.log("FHE encryption completed:", {
    handlesLength: encryptedInput.handles.length,
    proofLength: encryptedInput.inputProof.length
  });

  const panoramaUrl = "https://www.mapillary.com/embed?map_style=Mapillary%20light&image_key=667448292761911&x=0.4434276458632255&y=0.5141403693415442&style=photo";

  console.log("Creating round...");

  try {
    const tx = await FHEGeoGuessr.createRound(
      panoramaUrl,
      encryptedInput.handles[0],  // encrypted latitude
      encryptedInput.handles[1],  // encrypted longitude
      encryptedInput.inputProof   // FHE proof
    );

    await tx.wait();
    console.log("Round created successfully!");
    console.log("Transaction hash:", tx.hash);

    // Get current round info
    const currentRound = await FHEGeoGuessr.getCurrentRound();
    console.log("Current round ID:", currentRound.toString());

  } catch (error) {
    console.error("Failed to create round:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });