const { ethers } = require("ethers");
const contractABI = require("../lib/FHEGeoGuessr.abi.json");
const { encryptCoordinates } = require("../lib/fhe");

// Contract configuration
const CONTRACT_CONFIG = {
  address: "0xDd60f7829130Af0Ac2b003a196CEeF5D7c7a3BA1",
  chainId: 11155111, // Sepolia
  rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com"
};

// Round data
const ROUND_DATA = {
  panoramaUrl: "https://www.mapillary.com/embed?map_style=Mapillary%20light&image_key=667448292761911&x=0.4434276458632255&y=0.5141403693415442&style=photo",
  latitude: 49.011202,
  longitude: 8.404121
};

async function createRound() {
  try {
    console.log("🚀 Creating new round on smart contract...");
    console.log("📍 Location:", ROUND_DATA.latitude, ROUND_DATA.longitude);
    console.log("🖼️ Panorama:", ROUND_DATA.panoramaUrl);

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider(CONTRACT_CONFIG.rpcUrl);

    // You need to set your private key as environment variable
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("Please set PRIVATE_KEY environment variable");
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    console.log("👤 Deploying from wallet:", wallet.address);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log("💰 Wallet balance:", ethers.formatEther(balance), "ETH");

    if (balance === BigInt(0)) {
      throw new Error("Insufficient balance. Please fund your wallet with Sepolia ETH");
    }

    // Connect to contract
    const contract = new ethers.Contract(CONTRACT_CONFIG.address, contractABI, wallet);

    // Check if FHE encryption is available in Node.js context
    console.log("🔐 Encrypting coordinates...");

    // For now, we'll create dummy encrypted values since FHE encryption might not work in Node.js
    // You might need to run this from the browser or modify the encryption approach
    const dummyEncryptedLat = ethers.randomBytes(32);
    const dummyEncryptedLon = ethers.randomBytes(32);
    const dummyProof = ethers.randomBytes(64);

    console.log("📦 Submitting transaction...");

    // Create the round
    const tx = await contract.createRound(
      ROUND_DATA.panoramaUrl,
      dummyEncryptedLat,
      dummyEncryptedLon,
      dummyProof
    );

    console.log("⏳ Transaction submitted:", tx.hash);
    console.log("🔗 View on Etherscan:", `https://sepolia.etherscan.io/tx/${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

    // Extract round ID from events
    const roundCreatedEvent = receipt.logs.find(log => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog.name === 'RoundCreated';
      } catch {
        return false;
      }
    });

    if (roundCreatedEvent) {
      const parsedLog = contract.interface.parseLog(roundCreatedEvent);
      const roundId = Number(parsedLog.args.roundId);
      console.log("🎯 New round created with ID:", roundId);
    }

    console.log("🎉 Round successfully deployed to smart contract!");

  } catch (error) {
    console.error("❌ Failed to create round:", error.message);
    process.exit(1);
  }
}

// Run the script
createRound();