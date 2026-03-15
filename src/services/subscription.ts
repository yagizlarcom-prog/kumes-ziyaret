import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

type RevenueCatConfig = {
  appleApiKey: string;
  googleApiKey: string;
  entitlementId: string;
};

const extra = (Constants.expoConfig?.extra ?? Constants.manifest?.extra) as
  | { revenueCat?: RevenueCatConfig }
  | undefined;

const revenueCat = extra?.revenueCat;

export const revenueCatMissingConfig =
  !revenueCat?.entitlementId ||
  (Platform.OS === 'ios' ? !revenueCat?.appleApiKey : !revenueCat?.googleApiKey);

let configured = false;
let purchasesModule: any | null = null;

const loadPurchases = async () => {
  if (purchasesModule) return purchasesModule;
  const mod = await import('react-native-purchases');
  purchasesModule = (mod as any).default ?? mod;
  return purchasesModule;
};

export const configurePurchases = async (appUserId: string) => {
  if (!revenueCat) throw new Error('RevenueCat anahtarları eksik.');
  const apiKey = Platform.OS === 'ios' ? revenueCat.appleApiKey : revenueCat.googleApiKey;
  if (!apiKey) throw new Error('RevenueCat API anahtarı eksik.');

  const Purchases = await loadPurchases();
  if (!configured) {
    Purchases.configure({ apiKey, appUserID: appUserId });
    configured = true;
  } else {
    await Purchases.logIn(appUserId);
  }
};

export const getEntitlementId = () => revenueCat?.entitlementId || 'pro';

export const getCustomerInfo = async () => {
  const Purchases = await loadPurchases();
  return Purchases.getCustomerInfo();
};

export const getOfferings = async (): Promise<PurchasesOffering | null> => {
  const Purchases = await loadPurchases();
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
};

export const purchasePackage = async (pkg: PurchasesPackage) => {
  const Purchases = await loadPurchases();
  return Purchases.purchasePackage(pkg);
};

export const restorePurchases = async () => {
  const Purchases = await loadPurchases();
  return Purchases.restorePurchases();
};

export const logOutPurchases = async () => {
  const Purchases = await loadPurchases();
  return Purchases.logOut();
};

export const isEntitlementActive = (info: CustomerInfo, entitlementId: string) => {
  const entitlement = info.entitlements.active[entitlementId];
  return Boolean(entitlement && entitlement.isActive);
};
