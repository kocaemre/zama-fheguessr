import { ethers } from "ethers";

async function main() {
  // Contract ABI - only createRound function
  const ABI = [
    "function createRound(string panoramaUrl, bytes32 encryptedLat, bytes32 encryptedLon, bytes inputProof) returns (uint256)"
  ];

  // Sepolia network
  const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");

  // Private key from environment
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || "";
  if (!privateKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY environment variable not set");
  }

  const wallet = new ethers.Wallet(privateKey, provider);

  // Contract address
  const contractAddress = "0xDd60f7829130Af0Ac2b003a196CEeF5D7c7a3BA1";
  const contract = new ethers.Contract(contractAddress, ABI, wallet);

  // German coordinates from admin page
  const latitude = 49.011202;
  const longitude = 8.404121;
  const panoramaUrl = "https://www.mapillary.com/embed?map_style=Mapillary%20light&image_key=667448292761911&x=0.4434276458632255&y=0.5141403693415442&style=photo";

  // Scale coordinates
  const latInt = Math.round(latitude * 100000);
  const lngInt = Math.round(longitude * 100000);

  console.log("Creating round with German coordinates:");
  console.log("Original:", { latitude, longitude });
  console.log("Scaled:", { latInt, lngInt });
  console.log("Panorama URL:", panoramaUrl);

  // Mock encrypted values (32 bytes each)
  const mockEncryptedLat = ethers.zeroPadBytes(ethers.toBeHex(latInt), 32);
  const mockEncryptedLng = ethers.zeroPadBytes(ethers.toBeHex(lngInt), 32);
  const mockProof = "0x";

  console.log("\nDeploying to contract:", contractAddress);
  console.log("From account:", wallet.address);

  try {
    const tx = await contract.createRound(
      panoramaUrl,
      mockEncryptedLat,
      mockEncryptedLng,
      mockProof
    );

    console.log("Transaction sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Round created successfully!");
    console.log("Block number:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());

    // Get round ID from events if available
    console.log("Transaction receipt logs:", receipt.logs.length);

  } catch (error: any) {
    console.error("❌ Failed to create round:", error.message);
    if (error.code) {
      console.error("Error code:", error.code);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });