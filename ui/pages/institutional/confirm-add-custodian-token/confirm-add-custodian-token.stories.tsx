import React from 'react';
import { Provider } from 'react-redux';
import configureStore from '../../../store/store';
import testData from '../../../../.storybook/test-data';
import ConfirmAddCustodianToken from '.';
import { MetaMaskInpageProvider } from '@metamask/providers';
import { MetaMaskState } from '../../../reducers/metamask/metamask';

interface CustomData extends MetaMaskState {
  metamask: MetaMaskState & {
    institutionalFeatures: {
      connectRequests: Array<{
        labels: Array<{
          key: string;
          value: string;
        }>;
        origin: string;
        token: string;
        feature: string;
        service: string;
        chainId: number;
        environment: string;
      }>;
    };
  };
}

const customData: CustomData = {
  ...testData,
  metamask: {
    ...testData.metamask,
    institutionalFeatures: {
      connectRequests: [
        {
          labels: [
            {
              key: 'service',
              value: 'test',
            },
          ],
          origin: 'origin',
          token: 'awesomeTestToken',
          feature: 'custodian',
          service: 'Saturn',
          chainId: 1,
          environment: 'test-environment',
        },
      ],
    },
  },
};

const store = configureStore(customData);

export default {
  title: 'Pages/Institutional/ConfirmAddCustodianToken',
  decorators: [(story: () => React.ReactNode) => <Provider store={store}>{story()}</Provider>],
  component: ConfirmAddCustodianToken,
};

export const DefaultStory = () => <ConfirmAddCustodianToken />;

DefaultStory.storyName = 'ConfirmAddCustodianToken';
