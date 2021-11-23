import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Box from '../../ui/box';
import Button from '../../ui/button';
import Typography from '../../ui/typography/typography';
import {
  COLORS,
  TYPOGRAPHY,
  TEXT_ALIGN,
  JUSTIFY_CONTENT,
  FLEX_DIRECTION,
  ALIGN_ITEMS,
  DISPLAY,
  BLOCK_SIZES,
  SIZES,
  FLEX_WRAP,
} from '../../../helpers/constants/design-system';
import { useI18nContext } from '../../../hooks/useI18nContext';
import { getEnvironmentType } from '../../../../app/scripts/lib/util';
import { ENVIRONMENT_TYPE_POPUP } from '../../../../shared/constants/app';

export default function CollectiblesItems({ onAddNFT, onRefreshList }) {
  const t = useI18nContext();
  const collections = {
    Opensea: {
      icon: './images/opensea-icon.svg',
      collectibles: [
        { icon: './images/kitty-1.svg', backgroundColor: COLORS.PRIMARY1 },
        { icon: './images/kitty-2.svg', backgroundColor: COLORS.ALERT3 },
        { icon: './images/kitty-3.svg', backgroundColor: COLORS.SUCCESS1 },
        { icon: './images/kitty-1.svg', backgroundColor: COLORS.ERROR3 },
        { icon: './images/kitty-2.svg', backgroundColor: COLORS.ALERT3 },
        { icon: './images/kitty-3.svg', backgroundColor: COLORS.SUCCESS1 },
        { icon: './images/kitty-1.svg', backgroundColor: COLORS.ERROR3 },
        { icon: './images/kitty-2.svg', backgroundColor: COLORS.ALERT3 },
      ],
    },
    CryptoKitties: {
      icon: './images/opensea-icon.svg',
      collectibles: [
        { icon: './images/kitty-1.svg', backgroundColor: COLORS.PRIMARY1 },
        { icon: './images/kitty-2.svg', backgroundColor: COLORS.ALERT3 },
      ],
    },
  };
  const defaultDropdownState = {};

  Object.keys(collections).forEach((key) => {
    defaultDropdownState[key] = true;
  });

  const [dropdownState, setDropdownState] = useState(defaultDropdownState);

  return (
    <div className="collectibles-items">
      <Box padding={[4, 6, 4, 6]} flexDirection={FLEX_DIRECTION.COLUMN}>
        <>
          {Object.keys(collections).map((key, index) => {
            const { icon, collectibles } = collections[key];
            const isExpanded = dropdownState[key];

            return (
              <div key={`collection-${index}`}>
                <Box
                  marginTop={4}
                  marginBottom={4}
                  display={DISPLAY.FLEX}
                  alignItems={ALIGN_ITEMS.CENTER}
                  justifyContent={JUSTIFY_CONTENT.SPACE_BETWEEN}
                >
                  <Box alignItems={ALIGN_ITEMS.CENTER}>
                    <img width="28" src={icon} />
                    <Typography
                      color={COLORS.BLACK}
                      variant={TYPOGRAPHY.H4}
                      margin={[0, 0, 0, 2]}
                    >
                      {`${key} (${collectibles.length})`}
                    </Typography>
                  </Box>
                  <Box alignItems={ALIGN_ITEMS.FLEX_END}>
                    <i
                      className={`fa fa-lg fa-chevron-${
                        isExpanded ? 'down' : 'right'
                      }`}
                      onClick={() => {
                        setDropdownState((_dropdownState) => ({
                          ..._dropdownState,
                          [key]: !isExpanded,
                        }));
                      }}
                    />
                  </Box>
                </Box>
                {isExpanded ? (
                  <Box display={DISPLAY.FLEX} flexWrap={FLEX_WRAP.WRAP}>
                    {collectibles.map((collectible, i) => {
                      const width =
                        getEnvironmentType() === ENVIRONMENT_TYPE_POPUP
                          ? BLOCK_SIZES.ONE_THIRD
                          : BLOCK_SIZES.ONE_SIXTH;
                      return (
                        <Box width={width} padding={2} key={`collectible-${i}`}>
                          <Box
                            borderRadius={SIZES.MD}
                            backgroundColor={collectible.backgroundColor}
                          >
                            <img src={collectible.icon} />
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                ) : null}
              </div>
            );
          })}
          <Box
            marginTop={6}
            flexDirection={FLEX_DIRECTION.COLUMN}
            justifyContent={JUSTIFY_CONTENT.CENTER}
          >
            <Typography
              color={COLORS.UI3}
              variant={TYPOGRAPHY.H5}
              align={TEXT_ALIGN.CENTER}
            >
              {t('missingNFT')}
            </Typography>
            <Box
              alignItems={ALIGN_ITEMS.CENTER}
              justifyContent={JUSTIFY_CONTENT.CENTER}
            >
              <Box justifyContent={JUSTIFY_CONTENT.FLEX_END}>
                <Button
                  type="link"
                  onClick={onRefreshList}
                  style={{ padding: '5px' }}
                >
                  {t('refreshList')}
                </Button>
              </Box>
              <Typography
                color={COLORS.UI3}
                variant={TYPOGRAPHY.H4}
                align={TEXT_ALIGN.CENTER}
              >
                {t('or')}
              </Typography>
              <Box justifyContent={JUSTIFY_CONTENT.FLEX_START}>
                <Button
                  type="link"
                  onClick={onAddNFT}
                  style={{ padding: '5px' }}
                >
                  {t('addNFT').toLowerCase()}
                </Button>
              </Box>
            </Box>
          </Box>
        </>
      </Box>
    </div>
  );
}

CollectiblesItems.propTypes = {
  onAddNFT: PropTypes.func.isRequired,
  onRefreshList: PropTypes.func.isRequired,
};
