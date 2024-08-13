import { Hex, hexToNumber } from '@metamask/utils';
import { zeroAddress } from 'ethereumjs-util';
import { BigNumber } from '@ethersproject/bignumber';
import {
  BridgeBackgroundAction,
  BridgeUserAction,
} from '../../../app/scripts/controllers/bridge/types';
import { forceUpdateMetamaskState } from '../../store/actions';
import { submitRequestToBackground } from '../../store/background-connection';
import { MetaMaskReduxDispatch } from '../../store/store';
import { QuoteRequest } from '../../pages/bridge/types';
import {
  AssetWithDisplayData,
  ERC20Asset,
  NativeAsset,
} from '../../components/multichain/asset-picker-amount/asset-picker-modal/types';
import { bridgeSlice } from './bridge';

const {
  setToChainId: setToChainId_,
  setFromToken: setFromToken_,
  setToToken: setToToken_,
  setFromTokenInputValue: setFromTokenInputValue_,
  resetInputFields,
  switchToAndFromTokens,
} = bridgeSlice.actions;

export { resetInputFields, switchToAndFromTokens };

// TODO remove this and just write logic out
const mapToQuoteRequestKey = <T extends string>(
  bridgeAction: BridgeUserAction | BridgeBackgroundAction,
  args: T[],
): Partial<QuoteRequest> => {
  switch (bridgeAction) {
    // TODO delete this statement and read controller instead
    case BridgeUserAction.SELECT_SRC_NETWORK:
      return { srcChainId: hexToNumber(args[0]) };
    case BridgeUserAction.SELECT_DEST_NETWORK:
      return { destChainId: hexToNumber(args[0]) };
    default:
      return {};
  }
};

const updateQuoteRequestParams = // <T = QuoteRequest extends infer U ? U : never>(
  <T extends Partial<QuoteRequest>>(params: T) => {
    return async (dispatch: MetaMaskReduxDispatch) => {
      console.log('=====updateQuoteRequestParams action', params);
      await submitRequestToBackground(BridgeUserAction.UPDATE_QUOTE_PARAMS, [
        params,
      ]);
      await forceUpdateMetamaskState(dispatch);
    };
  };

const callBridgeControllerMethod = <T extends string>(
  bridgeAction: BridgeUserAction | BridgeBackgroundAction,
  args?: T[],
) => {
  return async (dispatch: MetaMaskReduxDispatch) => {
    if (args) {
      updateQuoteRequestParams(mapToQuoteRequestKey<T>(bridgeAction, args));
    }
    await submitRequestToBackground(bridgeAction, args);
    await forceUpdateMetamaskState(dispatch);
  };
};

// Background actions
export const setBridgeFeatureFlags = () => {
  return async (dispatch: MetaMaskReduxDispatch) => {
    return dispatch(
      callBridgeControllerMethod(BridgeBackgroundAction.SET_FEATURE_FLAGS),
    );
  };
};

export const resetBridgeState = () => {
  return async (dispatch: MetaMaskReduxDispatch) => {
    dispatch(
      callBridgeControllerMethod(BridgeBackgroundAction.RESET_STATE, []),
    );
  };
};

// User actions
export const setFromToken = (
  payload: AssetWithDisplayData<ERC20Asset> | AssetWithDisplayData<NativeAsset>,
) => {
  return async (dispatch: MetaMaskReduxDispatch) => {
    dispatch(setFromToken_(payload));
    dispatch(
      updateQuoteRequestParams<Pick<QuoteRequest, 'srcTokenAddress'>>({
        srcTokenAddress: payload.address ?? zeroAddress(),
      }),
    );
  };
};

export const setToToken = (
  payload: AssetWithDisplayData<ERC20Asset> | AssetWithDisplayData<NativeAsset>,
) => {
  return async (dispatch: MetaMaskReduxDispatch) => {
    dispatch(setToToken_(payload));
    dispatch(
      updateQuoteRequestParams<Pick<QuoteRequest, 'destTokenAddress'>>({
        destTokenAddress: payload.address ?? '',
      }),
    );
  };
};

export const setFromTokenInputValue = (payload: {
  amount: QuoteRequest['srcTokenAmount'];
  decimals: number;
}) => {
  return async (dispatch: MetaMaskReduxDispatch) => {
    dispatch(setFromTokenInputValue_(payload.amount));
    dispatch(
      updateQuoteRequestParams<Pick<QuoteRequest, 'srcTokenAmount'>>({
        srcTokenAmount:
          payload.amount === ''
            ? payload.amount
            : BigNumber.from(payload.amount)
                .mul(BigNumber.from(10).pow(payload.decimals))
                .toString(),
      }),
    );
  };
};

export const setFromChain = (chainId: Hex) => {
  return async (dispatch: MetaMaskReduxDispatch) => {
    dispatch(
      callBridgeControllerMethod<Hex>(BridgeUserAction.SELECT_SRC_NETWORK, [
        chainId,
      ]),
    );
  };
};

export const setToChain = (chainId: Hex) => {
  return async (dispatch: MetaMaskReduxDispatch) => {
    dispatch(setToChainId_(chainId));
    dispatch(
      callBridgeControllerMethod<Hex>(BridgeUserAction.SELECT_DEST_NETWORK, [
        chainId,
      ]),
    );
  };
};
