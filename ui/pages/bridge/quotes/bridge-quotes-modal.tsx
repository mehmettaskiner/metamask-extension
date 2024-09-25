import React from 'react';
import {
  Box,
  Modal,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
} from '../../../components/component-library';
import {
  TextAlign,
  TextVariant,
} from '../../../helpers/constants/design-system';
import { useSelector } from 'react-redux';
import { getBridgeQuotes } from '../../../ducks/bridge/selectors';
import { getQuoteDisplayData } from '../utils/quote';

export const BridgeQuotesModal = ({
  onClose,
  ...modalProps
}: Omit<React.ComponentProps<typeof Modal>, 'children'>) => {
  const { quotes } = useSelector(getBridgeQuotes);

  return (
    <Modal className="quotes-modal" onClose={onClose} {...modalProps}>
      <ModalOverlay />
      <ModalContent modalDialogProps={{ padding: 0 }}>
        <ModalHeader onClose={onClose}>
          <Text variant={TextVariant.headingSm} textAlign={TextAlign.Center}>
            Test
          </Text>
        </ModalHeader>

        <Box>
          {quotes.map((quote, index) => (
            <Box key={index}>
              <Text>{JSON.stringify(quote.quote)}</Text>
              <Text>{JSON.stringify(getQuoteDisplayData(quote))}</Text>
            </Box>
          ))}
        </Box>
      </ModalContent>
    </Modal>
  );
};
