import Constants from 'expo-constants';

type FeatureFlags = {
  authEnabled?: boolean;
  subscriptionsEnabled?: boolean;
};

const extra = (Constants.expoConfig?.extra ?? Constants.manifest?.extra) as
  | { featureFlags?: FeatureFlags }
  | undefined;

const flags = extra?.featureFlags ?? {};

export const authEnabled = flags.authEnabled !== false;
export const subscriptionsEnabled = flags.subscriptionsEnabled !== false;
