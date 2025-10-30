import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { FHEGeoGuessr, FHEGeoGuessr__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHEGeoGuessr")) as FHEGeoGuessr__factory;
  const fheGeoGuessrContract = (await factory.deploy()) as FHEGeoGuessr;
  const fheGeoGuessrContractAddress = await fheGeoGuessrContract.getAddress();

  return { fheGeoGuessrContract, fheGeoGuessrContractAddress };
}

describe("FHEGeoGuessr", function () {
  let signers: Signers;
  let fheGeoGuessrContract: FHEGeoGuessr;
  let fheGeoGuessrContractAddress: string;

  // Test coordinates (scaled by 100,000, using positive values only for mock testing)
  // We'll use a coordinate system where longitude is offset by 180° to make all values positive
  // New York City: 40.7128° N, 74.0060° W → 40.7128° N, 105.9940° E (180 - 74.0060)
  const NYC_LAT = 4071280; // 40.7128 * 100,000
  const NYC_LON = 10599400; // (180 - 74.0060) * 100,000

  // Los Angeles: 34.0522° N, 118.2437° W → 34.0522° N, 61.7563° E
  const LA_LAT = 3405220; // 34.0522 * 100,000
  const LA_LON = 6175630; // (180 - 118.2437) * 100,000

  // London: 51.5074° N, 0.1278° W → 51.5074° N, 179.8722° E
  const LONDON_LAT = 5150740; // 51.5074 * 100,000
  const LONDON_LON = 17987220; // (180 - 0.1278) * 100,000

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
      charlie: ethSigners[3]
    };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ fheGeoGuessrContract, fheGeoGuessrContractAddress } = await deployFixture());
  });

  describe("Contract Deployment", function () {
    it("should deploy with initial state", async function () {
      expect(await fheGeoGuessrContract.currentRoundId()).to.equal(0);
      expect(await fheGeoGuessrContract.roundDuration()).to.equal(120); // 2 minutes
      expect(await fheGeoGuessrContract.getCurrentRound()).to.equal(0);
    });
  });

  describe("Round Creation", function () {
    it("should create a new round with encrypted coordinates", async function () {
      const panoramaUrl = "https://example.com/panorama1.jpg";

      // Encrypt the NYC coordinates
      const encryptedCoords = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.alice.address)
        .add32(NYC_LAT)
        .add32(NYC_LON)
        .encrypt();

      const tx = await fheGeoGuessrContract
        .connect(signers.alice)
        .createRound(
          panoramaUrl,
          encryptedCoords.handles[0], // latitude
          encryptedCoords.handles[1], // longitude
          encryptedCoords.inputProof
        );

      const receipt = await tx.wait();
      const roundCreatedEvent = receipt?.logs.find(log =>
        fheGeoGuessrContract.interface.parseLog(log as any)?.name === "RoundCreated"
      );

      expect(roundCreatedEvent).to.not.be.undefined;
      expect(await fheGeoGuessrContract.currentRoundId()).to.equal(1);

      // Check round details
      const round = await fheGeoGuessrContract.getRound(1);
      expect(round.id).to.equal(1);
      expect(round.panoramaUrl).to.equal(panoramaUrl);
      expect(round.isActive).to.be.true;
      expect(round.creator).to.equal(signers.alice.address);
    });

    it("should set current round correctly", async function () {
      const panoramaUrl = "https://example.com/panorama1.jpg";

      const encryptedCoords = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.alice.address)
        .add32(NYC_LAT)
        .add32(NYC_LON)
        .encrypt();

      await fheGeoGuessrContract
        .connect(signers.alice)
        .createRound(
          panoramaUrl,
          encryptedCoords.handles[0],
          encryptedCoords.handles[1],
          encryptedCoords.inputProof
        );

      expect(await fheGeoGuessrContract.getCurrentRound()).to.equal(1);
    });
  });

  describe("Guess Submission", function () {
    let roundId: number;

    beforeEach(async function () {
      // Create a round for testing
      const panoramaUrl = "https://example.com/panorama1.jpg";
      const encryptedCoords = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.alice.address)
        .add32(NYC_LAT)
        .add32(NYC_LON)
        .encrypt();

      await fheGeoGuessrContract
        .connect(signers.alice)
        .createRound(
          panoramaUrl,
          encryptedCoords.handles[0],
          encryptedCoords.handles[1],
          encryptedCoords.inputProof
        );

      roundId = 1;
    });

    it("should allow players to submit encrypted guesses", async function () {
      // Bob submits a guess for Los Angeles
      const encryptedGuess = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.bob.address)
        .add32(LA_LAT)
        .add32(LA_LON)
        .encrypt();

      const tx = await fheGeoGuessrContract
        .connect(signers.bob)
        .submitGuess(
          roundId,
          encryptedGuess.handles[0], // latitude
          encryptedGuess.handles[1], // longitude
          encryptedGuess.inputProof
        );

      const receipt = await tx.wait();
      const guessSubmittedEvent = receipt?.logs.find(log =>
        fheGeoGuessrContract.interface.parseLog(log as any)?.name === "GuessSubmitted"
      );

      expect(guessSubmittedEvent).to.not.be.undefined;
      expect(await fheGeoGuessrContract.hasPlayerGuessed(roundId, signers.bob.address)).to.be.true;
      expect(await fheGeoGuessrContract.getRoundPlayerCount(roundId)).to.equal(1);
    });

    it("should prevent duplicate guesses from same player", async function () {
      // Bob submits first guess
      const encryptedGuess1 = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.bob.address)
        .add32(LA_LAT)
        .add32(LA_LON)
        .encrypt();

      await fheGeoGuessrContract
        .connect(signers.bob)
        .submitGuess(
          roundId,
          encryptedGuess1.handles[0],
          encryptedGuess1.handles[1],
          encryptedGuess1.inputProof
        );

      // Bob tries to submit second guess - should fail
      const encryptedGuess2 = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.bob.address)
        .add32(LONDON_LAT)
        .add32(LONDON_LON)
        .encrypt();

      await expect(
        fheGeoGuessrContract
          .connect(signers.bob)
          .submitGuess(
            roundId,
            encryptedGuess2.handles[0],
            encryptedGuess2.handles[1],
            encryptedGuess2.inputProof
          )
      ).to.be.revertedWith("Already submitted guess for this round");
    });

    it("should allow multiple players to submit guesses", async function () {
      // Bob submits a guess
      const bobGuess = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.bob.address)
        .add32(LA_LAT)
        .add32(LA_LON)
        .encrypt();

      await fheGeoGuessrContract
        .connect(signers.bob)
        .submitGuess(
          roundId,
          bobGuess.handles[0],
          bobGuess.handles[1],
          bobGuess.inputProof
        );

      // Charlie submits a guess
      const charlieGuess = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.charlie.address)
        .add32(LONDON_LAT)
        .add32(LONDON_LON)
        .encrypt();

      await fheGeoGuessrContract
        .connect(signers.charlie)
        .submitGuess(
          roundId,
          charlieGuess.handles[0],
          charlieGuess.handles[1],
          charlieGuess.inputProof
        );

      expect(await fheGeoGuessrContract.hasPlayerGuessed(roundId, signers.bob.address)).to.be.true;
      expect(await fheGeoGuessrContract.hasPlayerGuessed(roundId, signers.charlie.address)).to.be.true;
      expect(await fheGeoGuessrContract.getRoundPlayerCount(roundId)).to.equal(2);

      const players = await fheGeoGuessrContract.getRoundPlayers(roundId);
      expect(players).to.include(signers.bob.address);
      expect(players).to.include(signers.charlie.address);
    });
  });

  describe("Round Management", function () {
    it("should prevent guesses after round ends", async function () {
      // Create a round with very short duration for testing
      await fheGeoGuessrContract.setRoundDuration(1); // 1 second

      const panoramaUrl = "https://example.com/panorama1.jpg";
      const encryptedCoords = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.alice.address)
        .add32(NYC_LAT)
        .add32(NYC_LON)
        .encrypt();

      await fheGeoGuessrContract
        .connect(signers.alice)
        .createRound(
          panoramaUrl,
          encryptedCoords.handles[0],
          encryptedCoords.handles[1],
          encryptedCoords.inputProof
        );

      // Wait for round to end
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to submit guess after round ends
      const encryptedGuess = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.bob.address)
        .add32(LA_LAT)
        .add32(LA_LON)
        .encrypt();

      await expect(
        fheGeoGuessrContract
          .connect(signers.bob)
          .submitGuess(
            1,
            encryptedGuess.handles[0],
            encryptedGuess.handles[1],
            encryptedGuess.inputProof
          )
      ).to.be.revertedWith("Round has ended");

      // Reset duration for other tests
      await fheGeoGuessrContract.setRoundDuration(120);
    });

    it("should allow round creator to end round manually", async function () {
      const panoramaUrl = "https://example.com/panorama1.jpg";
      const encryptedCoords = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.alice.address)
        .add32(NYC_LAT)
        .add32(NYC_LON)
        .encrypt();

      await fheGeoGuessrContract
        .connect(signers.alice)
        .createRound(
          panoramaUrl,
          encryptedCoords.handles[0],
          encryptedCoords.handles[1],
          encryptedCoords.inputProof
        );

      // Alice ends the round
      const tx = await fheGeoGuessrContract.connect(signers.alice).endRound(1);
      const receipt = await tx.wait();

      const roundEndedEvent = receipt?.logs.find(log =>
        fheGeoGuessrContract.interface.parseLog(log as any)?.name === "RoundEnded"
      );

      expect(roundEndedEvent).to.not.be.undefined;

      const round = await fheGeoGuessrContract.getRound(1);
      expect(round.isActive).to.be.false;
    });

    it("should prevent non-creators from ending round", async function () {
      const panoramaUrl = "https://example.com/panorama1.jpg";
      const encryptedCoords = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.alice.address)
        .add32(NYC_LAT)
        .add32(NYC_LON)
        .encrypt();

      await fheGeoGuessrContract
        .connect(signers.alice)
        .createRound(
          panoramaUrl,
          encryptedCoords.handles[0],
          encryptedCoords.handles[1],
          encryptedCoords.inputProof
        );

      // Bob tries to end Alice's round - should fail
      await expect(
        fheGeoGuessrContract.connect(signers.bob).endRound(1)
      ).to.be.revertedWith("Only round creator can call this");
    });
  });

  describe("Distance Calculation Request", function () {
    let roundId: number;

    beforeEach(async function () {
      // Create a round and submit guesses
      const panoramaUrl = "https://example.com/panorama1.jpg";
      const encryptedCoords = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.alice.address)
        .add32(NYC_LAT)
        .add32(NYC_LON)
        .encrypt();

      await fheGeoGuessrContract
        .connect(signers.alice)
        .createRound(
          panoramaUrl,
          encryptedCoords.handles[0],
          encryptedCoords.handles[1],
          encryptedCoords.inputProof
        );

      roundId = 1;

      // Bob submits a guess
      const bobGuess = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.bob.address)
        .add32(LA_LAT)
        .add32(LA_LON)
        .encrypt();

      await fheGeoGuessrContract
        .connect(signers.bob)
        .submitGuess(
          roundId,
          bobGuess.handles[0],
          bobGuess.handles[1],
          bobGuess.inputProof
        );

      // End the round
      await fheGeoGuessrContract.connect(signers.alice).endRound(roundId);
    });

    it("should prevent distance request before round ends", async function () {
      // Create a new active round
      const panoramaUrl = "https://example.com/panorama2.jpg";
      const encryptedCoords = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.alice.address)
        .add32(LONDON_LAT)
        .add32(LONDON_LON)
        .encrypt();

      await fheGeoGuessrContract
        .connect(signers.alice)
        .createRound(
          panoramaUrl,
          encryptedCoords.handles[0],
          encryptedCoords.handles[1],
          encryptedCoords.inputProof
        );

      const activeRoundId = 2;

      // Charlie submits a guess
      const charlieGuess = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.charlie.address)
        .add32(NYC_LAT)
        .add32(NYC_LON)
        .encrypt();

      await fheGeoGuessrContract
        .connect(signers.charlie)
        .submitGuess(
          activeRoundId,
          charlieGuess.handles[0],
          charlieGuess.handles[1],
          charlieGuess.inputProof
        );

      // Try to request distance while round is still active
      await expect(
        fheGeoGuessrContract.requestPlayerDistance(activeRoundId, signers.charlie.address)
      ).to.be.revertedWith("Round is still active");
    });

    it("should prevent distance request for players who haven't guessed", async function () {
      // First ensure the round has ended (it should be ended from beforeEach)
      const round = await fheGeoGuessrContract.getRound(roundId);
      expect(round.isActive).to.be.false;

      await expect(
        fheGeoGuessrContract.requestPlayerDistance(roundId, signers.charlie.address)
      ).to.be.revertedWith("Player has not submitted a guess");
    });

    it("should prevent duplicate distance requests", async function () {
      // Ensure the round has ended (it should be ended from beforeEach)
      const round = await fheGeoGuessrContract.getRound(roundId);
      expect(round.isActive).to.be.false;

      // Make first request (would normally initiate async decryption)
      const requestId = await fheGeoGuessrContract.requestPlayerDistance(roundId, signers.bob.address);

      // Check that request was recorded
      expect(await fheGeoGuessrContract.decryptionRequests(roundId, signers.bob.address)).to.not.equal(0);
      expect(await fheGeoGuessrContract.isDistancePending(roundId, signers.bob.address)).to.be.true;

      // Try to make second request - should fail
      await expect(
        fheGeoGuessrContract.requestPlayerDistance(roundId, signers.bob.address)
      ).to.be.revertedWith("Decryption already requested for this player");
    });
  });

  describe("View Functions", function () {
    it("should return correct round information", async function () {
      const panoramaUrl = "https://example.com/test-panorama.jpg";
      const encryptedCoords = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.alice.address)
        .add32(NYC_LAT)
        .add32(NYC_LON)
        .encrypt();

      await fheGeoGuessrContract
        .connect(signers.alice)
        .createRound(
          panoramaUrl,
          encryptedCoords.handles[0],
          encryptedCoords.handles[1],
          encryptedCoords.inputProof
        );

      const round = await fheGeoGuessrContract.getRound(1);
      expect(round.id).to.equal(1);
      expect(round.panoramaUrl).to.equal(panoramaUrl);
      expect(round.isActive).to.be.true;
      expect(round.creator).to.equal(signers.alice.address);
    });

    it("should track player guess status correctly", async function () {
      const panoramaUrl = "https://example.com/panorama1.jpg";
      const encryptedCoords = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.alice.address)
        .add32(NYC_LAT)
        .add32(NYC_LON)
        .encrypt();

      await fheGeoGuessrContract
        .connect(signers.alice)
        .createRound(
          panoramaUrl,
          encryptedCoords.handles[0],
          encryptedCoords.handles[1],
          encryptedCoords.inputProof
        );

      expect(await fheGeoGuessrContract.hasPlayerGuessed(1, signers.bob.address)).to.be.false;

      const bobGuess = await fhevm
        .createEncryptedInput(fheGeoGuessrContractAddress, signers.bob.address)
        .add32(LA_LAT)
        .add32(LA_LON)
        .encrypt();

      await fheGeoGuessrContract
        .connect(signers.bob)
        .submitGuess(
          1,
          bobGuess.handles[0],
          bobGuess.handles[1],
          bobGuess.inputProof
        );

      expect(await fheGeoGuessrContract.hasPlayerGuessed(1, signers.bob.address)).to.be.true;
    });
  });

  describe("Round Duration Management", function () {
    it("should allow setting round duration", async function () {
      expect(await fheGeoGuessrContract.roundDuration()).to.equal(120);

      await fheGeoGuessrContract.setRoundDuration(300); // 5 minutes
      expect(await fheGeoGuessrContract.roundDuration()).to.equal(300);
    });
  });
});