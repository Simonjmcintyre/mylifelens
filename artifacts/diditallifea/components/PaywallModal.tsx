import { AppIcon } from '@/components/AppIcon';
import { useColors } from '@/hooks/useColors';
import { isRevenueCatTestMode, useSubscription } from '@/lib/revenuecat';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PaywallModalProps = {
  visible: boolean;
  onClose: () => void;
};

const benefits = [
  'Create unlimited visual projects',
  'Keep every progress story in one place',
  'Use alignment, reminders, morphs and sharing',
];

export function PaywallModal({ visible, onClose }: PaywallModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    monthlyPackage,
    annualPackage,
    isSubscribed,
    isLoading,
    isAvailable,
    error,
    purchase,
    restore,
    isPurchasing,
    isRestoring,
  } = useSubscription();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedPackageIdentifier, setSelectedPackageIdentifier] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setShowConfirmation(false);
      setActionMessage(null);
      setSelectedPackageIdentifier(null);
    }
  }, [visible]);

  const selectedPackage =
    [annualPackage, monthlyPackage].find(
      (item) => item?.identifier === selectedPackageIdentifier,
    ) ??
    annualPackage ??
    monthlyPackage;
  const isBusy = isPurchasing || isRestoring;
  const savings =
    annualPackage && monthlyPackage
      ? Math.max(
          0,
          Math.round(
            (1 - annualPackage.product.price / (monthlyPackage.product.price * 12)) * 100,
          ),
        )
      : 0;
  const plans: Array<{ label: string; detail: string; package: PurchasesPackage | null }> = [
    {
      label: 'Annual',
      detail: annualPackage?.product.pricePerMonthString
        ? `${annualPackage.product.pricePerMonthString}/month, billed yearly`
        : 'Billed yearly',
      package: annualPackage,
    },
    {
      label: 'Monthly',
      detail: 'Billed monthly',
      package: monthlyPackage,
    },
  ];

  const finishPurchase = async () => {
    if (!selectedPackage) return;
    setShowConfirmation(false);
    setActionMessage(null);
    try {
      await purchase(selectedPackage);
      setActionMessage('Pro is active. You can now create unlimited projects.');
    } catch (purchaseError) {
      if ((purchaseError as { userCancelled?: boolean }).userCancelled) return;
      setActionMessage(
        purchaseError instanceof Error ? purchaseError.message : 'The purchase could not be completed.',
      );
    }
  };

  const startPurchase = () => {
    if (!selectedPackage || isBusy) return;
    if (isRevenueCatTestMode()) {
      setShowConfirmation(true);
      return;
    }
    void finishPurchase();
  };

  const restorePurchase = async () => {
    setActionMessage(null);
    try {
      const customerInfo = await restore();
      const restored = customerInfo.entitlements.active.pro !== undefined;
      setActionMessage(
        restored ? 'Your Pro access has been restored.' : 'No previous Pro purchase was found.',
      );
    } catch (restoreError) {
      setActionMessage(
        restoreError instanceof Error ? restoreError.message : 'Purchases could not be restored.',
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(23, 33, 43, 0.58)' }]}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 18) + 12 },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.topRow}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primary }]}>
              <AppIcon name="aperture" size={24} color={colors.foreground} />
            </View>
            <Pressable
              testID="close-paywall"
              accessibilityLabel="Close"
              onPress={onClose}
              style={styles.closeButton}
            >
              <AppIcon name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <Text style={[styles.eyebrow, { color: colors.primary }]}>MYLIFELENS PRO</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {isSubscribed ? 'Your full story is unlocked.' : 'Make room for every story.'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {isSubscribed
              ? 'Pro is active on this device.'
              : 'Your first project is free. Upgrade when you are ready to track more.'}
          </Text>

          <View style={styles.benefits}>
            {benefits.map((benefit) => (
              <View key={benefit} style={styles.benefitRow}>
                <View style={[styles.check, { backgroundColor: colors.primary }]}>
                  <AppIcon name="check" size={13} color={colors.foreground} strokeWidth={2.6} />
                </View>
                <Text style={[styles.benefitText, { color: colors.foreground }]}>{benefit}</Text>
              </View>
            ))}
          </View>

          {!!actionMessage && (
            <View style={[styles.message, { backgroundColor: colors.background }]}>
              <Text style={[styles.messageText, { color: colors.foreground }]}>{actionMessage}</Text>
            </View>
          )}
          {!actionMessage && !!error && (
            <View style={[styles.message, { backgroundColor: colors.background }]}>
              <Text style={[styles.messageText, { color: colors.destructive }]}>{error}</Text>
            </View>
          )}

          {!isSubscribed && (
            <View style={styles.planList} accessibilityRole="radiogroup">
              {plans.map((plan) => {
                const isSelected = plan.package?.identifier === selectedPackage?.identifier;
                const isAnnual = plan.label === 'Annual';
                return (
                  <Pressable
                    key={plan.label}
                    testID={`plan-${plan.label.toLowerCase()}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected, disabled: !plan.package }}
                    disabled={!plan.package || isBusy}
                    onPress={() => setSelectedPackageIdentifier(plan.package?.identifier ?? null)}
                    style={({ pressed }) => [
                      styles.plan,
                      {
                        backgroundColor: isSelected ? colors.secondary : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                      isSelected && styles.selectedPlan,
                      !plan.package && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.planCopy}>
                      <View style={styles.planTitleRow}>
                        <Text style={[styles.planTitle, { color: colors.foreground }]}>
                          {plan.label}
                        </Text>
                        {isAnnual && savings > 0 && (
                          <View style={[styles.savingsBadge, { backgroundColor: colors.primary }]}>
                            <Text style={[styles.savingsText, { color: colors.primaryForeground }]}>
                              SAVE {savings}%
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.planDetail, { color: colors.mutedForeground }]}>
                        {plan.package ? plan.detail : 'Not available'}
                      </Text>
                    </View>
                    <Text style={[styles.planPrice, { color: colors.foreground }]}>
                      {plan.package?.product.priceString ?? '—'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {!isSubscribed && (
            <Pressable
              testID="purchase-pro"
              disabled={!selectedPackage || isBusy || !isAvailable}
              onPress={startPurchase}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.foreground },
                (!selectedPackage || isBusy || !isAvailable) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              {isPurchasing ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <Text style={[styles.primaryText, { color: colors.background }]}>
                    {isLoading
                      ? 'Loading offers…'
                      : selectedPackage
                        ? `Get Pro · ${selectedPackage.product.priceString}`
                        : 'Offer unavailable'}
                  </Text>
                  {!!selectedPackage && (
                    <AppIcon name="arrow-right" size={18} color={colors.background} />
                  )}
                </>
              )}
            </Pressable>
          )}

          {isSubscribed && (
            <Pressable
              testID="continue-with-pro"
              onPress={onClose}
              style={[styles.primaryButton, { backgroundColor: colors.foreground }]}
            >
              <Text style={[styles.primaryText, { color: colors.background }]}>Continue with Pro</Text>
            </Pressable>
          )}

          <Pressable
            testID="restore-purchases"
            disabled={isBusy || !isAvailable}
            onPress={() => void restorePurchase()}
            style={styles.restoreButton}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color={colors.mutedForeground} />
            ) : (
              <Text style={[styles.restoreText, { color: colors.mutedForeground }]}>
                Restore purchases
              </Text>
            )}
          </Pressable>
          <Text style={[styles.legal, { color: colors.mutedForeground }]}>
            Payment renews through your app store unless cancelled in your store settings.
          </Text>
        </View>
      </View>

      <Modal
        visible={showConfirmation}
        animationType="fade"
        transparent
        onRequestClose={() => setShowConfirmation(false)}
      >
        <View style={[styles.confirmBackdrop, { backgroundColor: 'rgba(23, 33, 43, 0.68)' }]}>
          <View style={[styles.confirmCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.confirmEyebrow, { color: colors.primary }]}>TEST PURCHASE</Text>
            <Text style={[styles.confirmTitle, { color: colors.foreground }]}>
              Activate MyLifelens Pro?
            </Text>
            <Text style={[styles.confirmBody, { color: colors.mutedForeground }]}>
              {selectedPackage
                ? `${selectedPackage.product.priceString} for the selected ${selectedPackage === annualPackage ? 'annual' : 'monthly'} plan. This uses RevenueCat’s test store, so no real payment will be taken.`
                : 'This uses RevenueCat’s test store. No real payment will be taken.'}
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                testID="cancel-test-purchase"
                onPress={() => setShowConfirmation(false)}
                style={[styles.confirmButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.confirmButtonText, { color: colors.foreground }]}>Not now</Text>
              </Pressable>
              <Pressable
                testID="confirm-test-purchase"
                onPress={() => void finishPurchase()}
                style={[styles.confirmButton, { backgroundColor: colors.foreground }]}
              >
                <Text style={[styles.confirmButtonText, { color: colors.background }]}>Activate</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22, paddingTop: 12 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#C9C3B8', alignSelf: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  iconWrap: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.6, marginTop: 23 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, lineHeight: 33, letterSpacing: -1, marginTop: 8, maxWidth: 330 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, marginTop: 9, maxWidth: 330 },
  benefits: { gap: 13, marginTop: 24, marginBottom: 22 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  benefitText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 19 },
  message: { borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 12 },
  messageText: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  planList: { gap: 10, marginBottom: 14 },
  plan: {
    minHeight: 70,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectedPlan: { borderWidth: 2, paddingHorizontal: 13, paddingVertical: 11 },
  planCopy: { flex: 1, gap: 4 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  planDetail: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 15 },
  planPrice: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  savingsBadge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  savingsText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.5 },
  primaryButton: { height: 55, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primaryText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  restoreButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  restoreText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  legal: { fontFamily: 'Inter_400Regular', textAlign: 'center', fontSize: 10, lineHeight: 14, paddingHorizontal: 22 },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  confirmBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmCard: { width: '100%', maxWidth: 360, borderRadius: 24, padding: 22 },
  confirmEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.5 },
  confirmTitle: { fontFamily: 'Inter_700Bold', fontSize: 23, marginTop: 8, letterSpacing: -0.6 },
  confirmBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 8 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  confirmButton: { flex: 1, height: 47, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  confirmButtonText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
});