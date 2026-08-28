import Constants from 'expo-constants';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { createContext, useContext, useEffect } from 'react';
import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

const TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = 'pro';
export const FREE_PROJECT_LIMIT = 1;

let isInitialized = false;
let initializationError: string | null = null;

export function isRevenueCatTestMode() {
  return __DEV__ || Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient';
}

function getApiKey() {
  if (isRevenueCatTestMode()) return TEST_API_KEY;
  if (Platform.OS === 'ios') return IOS_API_KEY;
  if (Platform.OS === 'android') return ANDROID_API_KEY;
  return TEST_API_KEY;
}

export function initializeRevenueCat() {
  if (isInitialized) return;

  const apiKey = getApiKey();
  if (!apiKey) {
    initializationError = 'RevenueCat public app keys are not configured.';
    throw new Error(initializationError);
  }

  try {
    Purchases.setLogLevel(__DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.WARN);
    Purchases.configure({ apiKey });
    isInitialized = true;
    initializationError = null;
  } catch (error) {
    initializationError = error instanceof Error ? error.message : 'RevenueCat could not be started.';
    throw error;
  }
}

function useSubscriptionContext() {
  const queryClient = useQueryClient();
  const customerInfoQuery = useQuery({
    queryKey: ['revenuecat', 'customer-info'],
    queryFn: () => Purchases.getCustomerInfo(),
    enabled: isInitialized,
    staleTime: 60_000,
    retry: 1,
  });
  const offeringsQuery = useQuery({
    queryKey: ['revenuecat', 'offerings'],
    queryFn: () => Purchases.getOfferings(),
    enabled: isInitialized,
    staleTime: 300_000,
    retry: 1,
  });

  useEffect(() => {
    if (!isInitialized) return;
    const listener = (customerInfo: CustomerInfo) => {
      queryClient.setQueryData(['revenuecat', 'customer-info'], customerInfo);
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [queryClient]);

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: PurchasesPackage) => {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      return customerInfo;
    },
    onSuccess: (customerInfo) => {
      queryClient.setQueryData(['revenuecat', 'customer-info'], customerInfo);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => Purchases.restorePurchases(),
    onSuccess: (customerInfo) => {
      queryClient.setQueryData(['revenuecat', 'customer-info'], customerInfo);
    },
  });

  const customerInfo = customerInfoQuery.data;
  const offerings = offeringsQuery.data;
  const packageToPurchase = offerings?.current?.availablePackages[0];
  const isSubscribed =
    customerInfo?.entitlements.active[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;
  const queryError = customerInfoQuery.error ?? offeringsQuery.error;

  return {
    customerInfo,
    offerings,
    packageToPurchase,
    isSubscribed,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    isAvailable: isInitialized,
    error:
      initializationError ??
      (queryError instanceof Error ? queryError.message : queryError ? 'Subscriptions are unavailable.' : null),
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error('useSubscription must be used inside SubscriptionProvider');
  return context;
}