import { erc20Abi, maxUint256, parseEther, type Address } from "viem";
import { client } from "./config";

type ApprovalProps = Array<{
  token: Address;
  spender: Address;
}>;

type ApprovalResult = Array<{
  token: Address;
  spender: Address;
  allowance: bigint;
}>;

export async function getApprovals(
  props: ApprovalProps
): Promise<ApprovalResult> {
  return client
    .multicall({
      contracts: props.map(
        ({ token, spender }) =>
          ({
            address: token,
            abi: erc20Abi,
            functionName: "allowance",
            args: [client.account.address, spender],
          } as const)
      ),
      allowFailure: false,
    })
    .then((results) =>
      results.map((allowance, index) => ({
        token: props[index]!.token,
        spender: props[index]!.spender,
        allowance,
      }))
    );
}

export async function giveApprovalTo(
  token: Address,
  spender: Address,
  amount = maxUint256
) {
  const receipt = await client.realtimeWriteContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
  });
  if (receipt.status === "reverted") {
    throw new Error("Approval failed");
  }
  return receipt
}