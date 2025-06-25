# Valhalla Market Making Bot

A TypeScript-based market making bot for the Mangrove protocol, built with real-time trading capabilities.

## Installation

1. Install dependencies:
```bash
bun install
```

2. Set up your environment variable:
```bash
export PRIVATE_KEY="your_private_key_here"
```

Make sure to replace `your_private_key_here` with your actual private key for the wallet you want to use for trading.

## Main Functions

### marketOrder

Executes a market order on the Mangrove protocol.

**Parameters:**
- `market` (MarketParams): The market to trade on
- `bs` (BS): Buy/Sell direction - use `BS.buy` or `BS.sell`
- `fillVolume` (bigint): The volume to trade (in wei)
- `fillWants` (boolean): 
  - `true`: Fill the specified volume of the asset you want to buy
  - `false`: Fill the specified volume of the asset you want to sell
- `maxPrice` (number, optional): Maximum price limit for the order
- `skipApprovalCheck` (boolean, optional): Skip token approval check (default: false)

**Example:**
```typescript
// Buy 1 MEGA for USDC
await marketOrder({
  fillVolume: parseEther("1"),
  fillWants: true, // I want to buy 1 MEGA
  market: MEGA_USDC,
  bs: BS.buy,
  maxPrice: 100, // max price of 100 USDC per MEGA
});
```

### limitOrder

Places a limit order on the Mangrove protocol.

**Parameters:**
- `market` (MarketParams): The market to trade on
- `bs` (BS): Buy/Sell direction - use `BS.buy` or `BS.sell`
- `fillVolume` (bigint): The volume to trade (in wei)
- `fillWants` (boolean): 
  - `true`: Fill the specified volume of the asset you want to buy
  - `false`: Fill the specified volume of the asset you want to sell
- `price` (number): The limit price for the order
- `orderType` (Order, optional): Order type - `Order.GTC` (Good Till Cancelled) or `Order.PO` (Post Only) (default: GTC)
- `skipApprovalCheck` (boolean, optional): Skip token approval check (default: false)
- `baseTokenLogic` (Address, optional): Custom logic for base token (default: zeroAddress)
- `quoteTokenLogic` (Address, optional): Custom logic for quote token (default: zeroAddress)
- `userRouter` (Address, optional): User router address (auto-detected if not provided)
- `book` (Book, optional): Market book data (auto-fetched if not provided)
- `restingOrderGasreq` (bigint, optional): Gas requirement for resting order (default: 1,000,000)
- `expiryDate` (bigint, optional): Order expiry timestamp
- `value` (bigint, optional): ETH value to send with transaction

**Example:**
```typescript
const { result } = await limitOrder({
  market: MEGA_USDC,
  bs: BS.buy,
  fillVolume: parseEther("10"),
  fillWants: true,
  price: 0.1,
  orderType: Order.PO, // Post only order
});
```

### cancelLimitOrder

Cancels an existing limit order.

**Parameters:**
- `market` (MarketParams): The market where the order was placed
- `bs` (BS): Buy/Sell direction of the order to cancel
- `offerId` (bigint): The ID of the offer to cancel
- `deprovision` (boolean, optional): Whether to deprovision the offer (default: true)

**Example:**
```typescript
await cancelLimitOrder({
  market: MEGA_USDC,
  bs: BS.buy,
  offerId: result.offer.id,
  deprovision: true,
});
```

## Helper Functions

### getBalances

Fetches token balances for all markets.

**Parameters:**
- `markets` (MarketParams[]): Array of markets to check balances for

**Returns:** Map<Address, bigint> - Token address to balance mapping

### getApprovals

Checks token approval allowances for specified tokens and spenders.

**Parameters:**
- `props` (Array<{token: Address, spender: Address}>): Array of token-spender pairs to check

**Returns:** Array<{token: Address, spender: Address, allowance: bigint}>

### giveApprovalTo

Grants approval to a spender for a specific token.

**Parameters:**
- `token` (Address): Token address to approve
- `spender` (Address): Spender address to approve
- `amount` (bigint, optional): Approval amount (default: maxUint256)

**Returns:** Transaction receipt

## Important Notes

⚠️ **Realtime API Dependency**: This script relies on the realtime API of MegaETH for optimal performance and immediate order execution. The realtime API ensures that your market making bot can respond quickly to market changes and execute orders with minimal latency.

## Dependencies

- `@mangrovedao/mgv`: Mangrove protocol SDK
- `viem`: Ethereum client library
- `bun`: JavaScript runtime and package manager
