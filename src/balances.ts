import type { MarketParams } from "@mangrovedao/mgv";
import { client } from "./config";
import { erc20Abi, type Address } from "viem";

export async function getBalances(
  markets: MarketParams[]
): Promise<Map<Address, bigint>> {
  const balances = new Map<Address, bigint>();
  const results = await client.multicall({
    contracts: markets.flatMap(
      (market) =>
        [
          {
            address: market.base.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [client.account.address],
          },
          {
            address: market.quote.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [client.account.address],
          },
        ] as const
    ),
    allowFailure: false,
  });
  for (let i = 0; i < results.length; i += 2) {
    const market = markets[i / 2]!;
    const baseBalance = results[i]!;
    const quoteBalance = results[i + 1]!;
    balances.set(market.base.address, baseBalance);
    balances.set(market.quote.address, quoteBalance);
  }
  return balances;
}
