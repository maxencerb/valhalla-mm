import {
  mangroveActions,
  type MangroveActionsDefaultParams,
} from "@mangrovedao/mgv";
import {
  createWalletClient,
  http,
  publicActions,
  type Hex,
  type WriteContractParameters,
  type TransactionReceipt,
  nonceManager,
  encodeFunctionData,
  formatTransactionReceipt,
  type Chain,
  type Account,
  type ContractFunctionName,
  type ContractFunctionArgs,
  type Abi,
  parseEther,
  type Hash,
} from "viem";
import { parseAccount, privateKeyToAccount } from "viem/accounts";
import { defaultPrepareTransactionRequestParameters } from "viem/actions";
import { megaethTestnet } from "viem/chains";

export const params = {
  mgv: "0x32360BB61fcb9cDCDD44eD44328b848061c0b9D7",
  mgvOrder: "0x981Bd234dA6778a6d0132364AfB30f517a9F5aa8",
  routerProxyFactory: "0x9DB89FB4B356D480139792Fa2146A408f8944E3a",
  smartRouter: "0x5edE1DD8029e59a0eF80CEB0474B3E8322490220",
  mgvReader: "0xB5C0a4249ee477860D47aD688386F2427F0F072a",
} as const satisfies MangroveActionsDefaultParams;

type MegaethActions<
  chain extends Chain | undefined = Chain | undefined,
  account extends Account | undefined = Account | undefined
> = {
  realtimeWriteContract: <
    const abi extends Abi | readonly unknown[],
    functionName extends ContractFunctionName<abi, "payable" | "nonpayable">,
    args extends ContractFunctionArgs<
      abi,
      "payable" | "nonpayable",
      functionName
    >,
    chainOverride extends Chain | undefined = undefined
  >(
    args: WriteContractParameters<
      abi,
      functionName,
      args,
      chain,
      account,
      chainOverride
    >
  ) => Promise<TransactionReceipt>;
};

export const client = createWalletClient({
  chain: megaethTestnet,
  transport: http(),
  account: privateKeyToAccount(process.env.PRIVATE_KEY as Hex, {
    nonceManager: nonceManager,
  }),
})
  .extend(publicActions)
  .extend(mangroveActions(params))
  .extend(
    (client): MegaethActions<typeof client.chain, typeof client.account> => {
      return {
        realtimeWriteContract: async (
          parameters
        ): Promise<TransactionReceipt> => {
          const {
            abi,
            account: account_ = client.account,
            address: to,
            args,
            dataSuffix,
            functionName,
            accessList,
            authorizationList,
            blobs,
            chain,
            gas,
            gasPrice,
            maxFeePerBlobGas,
            maxFeePerGas,
            maxPriorityFeePerGas,
            nonce,
            type,
            value,
            ...request
          } = parameters as WriteContractParameters;

          const account = account_ ? parseAccount(account_) : null;

          const data = encodeFunctionData({
            abi,
            functionName,
            args,
          });

          // assume local account type

          const prepared = await client.prepareTransactionRequest({
            account,
            accessList,
            authorizationList,
            blobs,
            chain,
            data,
            gas,
            gasPrice,
            maxFeePerBlobGas,
            maxFeePerGas,
            maxPriorityFeePerGas,
            nonce,
            nonceManager: account?.nonceManager,
            parameters: [
              ...defaultPrepareTransactionRequestParameters,
              "sidecars",
            ],
            type,
            value,
            to,
            ...request,
          } as any);
          const serializer = chain?.serializers?.transaction;
          const serializedTransaction = (await client.account.signTransaction(
            prepared,
            {
              serializer,
            }
          )) as Hash;
          const result = await client.request({
            method: "realtime_sendRawTransaction" as any,
            params: [serializedTransaction],
          });
          return formatTransactionReceipt(result as any);
        },
      };
    }
  );
