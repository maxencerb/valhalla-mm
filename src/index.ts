import { parseEther, parseUnits } from "viem";
import { getBalances } from "./balances";
import { client } from "./config";
import { marketOrder } from "./market-order";
import { BS, Order } from "@mangrovedao/mgv/lib";
import { cancelLimitOrder, limitOrder } from "./limit-order";

const markets = await client.getOpenMarkets({
  cashnesses: { USDC: 1000 },
});

// const balances = await getBalances(markets);
const MEGA_USDC = markets[1]!;

// // buy 1 MEGA for USDC
// await marketOrder({
//   fillVolume: parseEther("1"),
//   fillWants: true, // I want to buy 1 MEGA
//   market: MEGA_USDC,
//   bs: BS.buy, // buy
//   maxPrice: 100, // max price of 100 USDC per MEGA
// });

// // Buy MEGA with 1 USDC
// await marketOrder({
//   fillVolume: parseUnits("1", MEGA_USDC.quote.decimals), // 6 decimals for USDC
//   fillWants: false, // I want to buy with 1 USDC
//   market: MEGA_USDC,
//   bs: BS.buy, // buy
//   maxPrice: 100, // max price of 100 USDC per MEGA
// });

const { result } = await limitOrder({
  market: MEGA_USDC,
  bs: BS.sell,
  fillVolume: parseUnits("13.38", MEGA_USDC.base.decimals),
  fillWants: false,
  price: 1450,
  orderType: Order.GTC, 
});

// if (result.offer) {
// await cancelLimitOrder({
//   market: MEGA_USDC,
//   bs: BS.buy,
//   offerId: 6195n,
//   deprovision: true,
// });
// }
