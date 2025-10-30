import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("Deploying FHEGeoGuessr contract...");
  console.log("Deployer address:", deployer);

  const deployedFHEGeoGuessr = await deploy("FHEGeoGuessr", {
    from: deployer,
    log: true,
    waitConfirmations: 1,
  });

  console.log(`FHEGeoGuessr contract deployed at: ${deployedFHEGeoGuessr.address}`);
  console.log(`Transaction hash: ${deployedFHEGeoGuessr.transactionHash}`);

  // Verify the contract if we're on Sepolia
  if (hre.network.name === "sepolia") {
    console.log("Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: deployedFHEGeoGuessr.address,
        constructorArguments: [],
      });
      console.log("Contract verified successfully!");
    } catch (error) {
      console.log("Verification failed:", error);
    }
  }
};

export default func;
func.id = "deploy_fheGeoGuessr"; // id required to prevent reexecution
func.tags = ["FHEGeoGuessr"];