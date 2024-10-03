import { act, fireEvent, waitFor, screen } from '@testing-library/react';
import nock from 'nock';
import mockMetaMaskState from '../../data/integration-init-state.json';
import { integrationTestRender } from '../../../lib/render-helpers';
import { shortenAddress } from '../../../../ui/helpers/utils/util';
import * as backgroundConnection from '../../../../ui/store/background-connection';
import {
  MetaMetricsEventCategory,
  MetaMetricsEventName,
  MetaMetricsEventLocation,
} from '../../../../shared/constants/metametrics';
import { MESSAGE_TYPE } from '../../../../shared/constants/app';
import { createMockImplementation } from '../../helpers';
import { tEn } from '../../../lib/i18n-helpers';
import {
  getMetaMaskStateWithUnapprovedPermitSign,
  verifyDetails,
} from './signature-helpers';

jest.mock('../../../../ui/store/background-connection', () => ({
  ...jest.requireActual('../../../../ui/store/background-connection'),
  submitRequestToBackground: jest.fn(),
}));

const mockedBackgroundConnection = jest.mocked(backgroundConnection);
const backgroundConnectionMocked = {
  onNotification: jest.fn(),
};

describe('Permit Confirmation', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedBackgroundConnection.submitRequestToBackground.mockImplementation(
      createMockImplementation({
        getTokenStandardAndDetails: { decimals: '2' },
      }),
    );
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('displays the header account modal with correct data', async () => {
    const account =
      mockMetaMaskState.internalAccounts.accounts[
        mockMetaMaskState.internalAccounts
          .selectedAccount as keyof typeof mockMetaMaskState.internalAccounts.accounts
      ];

    const accountName = account.metadata.name;
    const mockedMetaMaskState = getMetaMaskStateWithUnapprovedPermitSign(
      account.address,
      'Permit',
    );

    await act(async () => {
      await integrationTestRender({
        preloadedState: mockedMetaMaskState,
        backgroundConnection: backgroundConnectionMocked,
      });
    });

    expect(screen.getByTestId('header-account-name')).toHaveTextContent(
      accountName,
    );
    expect(screen.getByTestId('header-network-display-name')).toHaveTextContent(
      'Sepolia',
    );

    fireEvent.click(screen.getByTestId('header-info__account-details-button'));

    expect(
      await screen.findByTestId(
        'confirmation-account-details-modal__account-name',
      ),
    ).toHaveTextContent(accountName);
    expect(screen.getByTestId('address-copy-button-text')).toHaveTextContent(
      '0x0DCD5...3E7bc',
    );
    expect(
      screen.getByTestId('confirmation-account-details-modal__account-balance'),
    ).toHaveTextContent('1.582717SepoliaETH');

    let confirmAccountDetailsModalMetricsEvent;

    await waitFor(() => {
      confirmAccountDetailsModalMetricsEvent =
        mockedBackgroundConnection.submitRequestToBackground.mock.calls?.find(
          (call) =>
            call[0] === 'trackMetaMetricsEvent' &&
            (call[1] as unknown as Record<string, unknown>[])[0]?.event ===
              MetaMetricsEventName.AccountDetailsOpened,
        );
      expect(confirmAccountDetailsModalMetricsEvent?.[0]).toBe(
        'trackMetaMetricsEvent',
      );
    });

    expect(confirmAccountDetailsModalMetricsEvent?.[1]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: MetaMetricsEventCategory.Confirmations,
          event: MetaMetricsEventName.AccountDetailsOpened,
          properties: {
            action: 'Confirm Screen',
            location: MetaMetricsEventLocation.SignatureConfirmation,
            signature_type: MESSAGE_TYPE.ETH_SIGN_TYPED_DATA_V4,
          },
        }),
      ]),
    );

    fireEvent.click(
      screen.getByTestId('confirmation-account-details-modal__close-button'),
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId(
          'confirmation-account-details-modal__account-name',
        ),
      ).not.toBeInTheDocument();
    });
  });

  it('displays the expected title data', async () => {
    const account =
      mockMetaMaskState.internalAccounts.accounts[
        mockMetaMaskState.internalAccounts
          .selectedAccount as keyof typeof mockMetaMaskState.internalAccounts.accounts
      ];

    const mockedMetaMaskState = getMetaMaskStateWithUnapprovedPermitSign(
      account.address,
      'Permit',
    );

    await act(async () => {
      await integrationTestRender({
        preloadedState: mockedMetaMaskState,
        backgroundConnection: backgroundConnectionMocked,
      });
    });

    expect(screen.getByText('Spending cap request')).toBeInTheDocument();
    expect(
      screen.getByText('This site wants permission to spend your tokens.'),
    ).toBeInTheDocument();
  });

  it('displays the simulation section', async () => {
    const scope = nock('https://price.api.cx.metamask.io')
      .persist()
      .get('/v2/chains/1/spot-prices')
      .query({
        tokenAddresses:
          '0x0000000000000000000000000000000000000000,0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
        vsCurrency: 'ETH',
        includeMarketData: 'true',
      })
      .reply(200, {
        '0xcccccccccccccccccccccccccccccccccccccccc': {
          allTimeHigh: 12,
          allTimeLow: 1,
          circulatingSupply: 50000,
          dilutedMarketCap: 50000,
          high1d: 11,
          low1d: 9.9,
          marketCap: 10000,
          marketCapPercentChange1d: 1,
          price: 10,
          priceChange1d: 0.5,
          pricePercentChange1d: 1,
          pricePercentChange1h: 0,
          pricePercentChange1y: 80,
          pricePercentChange7d: 2,
          pricePercentChange14d: 5,
          pricePercentChange30d: 10,
          pricePercentChange200d: 50,
          totalVolume: 100,
        },
      });

    const account =
      mockMetaMaskState.internalAccounts.accounts[
        mockMetaMaskState.internalAccounts
          .selectedAccount as keyof typeof mockMetaMaskState.internalAccounts.accounts
      ];

    const mockedMetaMaskState = getMetaMaskStateWithUnapprovedPermitSign(
      account.address,
      'Permit',
    );

    await act(async () => {
      await integrationTestRender({
        preloadedState: {
          ...mockedMetaMaskState,
          selectedNetworkClientId: 'testNetworkConfigurationId',
          providerConfig: {
            type: 'rpc',
            nickname: 'test mainnet',
            chainId: '0x1',
            ticker: 'ETH',
            id: 'chain1',
          },
        },
        backgroundConnection: backgroundConnectionMocked,
      });
    });

    const simulationSection = screen.getByTestId(
      'confirmation__simulation_section',
    );
    expect(simulationSection).toBeInTheDocument();
    expect(simulationSection).toHaveTextContent('Estimated changes');
    expect(simulationSection).toHaveTextContent(
      "You're giving the spender permission to spend this many tokens from your account.",
    );
    expect(simulationSection).toHaveTextContent('Spending cap');
    expect(simulationSection).toHaveTextContent('0xCcCCc...ccccC');
    expect(screen.getByTestId('simulation-token-value')).toHaveTextContent(
      '30',
    );

    const individualFiatDisplay = await screen.findByTestId(
      'individual-fiat-display',
    );
    expect(individualFiatDisplay).toHaveTextContent('$166,836.00');

    scope.done();
    expect(scope.isDone()).toBe(true);
  });

  it('displays the MMI header warning when account signing is not the same as the account selected', async () => {
    const account =
      mockMetaMaskState.internalAccounts.accounts[
        '07c2cfec-36c9-46c4-8115-3836d3ac9047'
      ];
    const selectedAccount =
      mockMetaMaskState.internalAccounts.accounts[
        mockMetaMaskState.internalAccounts
          .selectedAccount as keyof typeof mockMetaMaskState.internalAccounts.accounts
      ];

    const mockedMetaMaskState = getMetaMaskStateWithUnapprovedPermitSign(
      account.address,
      'Permit',
    );

    await act(async () => {
      await integrationTestRender({
        preloadedState: mockedMetaMaskState,
        backgroundConnection: backgroundConnectionMocked,
      });
    });

    const mismatchAccountText = `Your selected account (${shortenAddress(
      selectedAccount.address,
    )}) is different than the account trying to sign (${shortenAddress(
      account.address,
    )})`;

    expect(screen.getByText(mismatchAccountText)).toBeInTheDocument();
  });

  it('displays the seaport signature', async () => {
    const account =
      mockMetaMaskState.internalAccounts.accounts[
        mockMetaMaskState.internalAccounts
          .selectedAccount as keyof typeof mockMetaMaskState.internalAccounts.accounts
      ];

    const mockedMetaMaskState = getMetaMaskStateWithUnapprovedPermitSign(
      account.address,
      'PermitSeaport',
    );

    await act(async () => {
      await integrationTestRender({
        preloadedState: {
          ...mockedMetaMaskState,
          selectedNetworkClientId: 'testNetworkConfigurationId',
          providerConfig: {
            type: 'rpc',
            nickname: 'test mainnet',
            chainId: '0x1',
            ticker: 'ETH',
            id: 'chain1',
          },
        },
        backgroundConnection: backgroundConnectionMocked,
      });
    });

    expect(
      screen.getByText(tEn('confirmTitleSignature') as string),
    ).toBeInTheDocument();
    expect(
      screen.getByText(tEn('confirmTitleDescSign') as string),
    ).toBeInTheDocument();

    const requestDetailsSection = screen.getByTestId(
      'confirmation_request-section',
    );

    expect(requestDetailsSection).toBeInTheDocument();
    expect(requestDetailsSection).toHaveTextContent('Request from');
    expect(requestDetailsSection).toHaveTextContent('metamask.github.io');
    expect(requestDetailsSection).toHaveTextContent('Interacting with');
    expect(requestDetailsSection).toHaveTextContent('0x00000...78BA3');

    const messageDetailsSection = screen.getByTestId(
      'confirmation_message-section',
    );
    expect(messageDetailsSection).toBeInTheDocument();
    const messageDetailsContent = [
      'Message',
      'Primary type:',
      'OrderComponents',
      'Offerer',
      '0x5a6f5...Ac994',
      'Zone',
      '0x004C0...60C00',
      'Offer',
    ];
    verifyDetails(messageDetailsSection, messageDetailsContent);

    const offers = screen.getByTestId('confirmation_data-offer-index-2');
    const offerDetails0 = offers.querySelector(
      '[data-testid="confirmation_data-0-index-0"]',
    );
    const offerDetails1 = offers.querySelector(
      '[data-testid="confirmation_data-1-index-1"]',
    );
    const considerations = screen.getByTestId(
      'confirmation_data-consideration-index-3',
    );
    const considerationDetails0 = considerations.querySelector(
      '[data-testid="confirmation_data-0-index-0"]',
    );

    expect(offerDetails0).toBeInTheDocument();
    expect(offerDetails1).toBeInTheDocument();
    expect(considerations).toBeInTheDocument();
    expect(considerationDetails0).toBeInTheDocument();

    const details = [
      {
        element: offerDetails0 as HTMLElement,
        content: [
          'ItemType',
          '2',
          'Token',
          'MutantApeYachtClub',
          'IdentifierOrCriteria',
          '26464',
          'StartAmount',
          '0.01',
          'EndAmount',
          '0.01',
        ],
      },
      {
        element: offerDetails1 as HTMLElement,
        content: [
          'ItemType',
          '2',
          'Token',
          'MutantApeYachtClub',
          'IdentifierOrCriteria',
          '7779',
          'StartAmount',
          '0.01',
          'EndAmount',
          '0.01',
        ],
      },
      {
        element: considerationDetails0 as HTMLElement,
        content: [
          'ItemType',
          '2',
          'Token',
          'MutantApeYachtClub',
          'IdentifierOrCriteria',
          '26464',
          'StartAmount',
          '0.01',
          'EndAmount',
          '0.01',
          'Recipient',
          '0xDFdc0...25Cc1',
        ],
      },
    ];

    details.forEach(({ element, content }) => {
      if (element) {
        verifyDetails(element, content);
      }
    });
  });
});
