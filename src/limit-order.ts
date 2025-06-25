import type { Book, MarketParams } from "@mangrovedao/mgv";
import {
  BS,
  getSemibooksOLKeys,
  humanPriceToRawPrice,
  limitOrderResultFromLogs,
  Order,
  removeOrderResultFromLogs,
  tickFromPrice,
} from "@mangrovedao/mgv/lib";
import { maxUint128, zeroAddress, type Address } from "viem";
import { client, params } from "./config";
import { getApprovals, giveApprovalTo } from "./approval";
import {
  rawLimitOrderParams,
  removeOrderParams,
} from "@mangrovedao/mgv/builder";
import { getBook } from "@mangrovedao/mgv/actions";

/**
 * @notice Parameters for placing a limit order on Mangrove protocol
 * @param market The market to trade on (base/quote token pair)
 * @param bs Buy/Sell direction - BS.buy for buying base token, BS.sell for selling base token
 * @param fillVolume The volume to trade in wei (smallest unit of the token)
 * @param fillWants If true, fillVolume represents the amount of the asset you want to buy.
 *                  If false, fillVolume represents the amount of the asset you want to sell.
 * @param price The limit price for the order (human-readable format)
 * @param orderType Order type - Order.GTC (Good Till Cancelled) or Order.PO (Post Only)
 * @param skipApprovalCheck If true, skips the token approval check. Useful for custom approval logic, or for faster execution.
 * @param baseTokenLogic Custom logic contract address for base token (default: zeroAddress)
 * @param quoteTokenLogic Custom logic contract address for quote token (default: zeroAddress)
 * @param userRouter User router address (auto-detected if not provided)
 * @param book Market book data (auto-fetched if not provided)
 * @param restingOrderGasreq Gas requirement for resting order (default: 1,000,000)
 * @param expiryDate Order expiry timestamp in seconds (optional)
 * @param value ETH value to send with transaction (optional)
 */
type LimitOrderProps = {
  market: MarketParams;
  bs: BS;
  fillVolume: bigint;
  fillWants: boolean;
  price: number;
  orderType?: Order;
  skipApprovalCheck?: boolean;
  baseTokenLogic?: Address;
  quoteTokenLogic?: Address;
  userRouter?: Address;
  book?: Book;
  restingOrderGasreq?: bigint;
  expiryDate?: bigint;
  value?: bigint;
};

/**
 * @notice Places a limit order on the Mangrove protocol
 * @dev This function handles token approvals automatically unless skipApprovalCheck is true.
 *      It converts human-readable prices to ticks and places the order through the realtime API.
 *      The order can be either Good Till Cancelled (GTC) or Post Only (PO).
 * @param props LimitOrderProps object containing all order parameters
 * @returns Promise<{receipt: any, result: any}> Transaction receipt and order result with offer details
 * @throws Error if limit order fails or approval fails
 * 
 * @example
 * ```typescript
 * // Place a buy limit order for 10 MEGA at 0.1 USDC per MEGA
 * const { result } = await limitOrder({
 *   market: MEGA_USDC,
 *   bs: BS.buy,
 *   fillVolume: parseEther("10"),
 *   fillWants: true,
 *   price: 0.1,
 *   orderType: Order.PO, // Post only order
 * });
 * 
 * // Place a sell limit order for 5 MEGA at 0.2 USDC per MEGA
 * const { result } = await limitOrder({
 *   market: MEGA_USDC,
 *   bs: BS.sell,
 *   fillVolume: parseEther("5"),
 *   fillWants: true,
 *   price: 0.2,
 *   orderType: Order.GTC, // Good till cancelled
 * });
 * ```
 */
export async function limitOrder(props: LimitOrderProps) {
  const {
    market,
    bs,
    fillVolume,
    fillWants,
    price,
    skipApprovalCheck = false,
    orderType = Order.GTC,
    // for custom approval logic, skip approval check and give the approval for the designed logic
    // Approval could be from overlying tokens for example (morpho erc4626, aave, ...)
    baseTokenLogic = zeroAddress,
    quoteTokenLogic = zeroAddress,
    userRouter = await client.getUserRouter({ user: client.account.address }),
    book = await getBook(client, params, market, { depth: 1n }),
    restingOrderGasreq = 1_000_000n, // 1M gas
    expiryDate,
    value,
  } = props;

  if (!skipApprovalCheck) {
    const token = bs === BS.buy ? market.quote.address : market.base.address;
    const [approval] = await getApprovals([{ token, spender: userRouter }]);
    if (approval!.allowance < maxUint128) {
      const receipt = await giveApprovalTo(token, params.mgv);
      console.log(
        `Approval for mangrove given for token ${token} as block ${receipt.blockNumber}: ${receipt.transactionHash}`
      );
    }
  }

  const olKeys = getSemibooksOLKeys(market);
  const olKey = bs === BS.buy ? olKeys.asksMarket : olKeys.bidsMarket;

  const rawPrice = humanPriceToRawPrice(price, market);
  // convert to tick
  let tick = tickFromPrice(rawPrice, market.tickSpacing);
  // reverse tick on buy
  if (bs === BS.buy) {
    tick = -tick;
  }

  const rawParams = rawLimitOrderParams({
    olKey,
    tick,
    restingOrderGasreq,
    localConfig: bs === BS.buy ? book.bidsConfig : book.asksConfig,
    globalConfig: book.marketConfig,
    fillVolume,
    fillWants,
    orderType,
    takerGivesLogic: bs === BS.buy ? quoteTokenLogic : baseTokenLogic,
    takerWantsLogic: bs === BS.buy ? baseTokenLogic : quoteTokenLogic,
    expiryDate,
    value,
  });

  const receipt = await client.realtimeWriteContract({
    address: params.mgvOrder,
    ...rawParams,
  });

  if (receipt.status === "reverted") {
    throw new Error("Limit order failed");
  }

  const result = limitOrderResultFromLogs(params, market, {
    logs: receipt.logs,
    user: client.account.address,
    bs,
  });

  console.log(
    `Got: ${result.takerGot}, Gave: ${result.takerGave}, Fee: ${result.feePaid}, Bounty: ${result.bounty}\n`,
    result.offer
      ? `Limit order offer posted with id ${result.offer.id}, tick ${result.offer.tick}, gives ${result.offer.gives}, wants ${result.offer.wants}, gasprice ${result.offer.gasprice}, gasreq ${result.offer.gasreq}, expiry ${result.offer.expiry}\n`
      : "",
    `block ${receipt.blockNumber}: ${receipt.transactionHash}`
  );

  return { receipt, result };
}

/**
 * @notice Parameters for cancelling a limit order on Mangrove protocol
 * @param market The market where the order was placed
 * @param bs Buy/Sell direction of the order to cancel
 * @param offerId The unique ID of the offer to cancel
 * @param deprovision Whether to deprovision the offer (default: true)
 */
type CancelLimitOrderProps = {
  market: MarketParams;
  bs: BS;
  offerId: bigint;
  deprovision?: boolean;
};

/**
 * @notice Cancels an existing limit order on the Mangrove protocol
 * @dev This function removes the order from the order book and optionally deprovisions it.
 *      Deprovisioning returns any locked funds associated with the order.
 * @param props CancelLimitOrderProps object containing cancellation parameters
 * @returns Promise<{receipt: any, result: any}> Transaction receipt and cancellation result
 * @throws Error if cancellation fails
 * 
 * @example
 * ```typescript
 * // Cancel a limit order and deprovision it
 * await cancelLimitOrder({
 *   market: MEGA_USDC,
 *   bs: BS.buy,
 *   offerId: result.offer.id,
 *   deprovision: true,
 * });
 * 
 * // Cancel without deprovisioning (keeps funds locked)
 * await cancelLimitOrder({
 *   market: MEGA_USDC,
 *   bs: BS.sell,
 *   offerId: offerId,
 *   deprovision: false,
 * });
 * ```
 */
export async function cancelLimitOrder(props: CancelLimitOrderProps) {
  const { market, bs, offerId, deprovision = true } = props;
  const rawParams = removeOrderParams(market, {
    bs,
    offerId,
    deprovision,
  });

  const receipt = await client.realtimeWriteContract({
    address: params.mgvOrder,
    ...rawParams,
  });

  if (receipt.status === "reverted") {
    throw new Error("Limit order cancellation failed");
  }

  const result = removeOrderResultFromLogs(params, market, {
    logs: receipt.logs,
    offerId,
    bs,
  });

  console.log(
    result.success
      ? `Limit order offer deprovisioned with id ${offerId}, deprovision ${deprovision}\n`
      : `Limit order offer not found with id ${offerId}\n`,
    `block ${receipt.blockNumber}: ${receipt.transactionHash}`
  );

  return { receipt, result };
}
