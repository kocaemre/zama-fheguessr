import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // Get deployed contract
  const contractAddress = "0x6e3AB6f2cbEFAa97080C94AA632E0419eF6d0578";
  const FHEGeoGuessr = await ethers.getContractAt("FHEGeoGuessr", contractAddress);

  const player = "0x2787b58E6c7c9e0C824f2187BA99a2076B23491c";
  const roundId = 1;

  console.log(`Checking guesses for player ${player} in round ${roundId}`);

  try {
    const guesses = await FHEGeoGuessr.getPlayerGuesses(roundId, player);
    console.log("Raw guesses result:", guesses);

    const [distances, timestamps, revealed] = guesses;
    console.log("\nParsed results:");
    console.log("Distances:", distances.map(d => d.toString()));
    console.log("Timestamps:", timestamps.map(t => t.toString()));
    console.log("Revealed:", revealed);

    // Check guess count
    const guessCount = await FHEGeoGuessr.getPlayerGuessCount(roundId, player);
    console.log("\nGuess count:", guessCount.toString());

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