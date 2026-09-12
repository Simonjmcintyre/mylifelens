import { useColors } from '@/hooks/useColors';
import { Image, ImageSourcePropType, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import React from 'react';

const sampleSources: Record<string, ImageSourcePropType> = {
  'sample-garden': require('@/assets/images/sample-garden.jpg'),
  'sample-garden-finished': require('@/assets/images/sample-garden-finished.jpg'),
};

export function PhotoImage({
  uri,
  style,
  resizeMode = 'cover',
  blurRadius = 0,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  resizeMode?: 'cover' | 'contain';
  blurRadius?: number;
}) {
  const colors = useColors();
  const source = sampleSources[uri] ?? { uri };
  return (
    <View style={[styles.wrapper, { backgroundColor: colors.muted }, style]}>
      <Image source={source} resizeMode={resizeMode} blurRadius={blurRadius} style={styles.image} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});