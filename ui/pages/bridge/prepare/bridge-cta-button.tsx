import React, { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '../../../components/component-library';
import {
  getFromAmount,
  getFromChain,
  getFromToken,
  getToAmount,
  getToChain,
  getToToken,
} from '../../../ducks/bridge/selectors';
import { useI18nContext } from '../../../hooks/useI18nContext';
import { signBridgeTransaction } from '../../../ducks/bridge/actions';

export const BridgeCTAButton = () => {
  const dispatch = useDispatch();
  const t = useI18nContext();
  const fromToken = useSelector(getFromToken);
  const toToken = useSelector(getToToken);

  const fromChain = useSelector(getFromChain);
  const toChain = useSelector(getToChain);

  const fromAmount = useSelector(getFromAmount);
  const toAmount = useSelector(getToAmount);

  const isTxSubmittable =
    fromToken && toToken && fromChain && toChain && fromAmount && toAmount;

  const label = useMemo(() => {
    if (isTxSubmittable) {
      return t('bridge');
    }

    return t('swapSelectToken');
  }, [isTxSubmittable]);

  return (
    <Button
      data-testid="bridge-cta-button"
      onClick={() => {
        // if (isTxSubmittable) {
        console.log('bridge CTA button clicked');
        dispatch(signBridgeTransaction());
        // }
      }}
      // disabled={!isTxSubmittable}
    >
      {label}
    </Button>
  );
};
