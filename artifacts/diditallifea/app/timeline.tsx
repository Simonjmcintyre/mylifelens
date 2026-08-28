import { PhotoImage } from '@/components/PhotoImage';
import { useProjects } from '@/context/ProjectContext';
import { useColors } from '@/hooks/useColors';
import { AppIcon as Feather } from '@/components/AppIcon';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, GestureResponderEvent, PanResponder, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

const showMessage = (title: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
};

export default function TimelineScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id, finishing } = useLocalSearchParams<{ id: string; finishing?: string }>();
  const { projects, completeProject } = useProjects();
  const project = projects.find((item) => item.id === id);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [morphFrame, setMorphFrame] = useState(0);
  const [morphSpeed, setMorphSpeed] = useState(1);
  const speedTrackWidth = useRef(0);
  const morphBlend = useRef(new Animated.Value(0)).current;
  const photos = project?.photos ?? [];
  const speedOptions = [0.5, 1, 1.5, 2];
  const speedPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event: GestureResponderEvent) => updateSpeedFromX(event.nativeEvent.locationX),
      onPanResponderMove: (event: GestureResponderEvent) => updateSpeedFromX(event.nativeEvent.locationX),
    }),
  ).current;

  function updateSpeedFromX(locationX: number) {
    if (!speedTrackWidth.current) return;
    const progress = Math.max(0, Math.min(1, locationX / speedTrackWidth.current));
    const optionIndex = Math.round(progress * (speedOptions.length - 1));
    setMorphSpeed(speedOptions[optionIndex]);
  }

  useEffect(() => {
    if (!isPlaying || photos.length < 2 || morphFrame >= photos.length - 1) return;
    morphBlend.setValue(0);
    const animation = Animated.timing(morphBlend, {
      toValue: 1,
      duration: 1800 / morphSpeed,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (!finished) return;
      if (morphFrame < photos.length - 2) {
        setMorphFrame((current) => current + 1);
      } else {
        setIsPlaying(false);
        setMorphFrame(photos.length - 1);
        morphBlend.setValue(0);
      }
    });
    return () => animation.stop();
  }, [isPlaying, morphBlend, morphFrame, morphSpeed, photos.length]);

  if (!project) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.foreground }}>Project not found</Text></View>;
  const first = project.photos[0];
  const last = project.photos[project.photos.length - 1];

  const shareStory = async () => {
    try {
      await Share.share({
        message: `${project.name} — ${project.photos.length} ${project.photos.length === 1 ? 'frame' : 'frames'} from start to finish.\n\nSee the journey with MyLifelens.`,
        ...(last?.isSample ? {} : last ? { url: last.uri } : {}),
      });
    } catch {
      Alert.alert('Sharing unavailable', 'We could not open the sharing sheet right now.');
    }
  };

  const downloadMorph = async () => {
    const frame = photos[morphFrame] ?? photos[0];
    if (!frame) {
      showMessage('Add a frame first', 'Capture at least one progress photo before downloading a preview.');
      return;
    }
    if (frame.isSample) {
      showMessage('Add a real frame first', 'The sample preview is for exploring MyLifelens. Add your own photo to download it.');
      return;
    }
    try {
      await Share.share({
        title: `${project.name} morph preview`,
        message: `${project.name} — morph preview frame ${morphFrame + 1} of ${photos.length}.`,
        url: frame.uri,
      });
    } catch {
      showMessage('Download unavailable', 'We could not open the system save sheet right now.');
    }
  };

  const toggleMorph = () => {
    if (photos.length < 2) {
      Alert.alert('Add another frame first', 'The morph needs at least two progress photos to show a change over time.');
      return;
    }
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (morphFrame >= photos.length - 1) {
      setMorphFrame(0);
      morphBlend.setValue(0);
    }
    setIsPlaying(true);
  };

  const resetMorph = () => {
    setIsPlaying(false);
    setMorphFrame(0);
    morphBlend.stopAnimation();
    morphBlend.setValue(0);
  };

  const finish = async () => {
    setIsCompleting(true);
    await completeProject(project.id);
    setIsCompleting(false);
    Alert.alert('Story complete', 'Your full visual journey is ready to share.');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        <View style={styles.topBar}><Pressable onPress={() => router.back()} style={styles.backButton}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable><Text style={[styles.topTitle, { color: colors.foreground }]}>Timeline</Text><Pressable testID="share-timeline-button" onPress={() => void shareStory()} style={styles.shareButton}><Feather name="share-2" size={19} color={colors.foreground} /></Pressable></View>
        <View style={styles.heading}><Text style={[styles.eyebrow, { color: colors.primary }]}>THE FULL STORY</Text><Text style={[styles.title, { color: colors.foreground }]}>{project.name}</Text><Text style={[styles.subtitle, { color: colors.mutedForeground }]}>A stitched view of {project.photos.length} moments, from first frame to now.</Text></View>

        <View style={[styles.morphCard, { backgroundColor: colors.foreground }]}>
          <View style={styles.morphStage}>
            {photos.length > 0 ? <PhotoImage uri={photos[morphFrame]?.uri ?? photos[0].uri} style={styles.morphImage} /> : <View style={styles.morphEmpty}><Feather name="film" size={27} color={colors.mutedForeground} /><Text style={[styles.morphEmptyText, { color: colors.background }]}>Add photos to build your morph</Text></View>}
            {photos.length > 1 && morphFrame < photos.length - 1 && <Animated.View style={[styles.morphOverlay, { opacity: morphBlend }]}><PhotoImage uri={photos[morphFrame + 1].uri} style={styles.morphImage} /></Animated.View>}
            {photos.length > 0 && <View style={[styles.morphBadge, { backgroundColor: colors.primary }]}><Feather name="play" size={12} color={colors.primaryForeground} /><Text style={[styles.morphBadgeText, { color: colors.primaryForeground }]}>{isPlaying ? 'MORPHING' : 'MORPH PREVIEW'}</Text></View>}
          </View>
          <View style={styles.morphControls}>
            <View style={styles.morphCopy}><Text style={[styles.morphTitle, { color: colors.background }]}>Watch the change</Text><Text style={[styles.morphMeta, { color: '#C7D4CB' }]}>{photos.length > 0 ? `Frame ${morphFrame + 1} of ${photos.length}` : 'No frames yet'}</Text></View>
            <View style={styles.morphButtons}><Pressable testID="restart-morph-button" onPress={resetMorph} style={[styles.morphIconButton, { borderColor: '#53635D' }]}><Feather name="rotate-ccw" size={16} color={colors.background} /></Pressable><Pressable testID="play-morph-button" onPress={toggleMorph} style={[styles.playButton, { backgroundColor: colors.primary }]}><Feather name={isPlaying ? 'pause' : 'play'} size={18} color={colors.primaryForeground} /></Pressable></View>
          </View>
          <View style={styles.speedPanel}>
            <View style={styles.speedHeader}><Text style={[styles.speedLabel, { color: colors.background }]}>Playback speed</Text><Text style={[styles.speedValue, { color: colors.primary }]}>{morphSpeed}×</Text></View>
            <View
              testID="morph-speed-slider"
              onLayout={(event) => { speedTrackWidth.current = event.nativeEvent.layout.width; }}
              {...speedPanResponder.panHandlers}
              style={styles.speedTrack}
            >
              <View style={[styles.speedTrackFill, { backgroundColor: colors.primary, width: `${((morphSpeed - 0.5) / 1.5) * 100}%` }]} />
              <View style={[styles.speedThumb, { backgroundColor: colors.primary, left: `${((morphSpeed - 0.5) / 1.5) * 100}%` }]} />
            </View>
            <View style={styles.speedTicks}>{speedOptions.map((option) => <Pressable key={option} onPress={() => setMorphSpeed(option)}><Text style={[styles.speedTick, { color: option === morphSpeed ? colors.primary : '#C7D4CB' }]}>{option}×</Text></Pressable>)}</View>
          </View>
          <Pressable testID="download-morph-button" onPress={() => void downloadMorph()} style={({ pressed }) => [styles.downloadButton, { borderColor: '#53635D' }, pressed && styles.pressed]}><Feather name="download" size={16} color={colors.background} /><Text style={[styles.downloadText, { color: colors.background }]}>Download preview</Text></Pressable>
          <View style={styles.progressRow}>{photos.map((photo, index) => <View key={photo.id} style={[styles.progressSegment, { backgroundColor: index <= morphFrame ? colors.primary : '#53635D' }]} />)}</View>
        </View>

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
  morphCard: { marginHorizontal: 20, borderRadius: 21, padding: 12, overflow: 'hidden' },
  morphStage: { height: 290, borderRadius: 15, overflow: 'hidden', position: 'relative', backgroundColor: '#21313A' },
  morphImage: { width: '100%', height: '100%' },
  morphOverlay: { ...StyleSheet.absoluteFillObject },
  morphEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  morphEmptyText: { fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 10 },
  morphBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 5 },
  morphBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.1 },
  morphControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3, paddingTop: 15, paddingBottom: 9 },
  morphCopy: { flex: 1 },
  morphTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  morphMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  morphButtons: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  morphIconButton: { width: 35, height: 35, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  speedPanel: { paddingHorizontal: 3, paddingTop: 4, paddingBottom: 8 },
  speedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  speedLabel: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  speedValue: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  speedTrack: { height: 18, justifyContent: 'center', position: 'relative', backgroundColor: '#53635D', borderRadius: 2 },
  speedTrackFill: { position: 'absolute', left: 0, height: 4, borderRadius: 2 },
  speedThumb: { position: 'absolute', width: 14, height: 14, borderRadius: 7, marginLeft: -7 },
  speedTicks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  speedTick: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  downloadButton: { height: 39, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginHorizontal: 3, marginBottom: 10 },
  downloadText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 3, paddingBottom: 2 },
  progressSegment: { height: 3, borderRadius: 2, flex: 1 },
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