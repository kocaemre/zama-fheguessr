# 🌍 **FHE GeoGuessr - Product Requirements Document (PRD) v1.1**

**Version:** 1.1 - MVP (Revised)  
**Date:** October 27, 2025  
**Timeline:** 2.5 days

---

## 1. Executive Summary

**Project Name:** FHE GeoGuessr

**important links and instructions:** use context7 for mcp

https://docs.zama.ai/protocol/solidity-guides

https://docs.zama.ai/protocol/relayer-sdk-guides

check the links and use mcp for docs

**Tagline:** "Guess the location privately, compete fairly"

**One-liner:** A privacy-preserving geo-guessing game where players view a 360° panorama, submit encrypted coordinate guesses, and the smart contract calculates their distance using Fully Homomorphic Encryption.

**Core Innovation:** Use Zama's FHE to perform distance calculations on encrypted coordinates, making cheating impossible while maintaining complete privacy until reveal.

---

## 2. Problem & Solution

### Problem
- Traditional GeoGuessr games expose coordinates client-side
- Cheating is trivial (inspect element, network sniffing)
- No verifiable fairness in competitive play
- Multiplayer games can be manipulated

### Solution
- Real coordinates stored **encrypted on-chain**
- Player guesses submitted **encrypted**
- Distance calculated **on encrypted data** using FHE
- Only final distance revealed: "You were X km away"
- Cheat-proof, verifiable, fair

---

## 3. MVP Scope (Minimal Features Only)

### ✅ **IN SCOPE**

**Core Gameplay:**
- **Landing page** with "Join Game" button
- Game page with 360° panorama viewer (static image via URL)
- Simple world map for guess submission
- One guess per player (locked after submit)
- Timer showing time remaining (**2 minutes for demo**)
- Distance reveal after round ends
- **No actual location shown** (pure distance-based competition)

**Technical:**
- Smart contract on **Sepolia Testnet**
- Encrypted coordinate storage and calculation (using **euint64 or euint128** to prevent overflow)
- React 19 + next.js 16 frontend
- Wallet connection
- fhevmjs integration for encryption
- Panorama URL stored on-chain, image hosted externally

### ❌ **OUT OF SCOPE**

**Removed for MVP:**
- ~~Multiple simultaneous rounds~~
- ~~Show actual location feature~~ (decided: never show)
- ~~Round history page~~
- ~~User profile/stats~~
- ~~Advanced animations~~
- ~~Mobile-specific optimizations~~
- ~~Prize pools/betting~~
- ~~Admin dashboard~~
- ~~Multiple difficulty levels~~

**Nice to Have (if time permits):**
- 📊 Leaderboard (sorted by distance)

---

## 4. User Flow (Simplified)

```
1. Player visits site → Landing page
   ↓
2. Clicks "Join Game" button
   ↓
3. Redirected to game page
   ↓
4. Sees 360° panorama + timer (2 minutes)
   ↓
5. Clicks "Make Your Guess"
   ↓
6. Simple world map opens
   ↓
7. Clicks location on map
   ↓
8. Confirms guess → encrypted & submitted
   ↓
9. Waits for round to end (shows timer)
   ↓
10. Round ends → "You were X km away!"
   ↓
11. [Optional] Views leaderboard (if implemented)
```

**Total steps:** 11

---

## 5. Core Features (MVP Only)

### 5.1 Smart Contract Features

**Network:** Sepolia Testnet

**Essential Functions:**
- `createRound()` - Admin creates new round with:
  - panoramaUrl (string) - external URL to 360° image
  - encryptedLatitude (euint64 or euint128)
  - encryptedLongitude (euint64 or euint128)
  - duration (2 minutes for demo)
  
- `submitGuess()` - Player submits encrypted lat/lon (euint64/euint128)

- `revealDistances()` - Anyone can trigger after round ends

- `getPlayerDistance()` - Returns individual player's distance

- `getLeaderboard()` - [OPTIONAL] Returns sorted list of players + distances

**Data Stored On-Chain:**
- Panorama URL (string, points to external hosting)
- Encrypted actual coordinates (euint64 or euint128)
- Round timing info
- Player guesses (encrypted until reveal)
- Revealed distances (after round ends)

**Data NOT Stored On-Chain:**
- 360° panorama images (hosted externally, only URL on-chain)

**FHE Operations:**
- Subtract coordinates (delta calculation)
- Multiply (squaring deltas) 
- Add (sum of squares)
- Decrypt (only for final reveal)

**Overflow Prevention:**
Use **euint64** or **euint128** for distance calculations:
- Coordinates: euint32 (scaled by 100,000)
- When squaring: cast to euint64 or euint128
- Distance squared: euint64 or euint128

Example concern addressed:
- Max coordinate: ~18,000,000 (180° × 100,000)
- Squared: ~324,000,000,000,000
- Fits in uint64 (max: 18 quintillion)
- **Solution: Use euint64 for intermediate calculations**

### 5.2 Frontend Features

**Tech Stack:**
- **React 19**
- **next.js 16** (App Router)
- Tailwind CSS
- fhevmjs (FHE encryption)
- ethers.js v6 (blockchain)
- wagmi + RainbowKit (wallet)
- react-leaflet (map)
- pannellum.js or similar (360° viewer)

**Pages:**

**1. Landing Page (`/`)**
- Hero section with title and description
- "Join Game" button (prominent)
- Brief explanation: "Guess locations privately using FHE"
- Footer with links

**2. Game Page (`/game`)**
- Top 60%: 360° panorama viewer (loads from URL)
- Bottom 40%: Action area
- Timer: "2:00" countdown
- Before guess: "Make Your Guess" button
- After guess: "Waiting for round to end..."
- After reveal: "You were X km away!"
- [Optional] Leaderboard section

**Map Modal:**
- Opens when "Make Your Guess" clicked
- Simple world map (centered, zoom level 2)
- Click to place marker
- "Submit Guess" button
- Close/cancel option

### 5.3 Minimal UI Components

**Landing Page:**
- Logo/title
- Subtitle: "Privacy-preserving geography game"
- "Join Game" CTA button
- How it works (3 simple steps)
- Powered by Zama FHE badge

**Game Page Header:**
- Logo (links back to landing)
- Wallet address (shortened)
- Timer: "Ends in: 1:32"

**Panorama Viewer:**
- Full-width embed (loads from URL)
- Minimal controls (just drag to rotate)
- URL fetched from contract

**Action Area:**
- 1 button: "Make Your Guess" (if not guessed yet)
- OR: Status text: "Guess submitted! ⏳ Waiting..."
- OR: Result: "You were 847 km away! 🎯"

**Leaderboard (Optional - Simple Table):**
```
Rank | Player      | Distance
1    | 0x742d...   | 124 km
2    | 0x8f3a...   | 847 km  ← You
3    | 0x9b12...   | 1,203 km
```

---

## 6. Technical Architecture (High-Level)

### 6.1 Smart Contract

**Language:** Solidity 0.8.24  
**Library:** fhEVM (Zama)  
**Network:** Sepolia Testnet

**Key Data Structures:**
- Round struct:
  - id
  - panoramaUrl (string - external URL)
  - encryptedLatitude (euint64 or euint128)
  - encryptedLongitude (euint64 or euint128)
  - startTime
  - endTime
  - isRevealed
  
- Guess mapping:
  - roundId => player => GuessData
  - GuessData: encrypted coords (euint64/128) + revealed distance

**Coordinate Format:**
- Store as `euint32` for actual coordinates (scaled by 100,000)
- Cast to `euint64` or `euint128` for calculations
- Example: 41.0082° → 4,100,820 (as euint32)
- When squaring: cast to euint64 to prevent overflow

**Distance Calculation:**
- Simplified Euclidean: `sqrt((lat1-lat2)² + (lon1-lon2)²)`
- Use euint64 or euint128 for squared values
- Convert to km: multiply by 111 (rough approximation)
- No Haversine (too complex for MVP)

### 6.2 Frontend

**Framework:** next.js 16 with App Router  
**React Version:** 19

**File Structure:**
```
/app
  /page.tsx          (landing page)
  /game/page.tsx     (game page)
  /layout.tsx        (root layout)
/components
  /LandingHero.tsx
  /PanoramaViewer.tsx
  /MapModal.tsx
  /ResultDisplay.tsx
  /Leaderboard.tsx (optional)
/lib
  /contract.ts       (contract interactions)
  /fhe.ts            (fhevmjs helpers)
/public
  (static assets)
```

**Key Libraries:**
- fhevmjs - FHE encryption client-side
- ethers.js v6 - Contract interaction
- wagmi + RainbowKit - Wallet connection
- react-leaflet - World map
- pannellum.js - 360° viewer (or similar free alternative)

### 6.3 Deployment

**Smart Contract:**
- Deploy to Sepolia Testnet via Hardhat
- Verify on Etherscan

**Frontend:**
- Deploy to Vercel
- Environment variables for contract address

**360° Panoramas:**
- Host on external service (IPFS, Cloudflare, or simple CDN)
- Store only URLs on-chain (saves gas)

---

## 7. User Stories (MVP Only)

### Story 1: Landing & Join
**As a new player**  
I want to understand the game before jumping in  
So that I know what to expect

**Acceptance Criteria:**
- I see a clear landing page with title
- I see a brief explanation of the game
- I see a prominent "Join Game" button
- Clicking takes me to the game page

---

### Story 2: Make a Guess
**As a player**  
I want to submit my location guess privately  
So that no one can copy me or cheat

**Acceptance Criteria:**
- I can see a 360° panorama (loaded from URL)
- I can open a world map
- I can click once to place my guess
- My coordinates are encrypted before submission
- I see confirmation: "Guess submitted!"
- My guess is locked (cannot change)

---

### Story 3: See My Result
**As a player**  
I want to know how close I was  
So that I can evaluate my geography skills

**Acceptance Criteria:**
- After round ends (2 minutes), I see: "You were X km away"
- Distance is accurate (within reasonable margin)
- I do NOT see the actual location
- Result is displayed clearly

---

### Story 4: View Leaderboard (Optional)
**As a player**  
I want to see how I rank against others  
So that I can compete fairly

**Acceptance Criteria:**
- [If implemented] Leaderboard shows all players
- Sorted by distance (closest first)
- Shows: rank, player address (shortened), distance
- My entry is highlighted

---

## 8. Confirmed Design Decisions

### ✅ Decision 1: Show Actual Location?
**Answer:** **Option A - Never show**
- Pure distance-based competition
- Simplest implementation
- Focus on ranking, not education

### ✅ Decision 2: 360° Content Source?
**Answer:** **Option A - Manual curated**
- 5-10 handpicked locations
- Free 360° panoramas (equirectangular images)
- Hosted externally, URLs stored on-chain
- Full control over quality

### ✅ Decision 3: Round Duration?
**Answer:** **2 minutes** (for demo purposes)
- Fast-paced for demonstration
- Can be adjusted via contract parameter

### ✅ Decision 4: Guess Locking?
**Answer:** **Option A - One guess, locked immediately**
- Locked as soon as submitted
- More strategic gameplay
- Simpler contract logic

### ✅ Decision 5: Smart Contract Network?
**Answer:** **Sepolia Testnet**
- Stable testnet
- Good for demos
- Easy faucet access

### ✅ Decision 6: Frontend Framework?
**Answer:** **React 19 + next.js 16**
- App Router
- Server components where beneficial
- Modern stack

### ✅ Decision 7: Image Storage?
**Answer:** **Off-chain with URL on-chain**
- Images hosted externally (IPFS/CDN)
- Only panoramaUrl stored in contract
- Saves significant gas costs

### ✅ Decision 8: Overflow Prevention?
**Answer:** **Use euint64 or euint128 for calculations**
- Coordinates: euint32
- Intermediate calculations: euint64/euint128
- Prevents overflow during squaring

---

## 9. Success Criteria

### Technical Success
- [ ] Contract deployed on Sepolia Testnet
- [ ] Full round lifecycle works (create → guess → reveal)
- [ ] FHE encryption/decryption functional
- [ ] Distance calculation accurate within 10%
- [ ] No overflow errors in calculations
- [ ] Panorama loads from external URL

### UX Success
- [ ] Player understands game from landing page
- [ ] Can complete full flow in under 3 minutes
- [ ] Clear feedback at each step
- [ ] No confusion about game state
- [ ] 2-minute timer works correctly

### Demo Success
- [ ] 2-minute video showing full gameplay
- [ ] Live URL accessible to judges
- [ ] GitHub repo with README
- [ ] Clear explanation of FHE value proposition

---

## 10. Development Timeline

### Day 1: Smart Contract (8 hours)
- Setup Hardhat + fhEVM for Sepolia
- Write contract:
  - Round management with panoramaUrl
  - Guess submission (euint64/128 coords)
  - FHE distance calculation with overflow protection
- Basic tests with known coordinates
- Deploy to Sepolia
- Verify contract on Etherscan

### Day 2: Frontend Core (9 hours)
- next.js 16 setup with App Router
- Landing page with Join button
- Game page structure
- Wallet connection (RainbowKit)
- Contract integration (read/write)
- 360° panorama embed (loads from contract URL)
- World map with click-to-guess
- Guess submission with fhevmjs encryption
- Basic Tailwind styling

### Day 3: Integration & Polish (8 hours)
- Distance results display
- [If time] Leaderboard implementation
- 2-minute timer countdown
- Bug fixes and edge cases
- Responsive layout
- Deploy frontend to Vercel
- Test end-to-end on Sepolia
- Record video demo
- Write documentation

**Total: 25 hours over 2.5 days**

---

## 11. Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| fhevmjs integration issues | High | Study Zama docs first, test early |
| Overflow in distance calc | High | Use euint64/euint128 for intermediates |
| Sepolia testnet issues | Medium | Have backup local dev environment |
| 360° viewer not working | Low | Fallback: simple static image viewer |
| Distance calculation inaccurate | Medium | Test with known locations, adjust formula |
| 2-minute rounds too short for testing | Low | Use longer duration for testing, 2min for final demo |

---

## 12. Technical Considerations

### Overflow Prevention Strategy

**Problem:**
- Coordinates stored as euint32 (max ~4.2 billion)
- Squaring can overflow: 4,200,000,000² = ~17.6 × 10^18
- euint32 max: ~4.2 × 10^9

**Solution:**
1. Store coordinates as euint32 (saves gas)
2. Cast to euint64 before squaring
3. Perform calculations in euint64 space
4. euint64 max: ~1.8 × 10^19 (safe for our use case)

**Alternative:** Use euint128 if extra safety margin needed

### Distance Formula Accuracy

**Euclidean vs Haversine:**
- Euclidean: Fast, simple, ~5-10% error at large distances
- Haversine: Accurate, but requires trig functions (sin, cos, sqrt)
- MVP Decision: Use Euclidean, acceptable for game purposes

**Conversion Factor:**
- 1° latitude ≈ 111 km (constant)
- 1° longitude ≈ 111 km × cos(latitude) (varies)
- MVP: Use simple 111 km factor (acceptable error for demo)

---

## 13. Out of Scope (Future Iterations)

**v2 Features (if MVP succeeds):**
- Multiple simultaneous rounds
- User-generated content (upload own panoramas)
- Prize pools / betting
- NFT achievements
- Mobile app
- Haversine distance formula
- Show actual location toggle
- Round history
- Player profiles and stats
- Difficulty settings (zoom restrictions, time bonuses)
- Multiplayer rooms
- Country/region filters

---

## 14. Key Messages for Judges

**Pitch:**
"FHE GeoGuessr proves that blockchain gaming can be both fun AND fair. By using Zama's Fully Homomorphic Encryption, we've built the first cheat-proof geography game where your guesses stay private until the big reveal."

**FHE Showcase:**
- Real coordinates: encrypted on-chain
- Player guesses: encrypted
- Distance calculation: performed on encrypted data (with overflow protection!)
- Zero knowledge until reveal
- Uses euint64/euint128 for safe arithmetic

**Differentiation:**
- Not another voting DAO
- Real gaming use case
- Easy to understand and demo
- Addresses actual problem (cheating in online games)
- Clean implementation with modern stack (next.js 16, React 19)

**Technical Highlights:**
- Proper overflow handling (euint32 → euint64 casting)
- Off-chain image storage (gas efficient)
- Clean separation: landing page → game page
- 2-minute rounds (perfect for demos)

---

## 15. Deliverables

**Code:**
- Smart contract (Solidity) - Sepolia
- Frontend (next.js 16 + React 19)
- Deployment scripts
- Tests

**Documentation:**
- README with setup instructions
- Architecture overview
- FHE implementation explanation
- Overflow handling documentation
- Demo video (2 minutes)

**Demo:**
- Live deployment URL
- 1 curated test locations with URLs
- Working end-to-end flow
- Sepolia testnet deployment

---

## 16. Final Checklist Before Development

**Confirmed Decisions:**
- ✅ Network: Sepolia Testnet
- ✅ Frontend: React 19 + next.js 16
- ✅ Landing page → Game page flow
- ✅ Never show actual location
- ✅ 2-minute rounds
- ✅ One guess, locked
- ✅ Manual curated panoramas (URLs)
- ✅ Use euint64/euint128 for overflow prevention
- ✅ Leaderboard: nice-to-have (if time permits)

**Ready to Start:**
1. Setup Hardhat for Sepolia
2. Find/prepare 1 free 360° panoramas
3. Create next.js 16 project
4. Begin contract development

---

**All clarifications addressed. Ready to build! 🚀**