import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { zeroAddress } from 'ethereumjs-util';
import { Web3Provider } from '@ethersproject/providers';
import { Hex } from '@metamask/utils';
import { Numeric } from '../../../shared/modules/Numeric';
import { DEFAULT_PRECISION } from '../useCurrencyDisplay';
import { fetchTokenBalance } from '../../../shared/lib/token-util';
import {
  getCurrentChainId,
  getSelectedInternalAccount,
  SwapsEthToken,
} from '../../selectors';
import { SwapsTokenObject } from '../../../shared/constants/swaps';

/**
 * Custom hook to fetch and format the latest balance of a given token or native asset.
 *
 * @param token - The token object for which the balance is to be fetched. Can be null.
 * @param chainId - The chain ID to be used for fetching the balance. Optional.
 * @returns An object containing the formatted balance as a string.
 */
const useLatestBalance = (
  token: SwapsTokenObject | SwapsEthToken | null,
  chainId?: Hex,
) => {
  const { address: selectedAddress } = useSelector(getSelectedInternalAccount);
  const currentChainId = useSelector(getCurrentChainId);

  const [latestBalance, setLatestBalance] = useState<string>('0');

  useEffect(() => {
    if (token && chainId && currentChainId === chainId) {
      if (!token.address || token.address === zeroAddress()) {
        const ethersProvider = new Web3Provider(global.ethereumProvider);
        ethersProvider.getBalance(selectedAddress).then((balance) => {
          setLatestBalance(balance.toString());
        });
      } else {
        fetchTokenBalance(
          token.address,
          selectedAddress,
          global.ethereumProvider,
        ).then((balance) => {
          setLatestBalance(balance.toString());
        });
      }
    }
    // TODO implement fetching balance on non-active chain
    setLatestBalance('0');
  }, [token, selectedAddress, global.ethereumProvider]);

  return {
    formattedBalance: token
      ? new Numeric(latestBalance, 10)
          .shiftedBy(Number(token?.decimals) ?? 18)
          .round(DEFAULT_PRECISION)
          .toString()
      : '0',
  };
};

export default useLatestBalance;
