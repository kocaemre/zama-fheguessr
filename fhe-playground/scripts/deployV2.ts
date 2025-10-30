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

  console.log("Deploying FHEGeoGuessr V2 with account:", deployer.address);

  // Deploy the contract
  console.log("Deploying contract...");
  const FHEGeoGuessr = await ethers.getContractFactory("FHEGeoGuessr");
  const contract = await FHEGeoGuessr.deploy();

  console.log("Waiting for deployment...");
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("✅ FHEGeoGuessr V2 deployed to:", contractAddress);

  // Verify the deployment
  console.log("Verifying deployment...");
  const owner = await contract.owner();
  console.log("Contract owner:", owner);

  const currentRound = await contract.getCurrentRound();
  console.log("Current round:", currentRound.toString());

  console.log("\n🎯 Contract deployed successfully!");
  console.log("📝 Update frontend CONTRACT_CONFIG.address to:", contractAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });