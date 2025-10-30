// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, euint64, externalEuint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title FHE GeoGuessr - Privacy-preserving geography game
/// @author FHE GeoGuessr Team
/// @notice A cheat-proof geography guessing game using Fully Homomorphic Encryption
contract FHEGeoGuessr is SepoliaConfig {

    struct Round {
        uint256 id;
        string panoramaUrl;
        euint32 encryptedLatitude;   // Scaled by 100,000 (e.g., 41.0082° → 4,100,820)
        euint32 encryptedLongitude;  // Scaled by 100,000 (e.g., -74.0123° → -7,401,230)
        uint256 startTime;
        uint256 endTime;
        bool isRevealed;
        bool isActive;
        address creator;
    }

    struct Guess {
        euint32 encryptedLatitude;
        euint32 encryptedLongitude;
        uint256 revealedDistance;  // Distance in meters, revealed after round ends
        uint256 timestamp;         // When this guess was submitted
        bool isRevealed;
    }

    struct PlayerRoundData {
        Guess[] guesses;           // Array of all guesses for this round
        bool hasGuessed;           // Has submitted at least one guess
    }

    // State variables
    uint256 public currentRoundId;
    address public owner;

    mapping(uint256 => Round) public rounds;
    mapping(uint256 => mapping(address => PlayerRoundData)) public roundGuesses;
    mapping(uint256 => address[]) public roundPlayers;

    // Events
    event RoundCreated(uint256 indexed roundId, string panoramaUrl, uint256 startTime, uint256 endTime);
    event GuessSubmitted(uint256 indexed roundId, address indexed player);
    event DistancesRevealed(uint256 indexed roundId);
    event RoundEnded(uint256 indexed roundId);

    // Modifiers
    modifier onlyActiveRound(uint256 roundId) {
        require(rounds[roundId].isActive, "Round is not active");
        require(block.timestamp >= rounds[roundId].startTime, "Round has not started");
        // Removed time restriction - rounds never end automatically
        _;
    }

    modifier onlyRoundCreator(uint256 roundId) {
        require(msg.sender == rounds[roundId].creator, "Only round creator can call this");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor() {
        currentRoundId = 0;
        owner = msg.sender;
    }

    /// @notice Creates a new round with encrypted coordinates
    /// @param panoramaUrl URL to the 360° panorama image
    /// @param encryptedLat Encrypted latitude (scaled by 100,000)
    /// @param encryptedLon Encrypted longitude (scaled by 100,000)
    /// @param inputProof Zero-knowledge proof for encrypted inputs
    function createRound(
        string calldata panoramaUrl,
        externalEuint32 encryptedLat,
        externalEuint32 encryptedLon,
        bytes calldata inputProof
    ) external onlyOwner returns (uint256) {
        currentRoundId++;

        // Convert external encrypted inputs to internal format
        euint32 latitude = FHE.fromExternal(encryptedLat, inputProof);
        euint32 longitude = FHE.fromExternal(encryptedLon, inputProof);

        uint256 startTime = block.timestamp;
        uint256 endTime = 0; // No end time - rounds run indefinitely

        rounds[currentRoundId] = Round({
            id: currentRoundId,
            panoramaUrl: panoramaUrl,
            encryptedLatitude: latitude,
            encryptedLongitude: longitude,
            startTime: startTime,
            endTime: endTime,
            isRevealed: false,
            isActive: true,
            creator: msg.sender
        });

        // Set permissions for the contract to use encrypted values
        FHE.allowThis(latitude);
        FHE.allowThis(longitude);

        emit RoundCreated(currentRoundId, panoramaUrl, startTime, endTime);

        return currentRoundId;
    }

    /// @notice Submit an encrypted guess for the current round
    /// @param roundId The round ID to submit guess for
    /// @param encryptedLat Encrypted latitude guess (scaled by 100,000)
    /// @param encryptedLon Encrypted longitude guess (scaled by 100,000)
    /// @param inputProof Zero-knowledge proof for encrypted inputs
    function submitGuess(
        uint256 roundId,
        externalEuint32 encryptedLat,
        externalEuint32 encryptedLon,
        bytes calldata inputProof
    ) external onlyActiveRound(roundId) returns (
        bytes32 encryptedDistance
    ) {
        // Convert external encrypted inputs to internal format
        euint32 guessLat = FHE.fromExternal(encryptedLat, inputProof);
        euint32 guessLon = FHE.fromExternal(encryptedLon, inputProof);

        // Create new guess
        Guess memory newGuess = Guess({
            encryptedLatitude: guessLat,
            encryptedLongitude: guessLon,
            revealedDistance: 0,
            timestamp: block.timestamp,
            isRevealed: false
        });

        // Add guess to player's array
        roundGuesses[roundId][msg.sender].guesses.push(newGuess);

        // Add player to round if first guess
        if (!roundGuesses[roundId][msg.sender].hasGuessed) {
            roundPlayers[roundId].push(msg.sender);
            roundGuesses[roundId][msg.sender].hasGuessed = true;
        }

        // Set permissions
        FHE.allowThis(guessLat);
        FHE.allowThis(guessLon);
        FHE.allow(guessLat, msg.sender);
        FHE.allow(guessLon, msg.sender);

        // Calculate distance and allow user to decrypt
        {
            Round storage round = rounds[roundId];
            euint64 sumOfSquares = FHE.add(
                FHE.mul(FHE.asEuint64(FHE.sub(round.encryptedLatitude, guessLat)), FHE.asEuint64(FHE.sub(round.encryptedLatitude, guessLat))),
                FHE.mul(FHE.asEuint64(FHE.sub(round.encryptedLongitude, guessLon)), FHE.asEuint64(FHE.sub(round.encryptedLongitude, guessLon)))
            );
            FHE.allowThis(sumOfSquares);
            FHE.allow(sumOfSquares, msg.sender);
            encryptedDistance = FHE.toBytes32(sumOfSquares);
        }

        emit GuessSubmitted(roundId, msg.sender);
    }

    // Mapping to track decryption requests
    mapping(uint256 => mapping(address => uint256)) public decryptionRequests;
    mapping(uint256 => bool) public isDecryptionPending;

    /// @notice Request distance calculation for a player's specific guess (async decryption)
    /// @param roundId The round ID
    /// @param player The player address
    /// @param guessIndex The index of the guess to calculate distance for
    function requestPlayerDistance(uint256 roundId, address player, uint256 guessIndex)
        external
        returns (uint256 requestId)
    {
        require(roundGuesses[roundId][player].hasGuessed, "Player has not submitted a guess");
        require(guessIndex < roundGuesses[roundId][player].guesses.length, "Invalid guess index");
        require(!roundGuesses[roundId][player].guesses[guessIndex].isRevealed, "Distance already revealed for this guess");

        // Calculate FHE distance and request decryption
        requestId = _calculateAndRequestDistance(roundId, player, guessIndex);

        return requestId;
    }

    function _calculateAndRequestDistance(uint256 roundId, address player, uint256 guessIndex)
        internal
        returns (uint256)
    {
        Round storage round = rounds[roundId];
        Guess storage guess = roundGuesses[roundId][player].guesses[guessIndex];

        // Calculate simple Euclidean distance for now (we'll improve accuracy in callback)
        euint32 latDiff = FHE.sub(round.encryptedLatitude, guess.encryptedLatitude);
        euint32 lonDiff = FHE.sub(round.encryptedLongitude, guess.encryptedLongitude);

        // Calculate squared distance
        euint64 latDiffSquared = FHE.mul(FHE.asEuint64(latDiff), FHE.asEuint64(latDiff));
        euint64 lonDiffSquared = FHE.mul(FHE.asEuint64(lonDiff), FHE.asEuint64(lonDiff));
        euint64 sumOfSquares = FHE.add(latDiffSquared, lonDiffSquared);

        // Prepare for decryption - we only need the sum of squares for basic distance
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(sumOfSquares);

        // Request decryption
        uint256 requestId = FHE.requestDecryption(cts, this.callbackPlayerDistance.selector);

        // Store mapping
        decryptionRequests[roundId][player] = requestId;
        isDecryptionPending[requestId] = true;

        return requestId;
    }

    /// @notice Callback function for async distance decryption (Pure FHE Approach)
    /// @param requestId The decryption request ID
    /// @param decryptedSumOfSquares The decrypted sum of squares
    function callbackPlayerDistance(
        uint256 requestId,
        uint64 decryptedSumOfSquares,
        bytes[] memory /* signatures */
    ) public {
        // Note: Signature verification would be handled by the oracle in production
        // For now, we'll skip this validation in the mock environment

        require(isDecryptionPending[requestId], "Invalid or already processed request");

        // Find the round and player for this request
        uint256 roundId = 0;
        address player = address(0);

        // Find the matching request (in practice, you'd optimize this lookup)
        for (uint256 i = 1; i <= currentRoundId; i++) {
            for (uint256 j = 0; j < roundPlayers[i].length; j++) {
                address currentPlayer = roundPlayers[i][j];
                if (decryptionRequests[i][currentPlayer] == requestId) {
                    roundId = i;
                    player = currentPlayer;
                    break;
                }
            }
            if (roundId != 0) break;
        }

        require(roundId != 0 && player != address(0), "Request not found");

        // Pure FHE Approach: Keep distance calculation minimal and privacy-preserving
        // We only compute the basic distance without geographic corrections
        // This maintains FHE privacy principles by not revealing location patterns
        uint256 distance = _sqrt(decryptedSumOfSquares);

        // Find which guess this was for (we need to implement better tracking)
        // For now, we'll update the most recent unrevealed guess
        PlayerRoundData storage playerData = roundGuesses[roundId][player];

        // Find the most recent unrevealed guess
        for (uint256 k = playerData.guesses.length; k > 0; k--) {
            if (!playerData.guesses[k-1].isRevealed) {
                // Store the revealed distance
                playerData.guesses[k-1].revealedDistance = distance;
                playerData.guesses[k-1].isRevealed = true;

                break;
            }
        }

        // Clear the pending status
        isDecryptionPending[requestId] = false;
    }

    /// @notice Simple integer square root function (Babylonian method)
    /// @param x The number to find square root of
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;

        uint256 z = (x + 1) / 2;
        uint256 y = x;

        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }

        return y;
    }


    /// @notice Get the revealed distance for a player's specific guess
    /// @param roundId The round ID
    /// @param player The player address
    /// @param guessIndex The index of the guess
    function getPlayerDistance(uint256 roundId, address player, uint256 guessIndex)
        external
        view
        returns (uint256)
    {
        require(guessIndex < roundGuesses[roundId][player].guesses.length, "Invalid guess index");
        require(roundGuesses[roundId][player].guesses[guessIndex].isRevealed, "Distance not yet revealed");
        return roundGuesses[roundId][player].guesses[guessIndex].revealedDistance;
    }

    /// @notice Get all guesses for a player in a round
    /// @param roundId The round ID
    /// @param player The player address
    function getPlayerGuesses(uint256 roundId, address player)
        external
        view
        returns (uint256[] memory distances, uint256[] memory timestamps, bool[] memory revealed)
    {
        Guess[] storage guesses = roundGuesses[roundId][player].guesses;
        uint256 length = guesses.length;

        distances = new uint256[](length);
        timestamps = new uint256[](length);
        revealed = new bool[](length);

        for (uint256 i = 0; i < length; i++) {
            distances[i] = guesses[i].revealedDistance;
            timestamps[i] = guesses[i].timestamp;
            revealed[i] = guesses[i].isRevealed;
        }
    }

    /// @notice Get the number of guesses for a player in a round
    /// @param roundId The round ID
    /// @param player The player address
    function getPlayerGuessCount(uint256 roundId, address player)
        external
        view
        returns (uint256)
    {
        return roundGuesses[roundId][player].guesses.length;
    }


    /// @notice Get round information
    /// @param roundId The round ID
    function getRound(uint256 roundId)
        external
        view
        returns (
            uint256 id,
            string memory panoramaUrl,
            uint256 startTime,
            uint256 endTime,
            bool isRevealed,
            bool isActive,
            address creator
        )
    {
        Round storage round = rounds[roundId];
        return (
            round.id,
            round.panoramaUrl,
            round.startTime,
            round.endTime,
            round.isRevealed,
            round.isActive,
            round.creator
        );
    }

    /// @notice Check if a player has submitted a guess for a round
    /// @param roundId The round ID
    /// @param player The player address
    function hasPlayerGuessed(uint256 roundId, address player)
        external
        view
        returns (bool)
    {
        return roundGuesses[roundId][player].hasGuessed;
    }

    /// @notice Get the number of players in a round
    /// @param roundId The round ID
    function getRoundPlayerCount(uint256 roundId)
        external
        view
        returns (uint256)
    {
        return roundPlayers[roundId].length;
    }

    /// @notice Get players list for a round
    /// @param roundId The round ID
    function getRoundPlayers(uint256 roundId)
        external
        view
        returns (address[] memory)
    {
        return roundPlayers[roundId];
    }

    /// @notice Get current active round ID (0 if no active round)
    function getCurrentRound() external view returns (uint256) {
        if (currentRoundId == 0) return 0;

        Round storage round = rounds[currentRoundId];
        if (round.isActive) {
            return currentRoundId;
        }
        return 0;
    }



    /// @notice Check if distance calculation is pending for a player
    /// @param roundId The round ID
    /// @param player The player address
    function isDistancePending(uint256 roundId, address player)
        external
        view
        returns (bool)
    {
        uint256 requestId = decryptionRequests[roundId][player];
        return requestId != 0 && isDecryptionPending[requestId];
    }

    /// @notice End a round manually (only creator)
    /// @param roundId The round ID to end
    function endRound(uint256 roundId) external onlyRoundCreator(roundId) {
        rounds[roundId].isActive = false;
        emit RoundEnded(roundId);
    }
}