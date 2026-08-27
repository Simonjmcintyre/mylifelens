import { PhotoImage } from '@/components/PhotoImage';
import { useProjects } from '@/context/ProjectContext';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Alert, Image, PanResponder, PanResponderGestureState, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CaptureScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { projects, addPhoto } = useProjects();
  const project = projects.find((item) => item.id === projectId);
  const previous = project?.photos[project.photos.length - 1];
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.45);
  const [ghostOffset, setGhostOffset] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [note, setNote] = useState('Aligned to the previous frame');
  const ghostOffsetRef = useRef({ x: 0, y: 0 });
  const dragOrigin = useRef({ x: 0, y: 0 });
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragOrigin.current = ghostOffsetRef.current;
      },
      onPanResponderMove: (_event, gesture: PanResponderGestureState) => {
        const next = {
          x: dragOrigin.current.x + gesture.dx,
          y: dragOrigin.current.y + gesture.dy,
        };
        ghostOffsetRef.current = next;
        setGhostOffset(next);
      },
      onPanResponderRelease: () => undefined,
      onPanResponderTerminate: () => undefined,
    }),
  ).current;

  const previousLabel = useMemo(() => (previous ? `Frame ${String(project?.photos.length).padStart(2, '0')}` : 'No previous frame'), [previous, project?.photos.length]);

  const choosePhoto = async (mode: 'camera' | 'library') => {
    const permission = mode === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', `Allow access to your ${mode === 'camera' ? 'camera' : 'photo library'} to add a progress frame.`);
      return;
    }
    const result = mode === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, allowsEditing: false });
    if (!result.canceled && result.assets[0]) setSelectedUri(result.assets[0].uri);
  };

  const savePhoto = async () => {
    if (!selectedUri || !project) return;
    setIsSaving(true);
    await addPhoto(project.id, { uri: selectedUri, capturedAt: new Date().toISOString(), note });
    setIsSaving(false);
    router.replace({ pathname: '/project', params: { id: project.id } });
  };

  if (!project) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.foreground }}>Project not found</Text></View>;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 25 }} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}><Pressable onPress={() => router.back()} style={styles.backButton}><Feather name="x" size={23} color={colors.foreground} /></Pressable><Text style={[styles.topTitle, { color: colors.foreground }]}>Add progress frame</Text><View style={{ width: 42 }} /></View>
        <View style={styles.heading}><Text style={[styles.eyebrow, { color: colors.primary }]}>ALIGN YOUR NEXT FRAME</Text><Text style={[styles.title, { color: colors.foreground }]}>Line it up, then let time do the rest.</Text><Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Your last photo appears as a ghost so you can match the angle and see what’s changing.</Text></View>

        <View style={[styles.preview, { backgroundColor: colors.foreground }]}>
          {selectedUri ? <Image source={{ uri: selectedUri }} style={styles.previewImage} resizeMode="cover" /> : <View style={styles.previewEmpty}><Feather name="camera" size={34} color="#C7D4CB" /><Text style={[styles.previewEmptyTitle, { color: colors.background }]}>Choose how to add this frame</Text><Text style={[styles.previewEmptyBody, { color: '#C7D4CB' }]}>Take a fresh photo or pick one from your library.</Text></View>}
          {selectedUri && previous && <View {...panResponder.panHandlers} style={[styles.ghostLayer, { opacity, transform: [{ translateX: ghostOffset.x }, { translateY: ghostOffset.y }] }]}><PhotoImage uri={previous.uri} style={styles.previewImage} resizeMode="cover" /></View>}
          {selectedUri && previous && <View style={[styles.ghostBadge, { backgroundColor: colors.primary }]}><Feather name="layers" size={13} color={colors.primaryForeground} /><Text style={[styles.ghostBadgeText, { color: colors.primaryForeground }]}>Ghost {Math.round(opacity * 100)}%</Text></View>}
          {selectedUri && <View style={styles.crosshair}><View style={[styles.crosshairH, { backgroundColor: colors.primary }]} /><View style={[styles.crosshairV, { backgroundColor: colors.primary }]} /></View>}
        </View>

        {selectedUri && previous && <View style={styles.alignmentPanel}><View style={styles.alignmentHeading}><View><Text style={[styles.panelTitle, { color: colors.foreground }]}>Line up the ghost</Text><Text style={[styles.panelHint, { color: colors.mutedForeground }]}>Drag the ghost image over your new photo</Text></View><Pressable testID="reset-alignment" onPress={() => { ghostOffsetRef.current = { x: 0, y: 0 }; setGhostOffset({ x: 0, y: 0 }); }}><Text style={[styles.resetText, { color: colors.primary }]}>Reset</Text></Pressable></View><View style={styles.nudgeRow}><Pressable testID="nudge-left" onPress={() => { const next = { x: ghostOffsetRef.current.x - 4, y: ghostOffsetRef.current.y }; ghostOffsetRef.current = next; setGhostOffset(next); }} style={[styles.nudgeButton, { borderColor: colors.border }]}><Feather name="chevron-left" size={18} color={colors.foreground} /></Pressable><Pressable testID="nudge-up" onPress={() => { const next = { x: ghostOffsetRef.current.x, y: ghostOffsetRef.current.y - 4 }; ghostOffsetRef.current = next; setGhostOffset(next); }} style={[styles.nudgeButton, { borderColor: colors.border }]}><Feather name="chevron-up" size={18} color={colors.foreground} /></Pressable><Pressable testID="nudge-down" onPress={() => { const next = { x: ghostOffsetRef.current.x, y: ghostOffsetRef.current.y + 4 }; ghostOffsetRef.current = next; setGhostOffset(next); }} style={[styles.nudgeButton, { borderColor: colors.border }]}><Feather name="chevron-down" size={18} color={colors.foreground} /></Pressable><Pressable testID="nudge-right" onPress={() => { const next = { x: ghostOffsetRef.current.x + 4, y: ghostOffsetRef.current.y }; ghostOffsetRef.current = next; setGhostOffset(next); }} style={[styles.nudgeButton, { borderColor: colors.border }]}><Feather name="chevron-right" size={18} color={colors.foreground} /></Pressable><View style={[styles.alignmentChip, { backgroundColor: colors.accent }]}><Feather name="move" size={14} color={colors.accentForeground} /></View></View><View style={styles.opacityHeader}><Text style={[styles.panelTitle, { color: colors.foreground }]}>Ghost strength</Text><Text style={[styles.percent, { color: colors.primary }]}>{Math.round(opacity)}%</Text></View><View style={styles.opacityRow}><Pressable testID="ghost-decrease" onPress={() => setOpacity(Math.max(0.15, Number((opacity - 0.1).toFixed(2))))} style={[styles.opacityButton, { borderColor: colors.border }]}><Feather name="minus" size={17} color={colors.foreground} /></Pressable><View style={[styles.track, { backgroundColor: colors.muted }]}><View style={[styles.trackFill, { backgroundColor: colors.primary, width: `${opacity * 100}%` }]} /></View><Pressable testID="ghost-increase" onPress={() => setOpacity(Math.min(0.8, Number((opacity + 0.1).toFixed(2))))} style={[styles.opacityButton, { borderColor: colors.border }]}><Feather name="plus" size={17} color={colors.foreground} /></Pressable></View><View style={styles.alignedNote}><Feather name="check-circle" size={15} color={colors.secondaryForeground} /><Text style={[styles.alignedText, { color: colors.secondaryForeground }]}>Ghosting {previousLabel} for alignment</Text></View></View>}

        <View style={styles.choiceRow}><Pressable testID="take-photo-button" onPress={() => void choosePhoto('camera')} style={({ pressed }) => [styles.choiceButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Feather name="camera" size={20} color={colors.primaryForeground} /><Text style={[styles.choiceText, { color: colors.primaryForeground }]}>Take photo</Text></Pressable><Pressable testID="upload-photo-button" onPress={() => void choosePhoto('library')} style={({ pressed }) => [styles.choiceButton, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}><Feather name="upload" size={19} color={colors.foreground} /><Text style={[styles.choiceText, { color: colors.foreground }]}>Upload</Text></Pressable></View>
        {selectedUri && <><Text style={[styles.noteLabel, { color: colors.mutedForeground }]}>A note for this moment <Text style={{ fontFamily: 'Inter_400Regular' }}>(optional)</Text></Text><View style={[styles.noteBox, { backgroundColor: colors.card, borderColor: colors.border }]}><Feather name="edit-3" size={16} color={colors.mutedForeground} /><Text style={[styles.noteText, { color: colors.foreground }]}>{note}</Text></View><Pressable testID="save-progress-button" disabled={isSaving} onPress={() => void savePhoto()} style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.foreground }, pressed && styles.pressed, isSaving && { opacity: 0.55 }]}><Text style={[styles.saveText, { color: colors.background }]}>{isSaving ? 'Saving frame…' : 'Save progress frame'}</Text><Feather name="arrow-right" size={18} color={colors.background} /></Pressable></>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { height: 62, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButton: { width: 42, height: 42, justifyContent: 'center' },
  topTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  heading: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.4 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 31, lineHeight: 35, letterSpacing: -1.2, marginTop: 10 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, marginTop: 11 },
  preview: { marginHorizontal: 20, height: 395, borderRadius: 22, overflow: 'hidden', position: 'relative' },
  previewImage: { width: '100%', height: '100%' },
  previewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 45 },
  previewEmptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, marginTop: 16 },
  previewEmptyBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  ghostLayer: { ...StyleSheet.absoluteFillObject },
  ghostBadge: { position: 'absolute', left: 14, top: 14, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 5 },
  ghostBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  resetText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  crosshair: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  crosshairH: { width: '100%', height: 1, opacity: 0.75 },
  crosshairV: { position: 'absolute', width: 1, height: '100%', opacity: 0.75 },
  alignmentPanel: { paddingHorizontal: 20, paddingTop: 22 },
  alignmentHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  panelHint: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 },
  percent: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  nudgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15 },
  nudgeButton: { width: 34, height: 34, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  alignmentChip: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  opacityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  opacityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 15 },
  opacityButton: { width: 34, height: 34, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  track: { height: 5, borderRadius: 3, flex: 1, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 3 },
  alignedNote: { flexDirection: 'row', gap: 7, alignItems: 'center', marginTop: 15 },
  alignedText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  choiceRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 23 },
  choiceButton: { flex: 1, height: 52, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  choiceText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  noteLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginHorizontal: 20, marginTop: 24, marginBottom: 8 },
  noteBox: { marginHorizontal: 20, minHeight: 47, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  noteText: { fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1 },
  saveButton: { marginHorizontal: 20, height: 54, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 19 },
  saveText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});