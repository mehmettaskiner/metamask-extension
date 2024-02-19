import { addHexPrefix } from 'ethereumjs-util';
import abi from 'human-standard-token-abi';
import { TransactionEnvelopeType } from '@metamask/transaction-controller';
import { GAS_LIMITS } from '../../../shared/constants/gas';
import { calcTokenAmount } from '../../../shared/lib/transactions-controller-utils';
import { CHAIN_ID_TO_GAS_LIMIT_BUFFER_MAP } from '../../../shared/constants/network';
import {
  AssetType,
  TokenStandard,
} from '../../../shared/constants/transaction';
import { readAddressAsContract } from '../../../shared/modules/contract-utils';
import { getBlockGasLimit } from '../../../shared/modules/gas.utils';
import {
  addGasBuffer,
  generateERC20TransferData,
  generateERC721TransferData,
  generateERC1155TransferData,
  getAssetTransferData,
} from '../../pages/confirmations/send/send.utils';
import { getGasPriceInHexWei } from '../../selectors';
import { estimateGasBuffered } from '../../store/actions';
import { Numeric } from '../../../shared/modules/Numeric';

export async function estimateGasLimitForSend({
  selectedAddress,
  value,
  gasPrice,
  sendToken,
  to,
  data,
  isNonStandardEthChain,
  chainId,
}) {
  if (sendToken && !to) {
    // If no to address is provided, we cannot generate the token transfer
    // hexData. hexData in a transaction largely dictates how much gas will
    // be consumed by a transaction. We must use our best guess, which is
    // represented in the gas shared constants.
    return GAS_LIMITS.BASE_TOKEN_ESTIMATE;
  }

  let isSimpleSendOnNonStandardNetwork = false;

  // The parameters below will be sent to our background process to estimate
  // how much gas will be used for a transaction. That background process is
  // located in tx-gas-utils.js in the transaction controller folder.
  const paramsForGasEstimate = {
    from: selectedAddress,
    value: sendToken ? '0x0' : value,
    gasPrice,
    to: sendToken ? sendToken.address : to,
  };

  if (sendToken) {
    // We have to generate the erc20/erc721 contract call to transfer tokens in
    // order to get a proper estimate for gasLimit.
    paramsForGasEstimate.data = getAssetTransferData({
      sendToken,
      fromAddress: selectedAddress,
      toAddress: to,
      amount: value,
    });
  } else {
    if (!data) {
      const { isContractAddress } = to
        ? await readAddressAsContract(global.eth, to)
        : {};
      if (!isContractAddress && !isNonStandardEthChain) {
        return GAS_LIMITS.SIMPLE;
      } else if (!isContractAddress && isNonStandardEthChain) {
        isSimpleSendOnNonStandardNetwork = true;
      }
    }
    paramsForGasEstimate.data = data;
    if (!value || value === '0') {
      paramsForGasEstimate.value = '0xff';
    }
  }

  // The buffer multipler reduces transaction failures by ensuring that the
  // estimated gas is always sufficient. Without the multiplier, estimates
  // for contract interactions can become inaccurate over time. This is because
  // gas estimation is non-deterministic. The gas required for the exact same
  // transaction call can change based on state of a contract or changes in the
  // contracts environment (blockchain data or contracts it interacts with).
  // Applying the 1.5 buffer has proven to be a useful guard against this non-
  // deterministic behaviour.
  //
  // Gas estimation of simple sends should, however, be deterministic. As such
  // no buffer is needed in those cases.
  let bufferMultiplier = 1.5;
  if (isSimpleSendOnNonStandardNetwork) {
    bufferMultiplier = 1;
  } else if (CHAIN_ID_TO_GAS_LIMIT_BUFFER_MAP[chainId]) {
    bufferMultiplier = CHAIN_ID_TO_GAS_LIMIT_BUFFER_MAP[chainId];
  }

  try {
    const { gas } = await estimateGasBuffered(
      paramsForGasEstimate,
      bufferMultiplier,
    );
    return gas;
  } catch (error) {
    if (error.simulationFails) {
      const blockGasLimit = await getBlockGasLimit(global.ethQuery);
      const estimateWithBuffer = addGasBuffer(
        error.gas,
        blockGasLimit,
        bufferMultiplier,
      );
      return addHexPrefix(estimateWithBuffer);
    }
    throw error;
  }
}

/**
 * Generates a txParams from the send slice.
 *
 * @param {import('.').SendState} sendState - the state of the send slice
 * @returns {import('@metamask/transaction-controller').TransactionParams} A txParams object that can be used to create a transaction or
 *  update an existing transaction.
 */
export function generateTransactionParams(sendState) {
  const draftTransaction =
    sendState.draftTransactions[sendState.currentTransactionUUID];

  const txParams = {
    // If the fromAccount has been specified we use that, if not we use the
    // selected account.
    from:
      draftTransaction.fromAccount?.address ||
      sendState.selectedAccount.address,
    // gasLimit always needs to be set regardless of the asset being sent
    // or the type of transaction.
    gas: draftTransaction.gas.gasLimit,
  };

  switch (draftTransaction.asset.type) {
    case AssetType.token:
      // When sending a token the to address is the contract address of
      // the token being sent. The value is set to '0x0' and the data
      // is generated from the recipient address, token being sent and
      // amount.
      txParams.to = draftTransaction.asset.details.address;
      txParams.value = '0x0';
      txParams.data = generateERC20TransferData({
        toAddress: draftTransaction.recipient.address,
        amount: draftTransaction.amount.value,
        sendToken: draftTransaction.asset.details,
      });
      break;

    case AssetType.NFT:
      // When sending a token the to address is the contract address of
      // the token being sent. The value is set to '0x0' and the data
      // is generated from the recipient address, token being sent and
      // amount.
      txParams.to = draftTransaction.asset.details.address;
      txParams.value = '0x0';
      txParams.data =
        draftTransaction.asset.details?.standard === TokenStandard.ERC721
          ? generateERC721TransferData({
              toAddress: draftTransaction.recipient.address,
              fromAddress:
                draftTransaction.fromAccount?.address ??
                sendState.selectedAccount.address,
              tokenId: draftTransaction.asset.details.tokenId,
            })
          : generateERC1155TransferData({
              toAddress: draftTransaction.recipient.address,
              fromAddress:
                draftTransaction.fromAccount?.address ??
                sendState.selectedAccount.address,
              tokenId: draftTransaction.asset.details.tokenId,
              amount: parseInt(draftTransaction.amount.value, 16).toString(),
            });
      break;
    case AssetType.native:
    default:
      // When sending native currency the to and value fields use the
      // recipient and amount values and the data key is either null or
      // populated with the user input provided in hex field.
      txParams.to = draftTransaction.recipient.address;
      txParams.value = draftTransaction.amount.value;
      txParams.data = draftTransaction.userInputHexData ?? undefined;
  }

  // We need to make sure that we only include the right gas fee fields
  // based on the type of transaction the network supports. We will also set
  // the type param here.
  if (sendState.eip1559support) {
    txParams.type = TransactionEnvelopeType.feeMarket;

    txParams.maxFeePerGas = draftTransaction.gas.maxFeePerGas;
    txParams.maxPriorityFeePerGas = draftTransaction.gas.maxPriorityFeePerGas;

    if (!txParams.maxFeePerGas || txParams.maxFeePerGas === '0x0') {
      txParams.maxFeePerGas = draftTransaction.gas.gasPrice;
    }

    if (
      !txParams.maxPriorityFeePerGas ||
      txParams.maxPriorityFeePerGas === '0x0'
    ) {
      txParams.maxPriorityFeePerGas = txParams.maxFeePerGas;
    }
  } else {
    txParams.gasPrice = draftTransaction.gas.gasPrice;
    txParams.type = TransactionEnvelopeType.legacy;
  }

  return txParams;
}

/**
 * This method is used to keep the original logic from the gas.duck.js file
 * after receiving a gasPrice from eth_gasPrice. First, the returned gasPrice
 * was converted to GWEI, then it was converted to a Number, then in the send
 * duck (here) we would use getGasPriceInHexWei to get back to hexWei. Now that
 * we receive a GWEI estimate from the controller, we still need to do this
 * weird conversion to get the proper rounding.
 *
 * @param {string} gasPriceEstimate
 * @returns {string}
 */
export function getRoundedGasPrice(gasPriceEstimate) {
  const gasPriceInDecGwei = new Numeric(gasPriceEstimate, 10)
    .round(9)
    .toString();
  const gasPriceAsNumber = Number(gasPriceInDecGwei);
  return getGasPriceInHexWei(gasPriceAsNumber);
}

export async function getERC20Balance(token, accountAddress) {
  const contract = global.eth.contract(abi).at(token.address);
  const usersToken = (await contract.balanceOf(accountAddress)) ?? null;
  if (!usersToken) {
    return '0x0';
  }
  const amount = calcTokenAmount(
    usersToken.balance.toString(),
    token.decimals,
  ).toString(16);
  return addHexPrefix(amount);
}
