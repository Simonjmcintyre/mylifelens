import { PhotoImage } from '@/components/PhotoImage';
import { useProjects } from '@/context/ProjectContext';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

export default function TimelineScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id, finishing } = useLocalSearchParams<{ id: string; finishing?: string }>();
  const { projects, completeProject } = useProjects();
  const project = projects.find((item) => item.id === id);
  const [isCompleting, setIsCompleting] = useState(false);

  if (!project) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.foreground }}>Project not found</Text></View>;
  const first = project.photos[0];
  const last = project.photos[project.photos.length - 1];

  const finish = async () => {
    setIsCompleting(true);
    await completeProject(project.id);
    setIsCompleting(false);
    Alert.alert('Story complete', 'Your full visual journey is ready to share.');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        <View style={styles.topBar}><Pressable onPress={() => router.back()} style={styles.backButton}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable><Text style={[styles.topTitle, { color: colors.foreground }]}>Timeline</Text><Pressable testID="share-timeline-button" onPress={() => void Share.share({ message: `${project.name} — ${project.photos.length} frames from start to finish.` })} style={styles.shareButton}><Feather name="share-2" size={19} color={colors.foreground} /></Pressable></View>
        <View style={styles.heading}><Text style={[styles.eyebrow, { color: colors.primary }]}>THE FULL STORY</Text><Text style={[styles.title, { color: colors.foreground }]}>{project.name}</Text><Text style={[styles.subtitle, { color: colors.mutedForeground }]}>A stitched view of {project.photos.length} moments, from first frame to now.</Text></View>

        {first && last && <View style={styles.comparison}><View style={styles.comparisonCard}><PhotoImage uri={first.uri} style={styles.comparisonImage} /><View style={styles.comparisonLabel}><Text style={[styles.comparisonEyebrow, { color: colors.primary }]}>THEN</Text><Text style={[styles.comparisonDate, { color: colors.background }]}>{dateLabel(first.capturedAt)}</Text></View></View><View style={[styles.arrowCircle, { backgroundColor: colors.primary }]}><Feather name="arrow-right" size={16} color={colors.primaryForeground} /></View><View style={styles.comparisonCard}><PhotoImage uri={last.uri} style={styles.comparisonImage} /><View style={styles.comparisonLabel}><Text style={[styles.comparisonEyebrow, { color: colors.primary }]}>NOW</Text><Text style={[styles.comparisonDate, { color: colors.background }]}>{dateLabel(last.capturedAt)}</Text></View></View></View>}

        <View style={[styles.mergeBanner, { backgroundColor: colors.secondary }]}><View style={[styles.mergeIcon, { backgroundColor: colors.primary }]}><Feather name="layers" size={17} color={colors.primaryForeground} /></View><View style={styles.mergeCopy}><Text style={[styles.mergeTitle, { color: colors.secondaryForeground }]}>Your merged journey</Text><Text style={[styles.mergeBody, { color: colors.mutedForeground }]}>Each frame is ordered for a simple start-to-finish view.</Text></View></View>

        <View style={styles.sectionHeading}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Every chapter</Text><Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>{project.photos.length} frames</Text></View>
        <View style={styles.timeline}>{project.photos.map((photo, index) => <View key={photo.id} style={styles.timelineItem}><View style={styles.timelineRail}><View style={[styles.timelineDot, { backgroundColor: index === 0 || index === project.photos.length - 1 ? colors.primary : colors.mutedForeground }]} />{index < project.photos.length - 1 && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}</View><View style={styles.frameCard}><PhotoImage uri={photo.uri} style={styles.frameImage} /><View style={styles.frameCopy}><Text style={[styles.frameNumber, { color: colors.primary }]}>{index === 0 ? 'START' : index === project.photos.length - 1 ? 'LATEST' : `FRAME ${String(index + 1).padStart(2, '0')}`}</Text><Text style={[styles.frameDate, { color: colors.foreground }]}>{dateLabel(photo.capturedAt)}</Text>{photo.note && <Text style={[styles.frameNote, { color: colors.mutedForeground }]}>{photo.note}</Text>}</View></View></View>)}</View>

        {!project.completed && project.photos.length >= 2 && <Pressable testID="complete-story-button" disabled={isCompleting} onPress={() => void finish()} style={({ pressed }) => [styles.completeButton, { backgroundColor: colors.foreground }, pressed && styles.pressed, isCompleting && { opacity: 0.55 }]}><Feather name="flag" size={17} color={colors.background} /><Text style={[styles.completeText, { color: colors.background }]}>{finishing === 'true' ? 'Finish and save this story' : 'Mark project finished'}</Text></Pressable>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { height: 62, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButton: { width: 42, height: 42, justifyContent: 'center' },
  shareButton: { width: 42, height: 42, alignItems: 'flex-end', justifyContent: 'center' },
  topTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  heading: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 21 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.4 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 34, letterSpacing: -1.5, marginTop: 10 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, marginTop: 10 },
  comparison: { marginHorizontal: 20, height: 190, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  comparisonCard: { flex: 1, height: 190, borderRadius: 18, overflow: 'hidden', backgroundColor: '#17212B', position: 'relative' },
  comparisonImage: { width: '100%', height: '100%', opacity: 0.82 },
  comparisonLabel: { position: 'absolute', left: 12, right: 12, bottom: 11 },
  comparisonEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  comparisonDate: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 3 },
  arrowCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginHorizontal: -19, zIndex: 2 },
  mergeBanner: { marginHorizontal: 20, marginTop: 24, borderRadius: 17, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  mergeIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mergeCopy: { flex: 1 },
  mergeTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  mergeBody: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 },
  sectionHeading: { paddingHorizontal: 20, marginTop: 30, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.5 },
  sectionHint: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  timeline: { paddingHorizontal: 20 },
  timelineItem: { flexDirection: 'row', gap: 12 },
  timelineRail: { width: 11, alignItems: 'center' },
  timelineDot: { width: 9, height: 9, borderRadius: 5, marginTop: 18 },
  timelineLine: { width: 1, flex: 1, marginTop: 5, marginBottom: -1 },
  frameCard: { flex: 1, borderRadius: 18, marginBottom: 14, overflow: 'hidden', backgroundColor: '#FFFDF8' },
  frameImage: { height: 175, width: '100%' },
  frameCopy: { padding: 13 },
  frameNumber: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  frameDate: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginTop: 5 },
  frameNote: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 6 },
  completeButton: { marginHorizontal: 20, height: 53, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  completeText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});