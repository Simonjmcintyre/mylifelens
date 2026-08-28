import { useColors } from '@/hooks/useColors';
import { AppIcon } from '@/components/AppIcon';
import { router, Stack } from 'expo-router';
import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIVACY_EMAIL = 'simonjmcintyre@gmail.com';

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const colors = useColors();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>{children}</Text>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ title: 'Privacy Policy', headerShown: false }} />
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to MyLifelens"
              onPress={() => router.replace('/')}
              style={[styles.backButton, { backgroundColor: colors.card }]}
            >
              <AppIcon name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
            <View style={styles.headingCopy}>
              <Text style={[styles.kicker, { color: colors.primary }]}>MYLIFELENS</Text>
              <Text style={[styles.title, { color: colors.foreground }]}>Privacy policy</Text>
            </View>
          </View>

          <View style={[styles.introCard, { backgroundColor: colors.insightBackground }]}>
            <Text style={[styles.introTitle, { color: colors.insightForeground }]}>
              Your memories stay yours.
            </Text>
            <Text style={[styles.introBody, { color: colors.insightMuted }]}>
              MyLifelens is designed to help you document progress without requiring a cloud
              account or uploading your photos to us.
            </Text>
          </View>

          <Text style={[styles.updated, { color: colors.mutedForeground }]}>
            Effective date: 28 August 2026
          </Text>

          <PolicySection title="1. What this policy covers">
            This privacy policy explains how MyLifelens handles information when you use the
            MyLifelens mobile application. By using the app, you agree to the practices described
            here.
          </PolicySection>

          <PolicySection title="2. Information stored on your device">
            MyLifelens stores the projects you create, project details, notes, progress photos,
            photo dates, and reminder preferences locally on your device. We do not currently
            operate a MyLifelens account system or cloud photo-storage service, so this information
            is not uploaded to a MyLifelens server by the app. If you delete a project or remove
            the app, locally stored app data may be deleted. Keep your own backup of anything you
            do not want to lose.
          </PolicySection>

          <PolicySection title="3. Camera, photo library, and notifications">
            MyLifelens may request access to your camera and photo library so you can capture or
            choose progress photos. It may request notification permission so it can schedule the
            check-in reminders you choose. These permissions can be changed in your device
            settings. Photos remain on your device unless you deliberately share them or send
            them to another service.
          </PolicySection>

          <PolicySection title="4. Sharing">
            When you use a sharing feature, MyLifelens passes the content you choose to the
            native sharing tools on your device. The content may then be sent to the app or person
            you select. The privacy policy of that recipient or third-party service applies after
            you share the content.
          </PolicySection>

          <PolicySection title="5. Pro subscriptions">
            MyLifelens uses Apple App Store, Google Play, and RevenueCat to process and manage Pro
            subscriptions. These services may process purchase details, subscription status,
            transaction information, and an app-specific or anonymous customer identifier so that
            purchases can be completed, restored, and associated with Pro access. MyLifelens does
            not receive or store your full payment-card details.
          </PolicySection>

          <PolicySection title="6. Information we do not sell">
            We do not sell your photos, project information, or personal information. We do not
            use your photos to train models or for advertising. MyLifelens does not currently
            include third-party advertising.
          </PolicySection>

          <PolicySection title="7. Retention and deletion">
            You can delete projects and photos from within MyLifelens. You can also remove locally
            stored app data by uninstalling the app or using your device’s app-storage controls.
            App Store and RevenueCat purchase records are managed by those services and may be
            retained as required for purchase history, refunds, fraud prevention, accounting, and
            legal compliance.
          </PolicySection>

          <PolicySection title="8. Security">
            We use the device storage and platform services provided by iOS and Android. No method
            of electronic storage or transmission is completely secure, so please protect your
            device with a passcode and keep your operating system up to date.
          </PolicySection>

          <PolicySection title="9. Children’s privacy">
            MyLifelens is not directed at children under 13. We do not knowingly collect personal
            information from children through the app.
          </PolicySection>

          <PolicySection title="10. Changes to this policy">
            We may update this policy when the app’s features or data practices change. The
            effective date above will be updated when a new version is published.
          </PolicySection>

          <View style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.contactTitle, { color: colors.foreground }]}>Questions?</Text>
            <Text style={[styles.contactBody, { color: colors.mutedForeground }]}>
              For privacy questions or requests, contact:
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => Linking.openURL(`mailto:${PRIVACY_EMAIL}`)}
              style={styles.emailButton}
            >
              <AppIcon name="share-2" size={16} color={colors.primary} />
              <Text style={[styles.email, { color: colors.primary }]}>{PRIVACY_EMAIL}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingCopy: {
    flex: 1,
  },
  kicker: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 30,
    letterSpacing: -1,
  },
  introCard: {
    borderRadius: 22,
    padding: 22,
    marginBottom: 16,
  },
  introTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  introBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 23,
  },
  updated: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginBottom: 28,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    letterSpacing: -0.25,
    marginBottom: 8,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 24,
  },
  contactCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginTop: 3,
  },
  contactTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    marginBottom: 6,
  },
  contactBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  email: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
});