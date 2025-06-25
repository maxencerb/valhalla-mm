import type { MarketParams } from "@mangrovedao/mgv";
import {
  BS,
  getSemibooksOLKeys,
  humanPriceToRawPrice,
  marketOrderResultFromLogs,
  MAX_TICK,
  tickFromPrice,
} from "@mangrovedao/mgv/lib";
import { getApprovals, giveApprovalTo } from "./approval";
import { client, params } from "./config";
import { maxUint128 } from "viem";
import { marketOrderByTickParams } from "@mangrovedao/mgv/builder";

/**
 * @notice Parameters for executing a market order on Mangrove protocol
 * @param market The market to trade on (base/quote token pair)
 * @param bs Buy/Sell direction - BS.buy for buying base token, BS.sell for selling base token
 * @param fillVolume The volume to trade in wei (smallest unit of the token)
 * @param fillWants If true, fillVolume represents the amount of the asset you want to buy.
 *                  If false, fillVolume represents the amount of the asset you want to sell.
 * @param maxPrice Optional maximum price limit for the order. If not provided, no price limit is applied.
 * @param skipApprovalCheck If true, skips the token approval check. Useful for custom approval logic or faster execution.
 */
type MarketOrderProps = {
  market: MarketParams;
  bs: BS;
  fillVolume: bigint;
  fillWants: boolean;
  maxPrice?: number;
  skipApprovalCheck?: boolean;
};

/**
 * @notice Executes a market order on the Mangrove protocol
 * @dev This function handles token approvals automatically unless skipApprovalCheck is true.
 *      It converts human-readable prices to ticks and executes the order through the realtime API.
 * @param props MarketOrderProps object containing all order parameters
 * @returns Promise<{receipt: any, result: any}> Transaction receipt and order result
 * @throws Error if market order fails or approval fails
 * 
 * @example
 * ```typescript
 * // Buy 1 MEGA for USDC
 * const result = await marketOrder({
 *   fillVolume: parseEther("1"),
 *   fillWants: true, // I want to buy 1 MEGA
 *   market: MEGA_USDC,
 *   bs: BS.buy,
 *   maxPrice: 100, // max price of 100 USDC per MEGA
 * });
 * 
 * // Sell MEGA for 1 USDC
 * const result = await marketOrder({
 *   fillVolume: parseUnits("1", 6), // 1 USDC (6 decimals)
 *   fillWants: false, // I want to sell for 1 USDC
 *   market: MEGA_USDC,
 *   bs: BS.sell,
 *   maxPrice: 0.01, // min price of 0.01 USDC per MEGA
 * });
 * ```
 */
export async function marketOrder(props: MarketOrderProps) {
  const {
    market,
    bs,
    fillVolume,
    fillWants,
    maxPrice,
    skipApprovalCheck = false,
  } = props;
  const maxTick = (() => {
    if (!maxPrice) return MAX_TICK;
    // adjust for decimals
    const rawPrice = humanPriceToRawPrice(maxPrice, market);
    // convert to tick
    const tick = tickFromPrice(rawPrice, market.tickSpacing);
    // reverse tick on buy
    return bs === BS.buy ? -tick : tick;
  })();

  if (!skipApprovalCheck) {
    const token = bs === BS.buy ? market.quote.address : market.base.address;
    const [approval] = await getApprovals([{ token, spender: params.mgv }]);
    if (approval!.allowance < maxUint128) {
      const receipt = await giveApprovalTo(token, params.mgv);
      console.log(
        `Approval for mangrove given for token ${token} as block ${receipt.blockNumber}: ${receipt.transactionHash}`
      );
    }
  }

  const olKeys = getSemibooksOLKeys(market);
  const olKey = bs === BS.buy ? olKeys.asksMarket : olKeys.bidsMarket;

  const receipt = await client.realtimeWriteContract({
    address: params.mgv,
    ...marketOrderByTickParams({
      olKey,
      fillVolume,
      fillWants,
      maxTick,
    }),
  });

  if (receipt.status === "reverted") {
    throw new Error("Market order failed");
  }

  const result = marketOrderResultFromLogs(params, market, {
    logs: receipt.logs,
    bs,
    taker: client.account.address,
  });

  console.log(
    `Got: ${result.takerGot}, Gave: ${result.takerGave}, Fee: ${result.feePaid}, Bounty: ${result.bounty}, block ${receipt.blockNumber}: ${receipt.transactionHash}`
  );

  return { receipt, result };
}
