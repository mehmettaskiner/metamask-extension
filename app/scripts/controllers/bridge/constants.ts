import { zeroAddress } from 'ethereumjs-util';
import { BridgeControllerState, BridgeFeatureFlagsKey } from './types';

export const BRIDGE_CONTROLLER_NAME = 'BridgeController';
export const REFRESH_INTERVAL_MS = 30 * 1000;

export enum RequestStatus {
  LOADING,
  FETCHED,
  ERROR,
}

export const DEFAULT_BRIDGE_CONTROLLER_STATE: BridgeControllerState = {
  bridgeFeatureFlags: {
    [BridgeFeatureFlagsKey.EXTENSION_SUPPORT]: false,
    [BridgeFeatureFlagsKey.NETWORK_SRC_ALLOWLIST]: [],
    [BridgeFeatureFlagsKey.NETWORK_DEST_ALLOWLIST]: [],
  },
  srcTokens: {},
  srcTopAssets: [],
  destTokens: {},
  destTopAssets: [],
  quotes: [],
  quoteRequest: {
    walletAddress: undefined,
    srcTokenAddress: zeroAddress(),
    slippage: 0.5,
  },
  quotesLastFetched: undefined,
  quotesLoadingStatus: undefined,
};
