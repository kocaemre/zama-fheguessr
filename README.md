# FHE GeoGuessr 🌍🔐

A privacy-preserving location guessing game built with **Fully Homomorphic Encryption (FHE)** using Zama's technology. Players guess locations from 360° panoramic views while their coordinates remain completely encrypted throughout the entire process, enabling fair competition without revealing sensitive location data.

# [DEMO — YouTube](https://youtu.be/gsYPBcCHhLw)

## 🚀 Features

- **🔐 Full Privacy**: Coordinates are encrypted using FHE before leaving your device
- **🌐 360° Panoramic Views**: Immersive Street View-style exploration using Pannellum
- **⛓️ Blockchain Integration**: Smart contracts handle encrypted distance calculations on Ethereum Sepolia
- **🎯 Real-time Results**: Instant distance feedback without revealing actual coordinates
- **🔍 Interactive Map**: Click-to-guess interface with MapLibre GL
- **💳 Web3 Wallet Integration**: Connect with MetaMask, WalletConnect, and more via RainbowKit
- **🏆 Competitive Gaming**: Fair scoring system based on Euclidean distance approximation
- **🔄 Live Updates**: Real-time game state synchronization across all players

## 🛠️ Technology Stack

### Frontend
- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **MapLibre GL** - Interactive maps
- **RainbowKit** - Wallet connections
- **Radix UI** - Accessible components

### Blockchain
- **Ethereum** - Smart contract platform
- **Hardhat** - Development environment
- **Ethers.js** - Blockchain interaction
- **Zama FHE** - Fully Homomorphic Encryption

### Privacy Technology
- **Zama fhEVM** - FHE-enabled smart contracts
- **Relayer SDK** - FHE encryption/decryption
- **EIP-712** - Structured data signing

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Frontend      │    │   Relayer    │    │ Smart Contract  │
│                 │    │   Service    │    │                 │
│ ┌─────────────┐ │    │              │    │ ┌─────────────┐ │
│ │ Encrypt     │◄┼────┼──────────────┼────┼►│ Calculate   │ │
│ │ Coordinates │ │    │   Zama FHE   │    │ │ Distance    │ │
│ └─────────────┘ │    │              │    │ └─────────────┘ │
│                 │    │              │    │                 │
│ ┌─────────────┐ │    │              │    │ ┌─────────────┐ │
│ │ Decrypt     │◄┼────┼──────────────┼────┼►│ Return      │ │
│ │ Result      │ │    │              │    │ │ Encrypted   │ │
│ └─────────────┘ │    │              │    │ └─────────────┘ │
└─────────────────┘    └──────────────┘    └─────────────────┘
```

## 🔒 Privacy & Cryptographic Features

### How FHE Ensures Complete Privacy

1. **Client-Side Encryption**: Your guess coordinates are encrypted using Zama's FHE technology directly in your browser
2. **Encrypted Computation**: Smart contract performs distance calculations on encrypted data without ever decrypting it
3. **Private Results**: Distance is computed without revealing your guess coordinates, target coordinates, or intermediate calculations
4. **Zero Knowledge**: Even the smart contract, blockchain validators, and other players never see your actual coordinates
5. **Verifiable Security**: All operations are cryptographically verifiable while maintaining complete privacy

### Technical Implementation Details

#### FHE Encryption Process
```javascript
// Coordinates are scaled to preserve precision
const latInt = Math.round(latitude * 100000);
const lngInt = Math.round(longitude * 100000);

// Encrypted using Zama's FHE libraries
const input = fhevmInstance.createEncryptedInput(contractAddress, userAddress);
input.add32(latInt);  // Encrypted as 32-bit integers
input.add32(lngInt);
const encryptedInput = await input.encrypt();
```

#### Smart Contract Distance Calculation
Our smart contract implements a **simplified Euclidean distance calculation** due to FHE computational constraints:

```solidity
// Note: This is a simplified approximation, not true geographic distance
function calculateDistance(
    euint32 lat1, euint32 lng1,  // Player guess (encrypted)
    euint32 lat2, euint32 lng2   // Target location (encrypted)
) internal pure returns (euint32) {
    euint32 latDiff = TFHE.sub(lat1, lat2);
    euint32 lngDiff = TFHE.sub(lng1, lng2);

    // Sum of squares calculation (encrypted)
    euint32 latSquared = TFHE.mul(latDiff, latDiff);
    euint32 lngSquared = TFHE.mul(lngDiff, lngDiff);

    return TFHE.add(latSquared, lngSquared);  // Returns sum of squares
}
```

#### Frontend Distance Processing
Since FHE currently doesn't support square root operations, we handle the final calculation on the frontend:

```javascript
// Contract returns sum of squares of coordinate differences
const sumOfSquares = Number(decryptedValue);

// Calculate Euclidean distance in scaled coordinate units
const distanceInScaledUnits = Math.sqrt(sumOfSquares);

// Convert back to degrees
const distanceInDegrees = distanceInScaledUnits / 100000;

// Rough approximation: 1 degree ≈ 111 km
// Note: This is not perfectly accurate for all global locations
const approximateDistanceInKm = distanceInDegrees * 111;
```

### Mathematical Limitations & Workarounds

#### Why We Can't Use Haversine Formula
The ideal geographic distance calculation would use the Haversine formula:
```
a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2)
c = 2 ⋅ atan2( √a, √(1−a) )
d = R ⋅ c
```

However, **FHE currently doesn't support**:
- Trigonometric functions (sin, cos, atan2)
- Square root operations
- Complex mathematical operations

#### Our Approximation Method
1. **Euclidean Distance**: We use simplified Euclidean distance instead of great-circle distance
2. **Linear Approximation**: 1 degree ≈ 111 km (varies by latitude but provides consistent scoring)
3. **Scaled Arithmetic**: All calculations use integer arithmetic with 100,000x scaling for precision
4. **Frontend Square Root**: Square root calculation happens after FHE decryption on the client

#### Accuracy Trade-offs
- **Global Variations**: Our approximation is less accurate near poles and more accurate near the equator
- **Consistent Scoring**: Despite inaccuracy, all players are scored using the same method, ensuring fairness
- **Future Improvements**: As FHE technology evolves, we can implement more sophisticated distance calculations

### Encryption Flow with Technical Details

```
User Input: (40.7128, -74.0060)
    ↓
Scaling: (4071280, -7400600)
    ↓
FHE Encryption: Zama's euint32 ciphertext
    ↓
Smart Contract: Encrypted arithmetic operations
    ↓
Encrypted Sum of Squares: Still encrypted
    ↓
User Decryption: Using private key + EIP-712 signature
    ↓
Frontend Processing: Math.sqrt() + geographic approximation
    ↓
Final Distance: ~1,247 km (example)
```

## 🔗 Smart Contract Details

### Deployed Contract Information
- **Contract Address**: `0xAf52747676ae6e277f63760a25BaCe70D559A0A0`
- **Network**: Ethereum Sepolia Testnet
- **Chain ID**: 11155111
- **RPC Endpoint**: `https://ethereum-sepolia-rpc.publicnode.com`
- **Block Explorer**: [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0xAf52747676ae6e277f63760a25BaCe70D559A0A0)

### Key Contract Functions

#### Core Game Functions
```solidity
function createRound(
    string calldata panoramaUrl,
    bytes calldata encryptedLat,
    bytes calldata encryptedLng,
    bytes calldata inputProof
) external returns (uint256 roundId)

function submitGuess(
    uint256 roundId,
    bytes calldata encryptedLat,
    bytes calldata encryptedLng,
    bytes calldata inputProof
) external returns (bytes32 encryptedDistance)

function getCurrentRound() external view returns (uint256)
function getRound(uint256 roundId) external view returns (Round memory)
```

#### Privacy & Security Features
- **Input Validation**: All encrypted inputs require cryptographic proofs
- **Access Control**: Players can only decrypt their own results
- **Replay Protection**: EIP-712 signatures prevent replay attacks
- **Scaling Consistency**: All coordinates use consistent 100,000x scaling

### Gas Optimization & Performance
- **Efficient FHE Operations**: Minimized encrypted operations to reduce gas costs
- **Batch Processing**: Multiple operations combined where possible
- **Event Emissions**: Comprehensive event logging for frontend synchronization

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or compatible Web3 wallet

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/kocaemrefhe-geoguessr.git
cd fhe-geoguessr
```

2. **Install dependencies**
```bash
cd website
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env.local
# Add your configuration
```

4. **Start the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

5. **Deploy smart contracts (optional)**
```bash
cd ../contracts
npx hardhat compile
npx hardhat deploy --network sepolia
```

## 🎮 How to Play

1. **Connect Wallet**: Click "Connect Wallet" and choose your preferred wallet
2. **View Panorama**: Explore the 360° view to understand the location
3. **Make Guess**: Click "Make Guess" to open the world map
4. **Select Location**: Click anywhere on the map to place your guess
5. **Submit**: Click "Submit Encrypted Guess" to process your answer
6. **Wait for Results**: Watch the FHE encryption/decryption process
7. **See Distance**: Get your distance result in kilometers

## 🔧 Configuration

### Environment Variables

```env
# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=xxxxxx

# Blockchain Configuration
NEXT_PUBLIC_RPC_URL=https://sepolia.infura.io/v3/your_key
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...

# Application Settings
NEXT_PUBLIC_APP_NAME=FHE GeoGuessr
```

### Smart Contract Addresses

- **Sepolia Testnet**: `0xAf52747676ae6e277f63760a25BaCe70D559A0A0`


## 🧪 Testing

### Smart Contract Tests
```bash
cd contracts
npx hardhat test
```

### Frontend Tests
```bash
cd website
npm test
```

### Integration Tests
```bash
npm run test:integration
```

## 📋 Game Rules & Mechanics

### Core Gameplay
- **Objective**: Analyze the 360° panoramic view and guess the exact location on Earth
- **Scoring**: Lower distance = better score (measured in kilometers)
- **Privacy**: Your exact coordinates are never revealed to anyone during the game
- **Fairness**: All players compete under identical privacy-preserving conditions

### Scoring System
- **Distance Calculation**: Euclidean distance approximation using encrypted coordinates
- **Accuracy Range**: 0-20,000 km (capped at half Earth's circumference)
- **Precision**: Results shown to 2 decimal places (e.g., 1,247.83 km)
- **Consistency**: All players scored using identical mathematical methods

### Technical Constraints
- **FHE Limitations**: True geographic distance requires trigonometric functions not yet available in FHE
- **Coordinate Scaling**: All coordinates scaled by 100,000x for integer arithmetic precision
- **Approximation Method**: Linear degree-to-kilometer conversion (1° ≈ 111 km)
- **Global Variance**: Accuracy varies by latitude but scoring remains fair and consistent

### Privacy Guarantees
- **Complete Confidentiality**: Neither target locations nor player guesses are ever exposed
- **Cryptographic Security**: All computations performed on encrypted data
- **Decentralized Verification**: Results verifiable without compromising privacy
- **Zero-Knowledge Gaming**: Players learn their distance without revealing their strategy

## 🛣️ Roadmap

### Phase 1: Core Game ✅
- [x] Basic FHE integration
- [x] 360° panoramic views
- [x] Distance calculation
- [x] Web3 wallet integration

### Future Works 🚧
- [ ] Leaderboard system
- [ ] Multiple difficulty levels
- [ ] Tournament mode
- [ ] Social sharing
- [ ] NFT rewards for winners
- [ ] Multiplayer competitions
- [ ] Custom location uploads
- [ ] Mobile app

## 🤝 Contributing

We welcome contributions!

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🔐 Security

This project uses cutting-edge FHE technology to ensure complete privacy. However, please note:

- This is experimental technology
- Use testnet funds only
- Report security issues responsibly

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏆 Built for Zama

This project was built for the Zama Developer Program, showcasing the power of Fully Homomorphic Encryption in creating privacy-preserving applications.

## 📞 Support

- **Documentation**: [docs.zama.ai](https://docs.zama.ai)
- **Discord**: [Zama Community](https://discord.gg/zama)
- **Issues**: [GitHub Issues](https://github.com/kocaemre/zama-fheguessr/issues)

---

**Made with ❤️ and 🔐 by Emre]**

*Powered by Zama's Fully Homomorphic Encryption*
