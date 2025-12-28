# DEX AMM Project
## Overview
- This project implements a simplified Decentralized Exchange (DEX) based on the Automated Market Maker (AMM) model, inspired by Uniswap V2.
- The DEX allows users to trade two ERC-20 tokens directly from a liquidity pool without relying on order books or centralized intermediaries.

- Liquidity providers can deposit token pairs into the pool, receive LP (Liquidity Provider) shares representing their ownership, and earn trading fees generated from swaps.
- All logic is implemented in Solidity and tested using Hardhat with full Docker support.

## Features
- Initial and subsequent liquidity provision
- Liquidity removal with proportional share calculation
- Token swaps using constant product formula (x * y = k)
- 0.3% trading fee distributed to liquidity providers
- LP token minting and burning (implemented internally)
- Deterministic pricing based on pool reserves
- Full test coverage with edge-case handling
- Dockerized development and testing environment

## Architecture
### Contract Structure
- DEX.sol
  - Core AMM logic
  - Manages reserves, swaps, fees, and LP accounting
  - Tracks liquidity providers via internal mapping

- MockERC20.sol
  - Simple ERC-20 token used for testing
  - Allows minting tokens for test scenarios

### Design Decisions
- LP tokens are implemented internally using a mapping(address => uint256) instead of a separate ERC-20 contract to reduce complexity.
- Exact ratio enforcement is used for subsequent liquidity additions to preserve price consistency.
- Reserves are tracked explicitly instead of relying on token balances to avoid state inconsistencies.
- Uses OpenZeppelin’s SafeERC20 and ReentrancyGuard for security.

## Mathematical Implementation
- Constant Product Formula
- The DEX uses the constant product invariant:
```
x * y = k
```
- Where:
  - x = reserve of Token A
  - y = reserve of Token B
  - k = constant value that should not decrease
- After each swap, reserves are updated such that the product k remains the same or increases slightly due to fees, ensuring liquidity providers benefit over time.

## Fee Calculation
- Each swap applies a 0.3% fee on the input amount.
- Formula used:
```
amountInWithFee = amountIn * 997
numerator = amountInWithFee * reserveOut
denominator = (reserveIn * 1000) + amountInWithFee
amountOut = numerator / denominator
```
- 99.7% of the input is used for price calculation
- 0.3% remains in the pool
- Fees are not transferred explicitly; they increase pool reserves, benefiting LPs proportionally 

## LP Token Minting
- Initial Liquidity (First Provider)
- The first liquidity provider sets the initial price and receives LP tokens calculated as:
```
liquidityMinted = sqrt(amountA * amountB)
```
- Subsequent Liquidity Providers
- Subsequent providers must add liquidity in the same ratio as current reserves:
```
liquidityMinted = (amountA * totalLiquidity) / reserveA
```
- This ensures fair proportional ownership without diluting existing LPs.

## Setup Instructions
### Prerequisites
- Docker and Docker Compose installed
- Git

### Installation
- Clone the repository:
```
git clone https://github.com/marlabharghavsai/dex-amm
cd dex-amm
```
- Start Docker environment:
```
docker-compose up -d
```
- Compile contracts:
```
docker-compose exec app npm run compile
```
- Run tests:
```
docker-compose exec app npm test
```
- Check coverage:
```
docker-compose exec app npm run coverage
```
- Stop Docker:
```
docker-compose down
```
- Running Tests Locally (without Docker)
```
npm install
npm run compile
npm test
```

## Contract Addresses

- This project is evaluated using a local Hardhat network.
- No public testnet deployment is required.
- If deployed externally in the future, contract addresses and block explorer links can be added here.

## Known Limitations
- Supports only a single token pair
- No slippage protection (minAmountOut) implemented
- No deadline parameter for swaps
- Direct token transfers to the DEX contract are not tracked in reserves
- No front-running mitigation mechanisms
- These limitations are intentional to keep the implementation focused on core AMM concepts.

## Security Considerations
- Uses ReentrancyGuard to prevent reentrancy attacks
- Uses SafeERC20 for all token transfers
- Validates all user inputs (non-zero amounts, sufficient liquidity)
- Solidity 0.8+ overflow/underflow protections enabled
- Reserves updated before external transfers where applicable
- No privileged admin functions or backdoors

## Final Notes
- All required test cases pass (27 tests)
- Code coverage exceeds 97%
- Docker environment builds and runs successfully
- Function signatures and event emissions strictly follow requirements
- This implementation demonstrates a complete, secure, and test-driven AMM-based DEX suitable for educational and evaluation purposes.
