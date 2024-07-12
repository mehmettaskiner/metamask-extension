import React, { useContext, useEffect, useState, useCallback } from 'react';
import BigNumber from 'bignumber.js';
import PropTypes from 'prop-types';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { uniqBy, isEqual } from 'lodash';
import { useHistory } from 'react-router-dom';
import { getTokenTrackerLink } from '@metamask/etherscan-link';
import classnames from 'classnames';

import { MetaMetricsContext } from '../../../contexts/metametrics';
import {
  useTokensToSearch,
  getRenderableTokenData,
} from '../../../hooks/useTokensToSearch';
import { useEqualityCheck } from '../../../hooks/useEqualityCheck';
import { I18nContext } from '../../../contexts/i18n';
import { getTokens, getConversionRate } from '../../../ducks/metamask/metamask';
import Box from '../../../components/ui/box';
import {
  DISPLAY,
  TextColor,
  JustifyContent,
  AlignItems,
  SEVERITIES,
  TextVariant,
  BLOCK_SIZES,
  FontWeight,
} from '../../../helpers/constants/design-system';
import {
  fetchQuotesAndSetQuoteState,
  setSwapsFromToken,
  setSwapToToken,
  getFromToken,
  getToToken,
  getBalanceError,
  getTopAssets,
  getFetchParams,
  getQuotes,
  setBalanceError,
  setFromTokenInputValue,
  setFromTokenError,
  setMaxSlippage,
  setReviewSwapClickedTimestamp,
  getCurrentSmartTransactionsEnabled,
  getFromTokenInputValue,
  getFromTokenError,
  getMaxSlippage,
  getIsFeatureFlagLoaded,
  getFetchingQuotes,
  getSwapsErrorKey,
  getAggregatorMetadata,
  getTransactionSettingsOpened,
  setTransactionSettingsOpened,
  getLatestAddedTokenTo,
  getToTokenInputValue,
  getToTokenError,
  setToTokenInputValue,
  setToTokenError,
} from '../../../ducks/swaps/swaps';
import {
  getSwapsDefaultToken,
  getTokenExchangeRates,
  getCurrentCurrency,
  getCurrentChainId,
  getRpcPrefsForCurrentProvider,
  getTokenList,
  isHardwareWallet,
  getHardwareWalletType,
  getIsBridgeChain,
  getMetaMetricsId,
} from '../../../selectors';
import {
  getSmartTransactionsOptInStatus,
  getSmartTransactionsEnabled,
} from '../../../../shared/modules/selectors';
import {
  getValueFromWeiHex,
  hexToDecimal,
} from '../../../../shared/modules/conversion.utils';
import { getURLHostName } from '../../../helpers/utils/util';
import { getPortfolioUrl } from '../../../helpers/utils/portfolio';
import { usePrevious } from '../../../hooks/usePrevious';
import { useTokenTracker } from '../../../hooks/useTokenTracker';
import { useTokenFiatAmount } from '../../../hooks/useTokenFiatAmount';
import { useEthFiatAmount } from '../../../hooks/useEthFiatAmount';
import {
  isSwapsDefaultTokenAddress,
  isSwapsDefaultTokenSymbol,
} from '../../../../shared/modules/swaps.utils';
import {
  MetaMetricsEventCategory,
  MetaMetricsEventLinkType,
  MetaMetricsEventName,
} from '../../../../shared/constants/metametrics';
import {
  SWAPS_CHAINID_DEFAULT_BLOCK_EXPLORER_URL_MAP,
  TokenBucketPriority,
  ERROR_FETCHING_QUOTES,
  QUOTES_NOT_AVAILABLE_ERROR,
  QUOTES_EXPIRED_ERROR,
  MAX_ALLOWED_SLIPPAGE,
} from '../../../../shared/constants/swaps';
import {
  resetSwapsPostFetchState,
  ignoreTokens,
  clearSwapsQuotes,
  stopPollingForQuotes,
  clearSmartTransactionFees,
  setSwapsErrorKey,
  setBackgroundSwapRouteState,
} from '../../../store/actions';
import { SET_SMART_TRANSACTIONS_ERROR } from '../../../store/actionConstants';
import {
  countDecimals,
  fetchTokenPrice,
  formatSwapsValueForDisplay,
  getClassNameForCharLength,
} from '../swaps.util';
import { fetchTokenBalance } from '../../../../shared/lib/token-util';
import { isEqualCaseInsensitive } from '../../../../shared/modules/string-utils';
import { calcTokenAmount } from '../../../../shared/lib/transactions-controller-utils';
import { shouldEnableDirectWrapping } from '../../../../shared/lib/swaps-utils';
import {
  Icon,
  IconName,
  IconSize,
  ButtonLink,
  ButtonLinkSize,
  Modal,
  ModalOverlay,
  BannerAlert,
  Text,
  TextField,
  TextFieldSize,
} from '../../../components/component-library';
import { ModalContent } from '../../../components/component-library/modal-content/deprecated';
import { ModalHeader } from '../../../components/component-library/modal-header/deprecated';
import { SWAPS_NOTIFICATION_ROUTE } from '../../../helpers/constants/routes';
import ImportToken from '../import-token';
import TransactionSettings from '../transaction-settings/transaction-settings';
import SwapsBannerAlert from '../swaps-banner-alert/swaps-banner-alert';
import SwapsFooter from '../swaps-footer';
import SelectedToken from '../selected-token/selected-token';
import ListWithSearch from '../list-with-search/list-with-search';
import QuotesLoadingAnimation from './quotes-loading-animation';
import ReviewQuote from './review-quote';

let timeoutIdForQuotesPrefetching;

export default function PrepareSwapPage({
  ethBalance,
  selectedAccountAddress,
  shuffledTokensList,
}) {
  const t = useContext(I18nContext);
  const dispatch = useDispatch();
  const history = useHistory();
  const trackEvent = useContext(MetaMetricsContext);

  const [fetchedTokenExchangeRate, setFetchedTokenExchangeRate] =
    useState(undefined);
  const [verificationClicked, setVerificationClicked] = useState(false);
  const [isSwapToOpen, setIsSwapToOpen] = useState(false);
  const onSwapToOpen = () => setIsSwapToOpen(true);
  const onSwapToClose = () => setIsSwapToOpen(false);
  const [isSwapFromOpen, setIsSwapFromOpen] = useState(false);
  const onSwapFromOpen = () => setIsSwapFromOpen(true);
  const onSwapFromClose = () => setIsSwapFromOpen(false);
  const [isImportTokenModalOpen, setIsImportTokenModalOpen] = useState(false);
  const [tokenForImport, setTokenForImport] = useState(null);
  const [swapFromSearchQuery, setSwapFromSearchQuery] = useState('');
  const [swapToSearchQuery, setSwapToSearchQuery] = useState('');
  const [quoteCount, updateQuoteCount] = useState(0);
  const [prefetchingQuotes, setPrefetchingQuotes] = useState(false);
  const [rotateSwitchTokens, setRotateSwitchTokens] = useState(false);

  const isFeatureFlagLoaded = useSelector(getIsFeatureFlagLoaded);
  const balanceError = useSelector(getBalanceError);
  const fetchParams = useSelector(getFetchParams, isEqual);
  const { sourceTokenInfo = {}, destinationTokenInfo = {} } =
    fetchParams?.metaData || {};
  const tokens = useSelector(getTokens, isEqual);
  const topAssets = useSelector(getTopAssets, isEqual);

  // From token
  const fromToken = useSelector(getFromToken, isEqual);
  const fromTokenInputValue = useSelector(getFromTokenInputValue);
  const fromTokenError = useSelector(getFromTokenError);
  const [sendFromAmount, setSendFromAmount] = useState();

  // To token
  const toToken = useSelector(getToToken, isEqual) || destinationTokenInfo;
  const toTokenInputValue = useSelector(getToTokenInputValue);
  const toTokenError = useSelector(getToTokenError);
  const [receiveToAmount, setReceiveToAmount] = useState();

  const maxSlippage = useSelector(getMaxSlippage);
  const defaultSwapsToken = useSelector(getSwapsDefaultToken, isEqual);
  const chainId = useSelector(getCurrentChainId);
  const rpcPrefs = useSelector(getRpcPrefsForCurrentProvider, shallowEqual);
  const tokenList = useSelector(getTokenList, isEqual);
  const quotes = useSelector(getQuotes, isEqual);
  const latestAddedTokenTo = useSelector(getLatestAddedTokenTo, isEqual);
  const numberOfQuotes = Object.keys(quotes).length;
  const areQuotesPresent = numberOfQuotes > 0;
  const swapsErrorKey = useSelector(getSwapsErrorKey);
  const aggregatorMetadata = useSelector(getAggregatorMetadata, shallowEqual);
  const transactionSettingsOpened = useSelector(
    getTransactionSettingsOpened,
    shallowEqual,
  );
  const numberOfAggregators = aggregatorMetadata
    ? Object.keys(aggregatorMetadata).length
    : 0;
  const isBridgeChain = useSelector(getIsBridgeChain);
  const metaMetricsId = useSelector(getMetaMetricsId);

  const tokenConversionRates = useSelector(getTokenExchangeRates, isEqual);
  const conversionRate = useSelector(getConversionRate);
  const hardwareWalletUsed = useSelector(isHardwareWallet);
  const hardwareWalletType = useSelector(getHardwareWalletType);
  const smartTransactionsOptInStatus = useSelector(
    getSmartTransactionsOptInStatus,
  );
  const smartTransactionsEnabled = useSelector(getSmartTransactionsEnabled);
  const currentSmartTransactionsEnabled = useSelector(
    getCurrentSmartTransactionsEnabled,
  );
  const isSmartTransaction =
    currentSmartTransactionsEnabled && smartTransactionsOptInStatus;
  const currentCurrency = useSelector(getCurrentCurrency);
  const fetchingQuotes = useSelector(getFetchingQuotes);
  const loadingComplete = !fetchingQuotes && areQuotesPresent;

  const fetchParamsFromToken = isSwapsDefaultTokenSymbol(
    sourceTokenInfo?.symbol,
    chainId,
  )
    ? defaultSwapsToken
    : sourceTokenInfo;

  const { tokensWithBalances } = useTokenTracker({ tokens });

  // If the fromToken was set in a call to `onFromSelect` (see below), and that from token has a balance
  // but is not in tokensWithBalances or tokens, then we want to add it to the usersTokens array so that
  // the balance of the token can appear in the from token selection dropdown
  const fromTokenArray =
    !isSwapsDefaultTokenSymbol(fromToken?.symbol, chainId) && fromToken?.balance
      ? [fromToken]
      : [];
  const usersTokens = uniqBy(
    [...tokensWithBalances, ...tokens, ...fromTokenArray],
    'address',
  );
  const memoizedUsersTokens = useEqualityCheck(usersTokens);

  const selectedFromToken = getRenderableTokenData(
    fromToken || fetchParamsFromToken,
    tokenConversionRates,
    conversionRate,
    currentCurrency,
    chainId,
    tokenList,
  );

  const tokensToSearchSwapFrom = useTokensToSearch({
    usersTokens: memoizedUsersTokens,
    topTokens: topAssets,
    shuffledTokensList,
    tokenBucketPriority: TokenBucketPriority.owned,
  });
  const tokensToSearchSwapTo = useTokensToSearch({
    usersTokens: memoizedUsersTokens,
    topTokens: topAssets,
    shuffledTokensList,
    tokenBucketPriority: TokenBucketPriority.top,
  });
  const selectedToToken =
    tokensToSearchSwapFrom.find(({ address }) =>
      isEqualCaseInsensitive(address, toToken?.address),
    ) || toToken;
  const toTokenIsNotDefault =
    selectedToToken?.address &&
    !isSwapsDefaultTokenAddress(selectedToToken?.address, chainId);
  const occurrences = Number(
    selectedToToken?.occurances || selectedToToken?.occurrences || 0,
  );
  const {
    address: fromTokenAddress,
    symbol: fromTokenSymbol,
    string: fromTokenString,
    decimals: fromTokenDecimals,
    balance: rawFromTokenBalance,
  } = selectedFromToken || {};
  const {
    address: toTokenAddress,
    symbol: toTokenSymbol,
    decimals: toTokenDecimals,
  } = selectedToToken || {};

  const fromTokenBalance =
    rawFromTokenBalance &&
    calcTokenAmount(rawFromTokenBalance, fromTokenDecimals).toString(10);

  const prevFromTokenBalance = usePrevious(fromTokenBalance);

  const swapFromTokenFiatValue = useTokenFiatAmount(
    fromTokenAddress,
    fromTokenInputValue || 0,
    fromTokenSymbol,
    {
      showFiat: true,
    },
    true,
  );
  const swapFromEthFiatValue = useEthFiatAmount(
    fromTokenInputValue || 0,
    { showFiat: true },
    true,
  );
  const swapFromFiatValue = isSwapsDefaultTokenSymbol(fromTokenSymbol, chainId)
    ? swapFromEthFiatValue
    : swapFromTokenFiatValue;

  const onFromInputChange = useCallback(
    (newInputValue, balance) => {
      dispatch(setFromTokenInputValue(newInputValue));
      const newBalanceError = new BigNumber(newInputValue || 0).gt(
        balance || 0,
      );
      // "setBalanceError" is just a warning, a user can still click on the "Review swap" button.
      if (balanceError !== newBalanceError) {
        dispatch(setBalanceError(newBalanceError));
      }
      dispatch(
        setFromTokenError(
          fromToken && countDecimals(newInputValue) > fromToken.decimals
            ? 'tooManyDecimals'
            : null,
        ),
      );
    },
    [dispatch, fromToken, balanceError],
  );

  const onToInputChange = useCallback(
    (newInputValue) => {
      dispatch(setToTokenInputValue(newInputValue));
      dispatch(
        setToTokenError(
          toToken && countDecimals(newInputValue) > toToken.decimals
            ? 'tooManyDecimals'
            : null,
        ),
      );
    },
    [dispatch, toToken],
  );

  useEffect(() => {
    let timeoutLength;

    if (!prefetchingQuotes) {
      updateQuoteCount(0);
      return;
    }

    const onQuotesLoadingDone = async () => {
      await dispatch(setBackgroundSwapRouteState(''));
      setPrefetchingQuotes(false);
      if (
        swapsErrorKey === ERROR_FETCHING_QUOTES ||
        swapsErrorKey === QUOTES_NOT_AVAILABLE_ERROR
      ) {
        dispatch(setSwapsErrorKey(QUOTES_NOT_AVAILABLE_ERROR));
      }
    };

    // The below logic simulates a sequential loading of the aggregator quotes, even though we are fetching them all with a single call.
    // This is to give the user a sense of progress. The callback passed to `setTimeout` updates the quoteCount and therefore causes
    // a new logo to be shown, the fox to look at that logo, the logo bar and aggregator name to update.

    if (loadingComplete) {
      // If loading is complete, but the quoteCount is not, we quickly display the remaining logos/names/fox looks. 0.2s each
      timeoutLength = 20;
    } else {
      // If loading is not complete, we display remaining logos/names/fox looks at random intervals between 0.5s and 2s, to simulate the
      // sort of loading a user would experience in most async scenarios
      timeoutLength = 500 + Math.floor(Math.random() * 1500);
    }
    const quoteCountTimeout = setTimeout(() => {
      if (quoteCount < numberOfAggregators) {
        updateQuoteCount(quoteCount + 1);
      } else if (quoteCount === numberOfAggregators && loadingComplete) {
        onQuotesLoadingDone();
      }
    }, timeoutLength);

    // eslint-disable-next-line consistent-return
    return function cleanup() {
      clearTimeout(quoteCountTimeout);
    };
  }, [
    fetchingQuotes,
    quoteCount,
    loadingComplete,
    numberOfQuotes,
    dispatch,
    history,
    swapsErrorKey,
    numberOfAggregators,
    prefetchingQuotes,
  ]);

  const onFromSelect = (token) => {
    if (
      token?.address &&
      !swapFromFiatValue &&
      fetchedTokenExchangeRate !== null
    ) {
      fetchTokenPrice(token.address).then((rate) => {
        if (rate !== null && rate !== undefined) {
          setFetchedTokenExchangeRate(rate);
        }
      });
    } else {
      setFetchedTokenExchangeRate(null);
    }
    if (
      token?.address &&
      !memoizedUsersTokens.find((usersToken) =>
        isEqualCaseInsensitive(usersToken.address, token.address),
      )
    ) {
      fetchTokenBalance(
        token.address,
        selectedAccountAddress,
        global.ethereumProvider,
      ).then((fetchedBalance) => {
        if (fetchedBalance?.balance) {
          const balanceAsDecString = fetchedBalance.balance.toString(10);
          const userTokenBalance = calcTokenAmount(
            balanceAsDecString,
            token.decimals,
          );
          dispatch(
            setSwapsFromToken({
              ...token,
              string: userTokenBalance.toString(10),
              balance: balanceAsDecString,
            }),
          );
        }
      });
    }
    dispatch(setSwapsFromToken(token));
    onFromInputChange(fromTokenInputValue, token.string, token.decimals);
  };

  const blockExplorerTokenLink = getTokenTrackerLink(
    selectedToToken.address,
    chainId,
    null, // no networkId
    null, // no holderAddress
    {
      blockExplorerUrl:
        SWAPS_CHAINID_DEFAULT_BLOCK_EXPLORER_URL_MAP[chainId] ?? null,
    },
  );

  const blockExplorerLabel = rpcPrefs.blockExplorerUrl
    ? getURLHostName(blockExplorerTokenLink)
    : t('etherscan');

  const { address: toAddress } = toToken || {};
  const onToSelect = useCallback(
    (token) => {
      if (latestAddedTokenTo && token.address !== toAddress) {
        dispatch(
          ignoreTokens({
            tokensToIgnore: toAddress,
            dontShowLoadingIndicator: true,
          }),
        );
      }
      dispatch(setSwapToToken(token));
      setVerificationClicked(false);
    },
    [dispatch, latestAddedTokenTo, toAddress],
  );

  const tokensWithBalancesFromToken = tokensWithBalances.find((token) =>
    isEqualCaseInsensitive(token.address, fromToken?.address),
  );
  const previousTokensWithBalancesFromToken = usePrevious(
    tokensWithBalancesFromToken,
  );

  useEffect(() => {
    const notDefault = !isSwapsDefaultTokenAddress(
      tokensWithBalancesFromToken?.address,
      chainId,
    );
    const addressesAreTheSame = isEqualCaseInsensitive(
      tokensWithBalancesFromToken?.address,
      previousTokensWithBalancesFromToken?.address,
    );
    const balanceHasChanged =
      tokensWithBalancesFromToken?.balance !==
      previousTokensWithBalancesFromToken?.balance;
    if (notDefault && addressesAreTheSame && balanceHasChanged) {
      dispatch(
        setSwapsFromToken({
          ...fromToken,
          balance: tokensWithBalancesFromToken?.balance,
          string: tokensWithBalancesFromToken?.string,
        }),
      );
    }
  }, [
    dispatch,
    tokensWithBalancesFromToken,
    previousTokensWithBalancesFromToken,
    fromToken,
    chainId,
  ]);

  // If the eth balance changes while on build quote, we update the selected from token
  useEffect(() => {
    if (
      isSwapsDefaultTokenAddress(fromToken?.address, chainId) &&
      fromToken?.balance !== hexToDecimal(ethBalance)
    ) {
      dispatch(
        setSwapsFromToken({
          ...fromToken,
          balance: hexToDecimal(ethBalance),
          string: getValueFromWeiHex({
            value: ethBalance,
            numberOfDecimals: 4,
            toDenomination: 'ETH',
          }),
        }),
      );
    }
  }, [dispatch, fromToken, ethBalance, chainId]);

  useEffect(() => {
    if (!fromToken?.symbol && !fetchParamsFromToken?.symbol) {
      dispatch(setSwapsFromToken(defaultSwapsToken));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prevFromTokenBalance !== fromTokenBalance) {
      onFromInputChange(fromTokenInputValue, fromTokenBalance);
    }
  }, [
    onFromInputChange,
    prevFromTokenBalance,
    fromTokenInputValue,
    fromTokenBalance,
  ]);

  const trackPrepareSwapPageLoadedEvent = useCallback(() => {
    trackEvent({
      event: 'Prepare Swap Page Loaded',
      category: MetaMetricsEventCategory.Swaps,
      sensitiveProperties: {
        is_hardware_wallet: hardwareWalletUsed,
        hardware_wallet_type: hardwareWalletType,
        stx_enabled: smartTransactionsEnabled,
        current_stx_enabled: currentSmartTransactionsEnabled,
        stx_user_opt_in: smartTransactionsOptInStatus,
      },
    });
  }, [
    trackEvent,
    hardwareWalletUsed,
    hardwareWalletType,
    smartTransactionsEnabled,
    currentSmartTransactionsEnabled,
    smartTransactionsOptInStatus,
  ]);

  useEffect(() => {
    dispatch(resetSwapsPostFetchState());
    dispatch(setReviewSwapClickedTimestamp());
    trackPrepareSwapPageLoadedEvent();
  }, [dispatch, trackPrepareSwapPageLoadedEvent]);

  const BlockExplorerLink = () => {
    return (
      <a
        className="prepare-swap-page__token-etherscan-link"
        key="prepare-swap-page-etherscan-link"
        onClick={() => {
          /* istanbul ignore next */
          trackEvent({
            event: MetaMetricsEventName.ExternalLinkClicked,
            category: MetaMetricsEventCategory.Swaps,
            properties: {
              link_type: MetaMetricsEventLinkType.TokenTracker,
              location: 'Swaps Confirmation',
              url_domain: getURLHostName(blockExplorerTokenLink),
            },
          });
          global.platform.openTab({
            url: blockExplorerTokenLink,
          });
        }}
        target="_blank"
        rel="noopener noreferrer"
      >
        {blockExplorerLabel}
      </a>
    );
  };

  const yourTokenFromBalance = `${t('balance')}: ${fromTokenString || '0'}`;
  const yourTokenToBalance = `${t('balance')}: ${
    selectedToToken?.string || '0'
  }`;

  const isDirectWrappingEnabled = shouldEnableDirectWrapping(
    chainId,
    fromTokenAddress,
    selectedToToken.address,
  );
  const isReviewSwapButtonDisabled =
    fromTokenError ||
    toTokenError ||
    !isFeatureFlagLoaded ||
    (!Number(fromTokenInputValue) && !Number(toTokenInputValue)) ||
    !selectedToToken?.address ||
    !fromTokenAddress ||
    Number(maxSlippage) < 0 ||
    Number(maxSlippage) > MAX_ALLOWED_SLIPPAGE ||
    (toTokenIsNotDefault && occurrences < 2 && !verificationClicked);

  // It's triggered every time there is a change in form values (token from, token to, amount and slippage).
  useEffect(() => {
    dispatch(clearSwapsQuotes());
    dispatch(stopPollingForQuotes());
    const prefetchQuotesWithoutRedirecting = async () => {
      setPrefetchingQuotes(true);
      const pageRedirectionDisabled = true;
      await dispatch(
        fetchQuotesAndSetQuoteState({
          history,
          fromTokenInputValue,
          toTokenInputValue,
          maxSlippage,
          trackEvent,
          pageRedirectionDisabled,
        }),
      );
    };
    // Delay fetching quotes until a user is done typing an input value. If they type a new char in less than a second,
    // we will cancel previous setTimeout call and start running a new one.
    timeoutIdForQuotesPrefetching = setTimeout(() => {
      timeoutIdForQuotesPrefetching = null;
      if (!isReviewSwapButtonDisabled) {
        if (isSmartTransaction) {
          clearSmartTransactionFees(); // Clean up STX fees eery time there is a form change.
          dispatch({
            type: SET_SMART_TRANSACTIONS_ERROR,
            payload: null,
          });
        }
        // Only do quotes prefetching if the Review swap button is enabled.
        prefetchQuotesWithoutRedirecting();
      }
    }, 1000);
    return () => clearTimeout(timeoutIdForQuotesPrefetching);
  }, [
    dispatch,
    history,
    maxSlippage,
    trackEvent,
    isReviewSwapButtonDisabled,
    fromTokenInputValue,
    fromTokenAddress,
    toTokenInputValue,
    toTokenAddress,
    smartTransactionsOptInStatus,
    isSmartTransaction,
  ]);

  // Set text for the main button based on different conditions.
  let mainButtonText;
  if (swapsErrorKey && swapsErrorKey === QUOTES_NOT_AVAILABLE_ERROR) {
    mainButtonText = t('swapQuotesNotAvailableErrorTitle');
  } else if (!isReviewSwapButtonDisabled) {
    mainButtonText = t('swapFetchingQuotes');
  } else if (!selectedToToken?.address || !fromTokenAddress) {
    mainButtonText = t('swapSelectToken');
  } else {
    mainButtonText = t('swapEnterAmount');
  }

  // Regex that validates strings with only numbers, 'x.', '.x', and 'x.x'
  const tokenInputRegexp = /^(\.\d+|\d+(\.\d+)?|\d+\.)$/u;
  const getInputValueToUse = (event) => {
    // Automatically prefix value with 0. if user begins typing .
    return event.target.value === '.' ? '0.' : event.target.value;
  };
  // If the value is either empty or contains only numbers and '.' and only has one '.', update input to match
  const isInputValueValid = (value) =>
    value === '' || tokenInputRegexp.test(value);

  const onFromTextFieldChange = (event) => {
    event.stopPropagation();
    const valueToUse = getInputValueToUse(event);
    if (isInputValueValid(valueToUse)) {
      onFromInputChange(valueToUse, fromTokenBalance);
    } else {
      // otherwise, use the previously set inputValue (effectively denying the user from inputting the last char)
      // or an empty string if we do not yet have an inputValue
      onFromInputChange(fromTokenInputValue || '', fromTokenBalance);
    }

    setSendFromAmount(undefined);
    onToInputChange('');
  };

  const onToTextFieldChange = (event) => {
    event.stopPropagation();
    const valueToUse = getInputValueToUse(event);
    if (isInputValueValid(valueToUse)) {
      onToInputChange(valueToUse);
    } else {
      // otherwise, use the previously set inputValue (effectively denying the user from inputting the last char)
      // or an empty string if we do not yet have an inputValue
      onToInputChange(toTokenInputValue || '');
    }

    setReceiveToAmount(undefined);
    onFromInputChange('', fromTokenBalance);
  };

  const hideSwapToTokenIf = useCallback(
    (item) => isEqualCaseInsensitive(item.address, fromTokenAddress),
    [fromTokenAddress],
  );

  const hideSwapFromTokenIf = useCallback(
    (item) => isEqualCaseInsensitive(item.address, selectedToToken?.address),
    [selectedToToken?.address],
  );

  const showReviewQuote =
    !swapsErrorKey && !isReviewSwapButtonDisabled && areQuotesPresent;
  const showQuotesLoadingAnimation =
    !swapsErrorKey && !isReviewSwapButtonDisabled && !areQuotesPresent;
  const showNotEnoughTokenMessage =
    !fromTokenError && balanceError && fromTokenSymbol;
  const showCrossChainSwapsLink =
    isBridgeChain &&
    !showReviewQuote &&
    !showQuotesLoadingAnimation &&
    !areQuotesPresent;

  const tokenVerifiedOn1Source = occurrences === 1;

  useEffect(() => {
    if (swapsErrorKey === QUOTES_EXPIRED_ERROR) {
      history.push(SWAPS_NOTIFICATION_ROUTE);
    }
  }, [swapsErrorKey, history]);

  useEffect(() => {
    if (showQuotesLoadingAnimation) {
      setReceiveToAmount('');
      setSendFromAmount('');
    }
  }, [showQuotesLoadingAnimation]);

  const onOpenImportTokenModalClick = (item) => {
    setTokenForImport(item);
    setIsImportTokenModalOpen(true);
    onSwapToClose();
    setSwapToSearchQuery('');
  };

  /* istanbul ignore next */
  const onImportTokenClick = () => {
    trackEvent({
      event: 'Token Imported',
      category: MetaMetricsEventCategory.Swaps,
      sensitiveProperties: {
        symbol: tokenForImport?.symbol,
        address: tokenForImport?.address,
        chain_id: chainId,
        is_hardware_wallet: hardwareWalletUsed,
        hardware_wallet_type: hardwareWalletType,
        stx_enabled: smartTransactionsEnabled,
        current_stx_enabled: currentSmartTransactionsEnabled,
        stx_user_opt_in: smartTransactionsOptInStatus,
      },
    });
    // Only when a user confirms import of a token, we add it and show it in a dropdown.
    onToSelect?.(tokenForImport);
    setTokenForImport(null);
  };

  const onImportTokenCloseClick = () => {
    setIsImportTokenModalOpen(false);
  };

  const importTokenProps = {
    onImportTokenCloseClick,
    onImportTokenClick,
    setIsImportTokenModalOpen,
    tokenForImport,
  };

  let sendFromAmountFormatted;

  let receiveToAmountFormatted;
  let receiveToAmountClassName;

  let inputtableTokenAmountClassName;

  // TODO: Do this only when these variables change, not on every re-render.
  if (sendFromAmount && !isReviewSwapButtonDisabled) {
    sendFromAmountFormatted = formatSwapsValueForDisplay(sendFromAmount);
  }

  if (receiveToAmount && !isReviewSwapButtonDisabled) {
    receiveToAmountFormatted = formatSwapsValueForDisplay(receiveToAmount);
    receiveToAmountClassName = getClassNameForCharLength(
      receiveToAmountFormatted,
      'prepare-swap-page__receive-amount',
    );
  }
  if (fromTokenInputValue || toTokenInputValue) {
    inputtableTokenAmountClassName = getClassNameForCharLength(
      fromTokenInputValue || toTokenInputValue,
      'prepare-swap-page__token-amount',
    );
  }

  const showMaxBalanceLink =
    fromTokenSymbol &&
    !isSwapsDefaultTokenSymbol(fromTokenSymbol, chainId) &&
    rawFromTokenBalance > 0;

  return (
    <div className="prepare-swap-page">
      <div className="prepare-swap-page__content">
        {tokenForImport && isImportTokenModalOpen && (
          <ImportToken isOpen {...importTokenProps} />
        )}
        {/* From token modal */}
        <Modal
          onClose={onSwapToClose}
          isOpen={isSwapToOpen}
          isClosedOnOutsideClick
          isClosedOnEscapeKey
          className="mm-modal__custom-scrollbar"
        >
          <ModalOverlay />
          <ModalContent>
            <ModalHeader onClose={onSwapToClose}>{t('swapSwapTo')}</ModalHeader>
            <Box
              paddingTop={10}
              paddingRight={0}
              paddingBottom={0}
              paddingLeft={0}
              display={DISPLAY.FLEX}
            >
              <ListWithSearch
                selectedItem={selectedToToken}
                itemsToSearch={tokensToSearchSwapTo}
                onClickItem={(item) => {
                  onToSelect?.(item);
                  onSwapToClose();
                }}
                maxListItems={30}
                searchQuery={swapToSearchQuery}
                setSearchQuery={setSwapToSearchQuery}
                hideItemIf={hideSwapToTokenIf}
                shouldSearchForImports
                onOpenImportTokenModalClick={onOpenImportTokenModalClick}
              />
            </Box>
          </ModalContent>
        </Modal>

        {/* To token modal */}
        <Modal
          onClose={onSwapFromClose}
          isOpen={isSwapFromOpen}
          isClosedOnOutsideClick
          isClosedOnEscapeKey
          className="mm-modal__custom-scrollbar"
        >
          <ModalOverlay />
          <ModalContent>
            <ModalHeader onClose={onSwapFromClose}>
              {t('swapSwapFrom')}
            </ModalHeader>
            <Box
              paddingTop={10}
              paddingRight={0}
              paddingBottom={0}
              paddingLeft={0}
              display={DISPLAY.FLEX}
            >
              <ListWithSearch
                selectedItem={selectedFromToken}
                itemsToSearch={tokensToSearchSwapFrom}
                onClickItem={(item) => {
                  onFromSelect?.(item);
                  onSwapFromClose();
                }}
                maxListItems={30}
                searchQuery={swapFromSearchQuery}
                setSearchQuery={setSwapFromSearchQuery}
                hideItemIf={hideSwapFromTokenIf}
              />
            </Box>
          </ModalContent>
        </Modal>

        {/* From token area */}
        <div className="prepare-swap-page__swap-from-content">
          <Box
            display={DISPLAY.FLEX}
            justifyContent={JustifyContent.spaceBetween}
            alignItems={AlignItems.center}
          >
            <SelectedToken
              onClick={onSwapFromOpen}
              onClose={onSwapFromClose}
              selectedToken={selectedFromToken}
              testId="prepare-swap-page-swap-from"
            />
            <Box display={DISPLAY.FLEX} alignItems={AlignItems.center}>
              <TextField
                className={classnames('prepare-swap-page__token-amount', {
                  [inputtableTokenAmountClassName]:
                    inputtableTokenAmountClassName,
                })}
                size={TextFieldSize.Sm}
                placeholder="0"
                onChange={onFromTextFieldChange}
                value={fromTokenInputValue || sendFromAmountFormatted || ''}
                truncate={false}
                testId="prepare-swap-page-from-token-amount"
              />
            </Box>
          </Box>
          <Box
            display={DISPLAY.FLEX}
            justifyContent={JustifyContent.spaceBetween}
            alignItems={AlignItems.stretch}
          >
            <div className="prepare-swap-page__balance-message">
              {fromTokenSymbol && yourTokenFromBalance}
              {showMaxBalanceLink && (
                <div
                  className="prepare-swap-page__max-balance"
                  data-testid="prepare-swap-page-max-balance"
                  onClick={() =>
                    onFromInputChange(fromTokenBalance || '0', fromTokenBalance)
                  }
                >
                  {t('max')}
                </div>
              )}
            </div>
            {fromTokenInputValue && swapFromFiatValue && (
              <Box
                display={DISPLAY.FLEX}
                justifyContent={JustifyContent.flexEnd}
                alignItems={AlignItems.flexEnd}
              >
                <Text
                  variant={TextVariant.bodySm}
                  color={TextColor.textAlternative}
                >
                  {swapFromFiatValue}
                </Text>
              </Box>
            )}
          </Box>
          {showNotEnoughTokenMessage && (
            <Box
              display={DISPLAY.FLEX}
              justifyContent={JustifyContent.flexStart}
            >
              <Text
                variant={TextVariant.bodySmBold}
                color={TextColor.textAlternative}
                marginTop={0}
              >
                {t('swapsNotEnoughToken', [fromTokenSymbol])}
              </Text>
            </Box>
          )}
          {fromTokenError && (
            <Box
              display={DISPLAY.FLEX}
              justifyContent={JustifyContent.flexStart}
            >
              <Text
                variant={TextVariant.bodySmBold}
                color={TextColor.textAlternative}
                marginTop={0}
              >
                {t('swapTooManyDecimalsError', [
                  fromTokenSymbol,
                  fromTokenDecimals,
                ])}
              </Text>
            </Box>
          )}
          {toTokenError && (
            <Box
              display={DISPLAY.FLEX}
              justifyContent={JustifyContent.flexStart}
            >
              <Text
                variant={TextVariant.bodySmBold}
                color={TextColor.textAlternative}
                marginTop={0}
              >
                {t('swapTooManyDecimalsError', [
                  toTokenSymbol,
                  toTokenDecimals,
                ])}
              </Text>
            </Box>
          )}
          <Box display={DISPLAY.FLEX} justifyContent={JustifyContent.center}>
            <div
              className={classnames('prepare-swap-page__switch-tokens', {
                'prepare-swap-page__switch-tokens--rotate': rotateSwitchTokens,
                'prepare-swap-page__switch-tokens--disabled':
                  showQuotesLoadingAnimation,
              })}
              data-testid="prepare-swap-page-switch-tokens"
              onClick={() => {
                // If quotes are being loaded, disable the switch button.
                if (!showQuotesLoadingAnimation) {
                  onToSelect(selectedFromToken);
                  onFromSelect(selectedToToken);
                  setRotateSwitchTokens(!rotateSwitchTokens);
                }
              }}
              title={t('swapSwapSwitch')}
            >
              <Icon name={IconName.Arrow2Down} size={IconSize.Lg} />
            </div>
          </Box>
        </div>

        {/* To token area */}
        <div className="prepare-swap-page__swap-to-content">
          <Box
            display={DISPLAY.FLEX}
            justifyContent={JustifyContent.spaceBetween}
            alignItems={AlignItems.center}
          >
            <SelectedToken
              onClick={onSwapToOpen}
              onClose={onSwapToClose}
              selectedToken={selectedToToken}
              testId="prepare-swap-page-swap-to"
            />

            <Box
              display={DISPLAY.FLEX}
              alignItems={AlignItems.center}
              marginLeft={2}
              className="prepare-swap-page__receive-amount-container"
            >
              {showQuotesLoadingAnimation ? (
                <Box
                  display={DISPLAY.FLEX}
                  className="prepare-swap-page__token-amount-loading-pulse"
                />
              ) : (
                <TextField
                  className={classnames('prepare-swap-page__token-amount', {
                    [inputtableTokenAmountClassName]:
                      inputtableTokenAmountClassName,
                  })}
                  size={TextFieldSize.Sm}
                  placeholder="0"
                  onChange={onToTextFieldChange}
                  value={toTokenInputValue || receiveToAmountFormatted || ''}
                  truncate={false}
                  testId="prepare-swap-page-to-token-amount"
                />
              )}
            </Box>
          </Box>
          <Box
            display={DISPLAY.FLEX}
            justifyContent={JustifyContent.spaceBetween}
            alignItems={AlignItems.stretch}
          >
            <div className="prepare-swap-page__balance-message">
              {selectedToToken?.string && yourTokenToBalance}
            </div>
          </Box>
        </div>

        {showCrossChainSwapsLink && (
          <ButtonLink
            endIconName={IconName.Export}
            endIconProps={{
              size: IconSize.Xs,
            }}
            variant={TextVariant.bodySm}
            marginTop={2}
            fontWeight={FontWeight.Normal}
            onClick={() => {
              const portfolioUrl = getPortfolioUrl(
                'bridge',
                'ext_bridge_prepare_swap_link',
                metaMetricsId,
              );

              global.platform.openTab({
                url: `${portfolioUrl}&token=${fromTokenAddress}`,
              });

              trackEvent({
                category: MetaMetricsEventCategory.Swaps,
                event: MetaMetricsEventName.BridgeLinkClicked,
                properties: {
                  location: 'Swaps',
                  text: 'Swap across networks with MetaMask Portfolio',
                  chain_id: chainId,
                  token_symbol: fromTokenSymbol,
                },
              });
            }}
            target="_blank"
            data-testid="prepare-swap-page-cross-chain-swaps-link"
          >
            {t('crossChainSwapsLink')}
          </ButtonLink>
        )}
        {!showReviewQuote && toTokenIsNotDefault && occurrences < 2 && (
          <Box display={DISPLAY.FLEX} marginTop={2}>
            <BannerAlert
              severity={
                tokenVerifiedOn1Source ? SEVERITIES.WARNING : SEVERITIES.DANGER
              }
              title={
                tokenVerifiedOn1Source
                  ? t('swapTokenVerifiedOn1SourceTitle')
                  : t('swapTokenAddedManuallyTitle')
              }
              titleProps={{
                'data-testid': 'swaps-banner-title',
              }}
              width={BLOCK_SIZES.FULL}
            >
              <Box>
                <Text
                  variant={TextVariant.bodyMd}
                  as="h6"
                  data-testid="mm-banner-alert-notification-text"
                >
                  {tokenVerifiedOn1Source
                    ? t('swapTokenVerifiedOn1SourceDescription', [
                        selectedToToken?.symbol,
                        <BlockExplorerLink key="block-explorer-link" />,
                      ])
                    : t('swapTokenAddedManuallyDescription', [
                        <BlockExplorerLink key="block-explorer-link" />,
                      ])}
                </Text>
                {!verificationClicked && (
                  <ButtonLink
                    size={ButtonLinkSize.Inherit}
                    textProps={{
                      variant: TextVariant.bodyMd,
                      alignItems: AlignItems.flexStart,
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      setVerificationClicked(true);
                    }}
                  >
                    {t('swapContinueSwapping')}
                  </ButtonLink>
                )}
              </Box>
            </BannerAlert>
          </Box>
        )}
        {swapsErrorKey && (
          <Box display={DISPLAY.FLEX} marginTop={2}>
            <SwapsBannerAlert
              swapsErrorKey={swapsErrorKey}
              currentSlippage={maxSlippage}
            />
          </Box>
        )}
        {transactionSettingsOpened && !isDirectWrappingEnabled && (
          <TransactionSettings
            onSelect={(newSlippage) => {
              dispatch(setMaxSlippage(newSlippage));
            }}
            maxAllowedSlippage={MAX_ALLOWED_SLIPPAGE}
            currentSlippage={maxSlippage}
            isDirectWrappingEnabled={isDirectWrappingEnabled}
            onModalClose={() => {
              dispatch(setTransactionSettingsOpened(false));
            }}
          />
        )}
        {showQuotesLoadingAnimation && (
          <QuotesLoadingAnimation
            quoteCount={quoteCount}
            numberOfAggregators={numberOfAggregators}
          />
        )}
        {showReviewQuote && (
          <ReviewQuote
            setReceiveToAmount={setReceiveToAmount}
            setSendFromAmount={setSendFromAmount}
          />
        )}
      </div>
      {!areQuotesPresent && (
        <SwapsFooter
          submitText={mainButtonText}
          disabled
          hideCancel
          showTermsOfService
        />
      )}
    </div>
  );
}

PrepareSwapPage.propTypes = {
  ethBalance: PropTypes.string,
  selectedAccountAddress: PropTypes.string,
  shuffledTokensList: PropTypes.array,
};
