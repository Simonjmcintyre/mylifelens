import { BrandMark } from '@/components/BrandMark';
import { PhotoImage } from '@/components/PhotoImage';
import { ReminderPicker } from '@/components/ReminderPicker';
import { formatReminderShort, getReminderHours, Project, useProjects } from '@/context/ProjectContext';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

function PhotoTile({ project, index }: { project: Project; index: number }) {
  const colors = useColors();
  const photo = project.photos[index];
  return (
    <View style={[styles.photoTile, { backgroundColor: colors.card }]}>
      <PhotoImage uri={photo.uri} style={styles.tileImage} />
      <View style={styles.tileMeta}><Text style={[styles.tileDate, { color: colors.foreground }]}>{index === 0 ? 'First frame' : `Frame ${String(index + 1).padStart(2, '0')}`}</Text><Text style={[styles.tileDate, { color: colors.mutedForeground }]}>{formatDate(photo.capturedAt)}</Text></View>
    </View>
  );
}

export default function ProjectScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projects, setReminder } = useProjects();
  const project = projects.find((item) => item.id === id);
  const [showReminder, setShowReminder] = useState(false);
  const [isSavingReminder, setIsSavingReminder] = useState(false);

  if (!project) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.foreground }}>Project not found</Text></View>;

  const shareProject = async () => {
    try {
      const latest = project.photos[project.photos.length - 1];
      await Share.share({
        message: `${project.name} — ${project.photos.length} ${project.photos.length === 1 ? 'frame' : 'frames'} from start to finish.\n\nTracking progress with MyLifelens.`,
        ...(latest?.isSample ? {} : latest ? { url: latest.uri } : {}),
      });
    } catch {
      Alert.alert('Sharing unavailable', 'We could not open the sharing sheet right now.');
    }
  };

  const updateReminder = async (hours: number | null) => {
    setIsSavingReminder(true);
    const result = await setReminder(project.id, hours ?? getReminderHours(project), hours !== null);
    setIsSavingReminder(false);
    if (!result.success) {
      Alert.alert('Reminders need permission', result.reason);
      return;
    }
    setShowReminder(false);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        <View style={styles.topBar}><Pressable testID="back-button" onPress={() => router.back()} style={styles.backButton}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable><BrandMark compact /><Pressable testID="share-project-button" onPress={() => void shareProject()} style={styles.shareButton}><Feather name="share-2" size={19} color={colors.foreground} /></Pressable></View>
        <View style={styles.hero}><View style={styles.heroLabel}><View style={[styles.dot, { backgroundColor: project.completed ? colors.secondaryForeground : colors.primary }]} /><Text style={[styles.status, { color: colors.mutedForeground }]}>{project.completed ? 'FINISHED STORY' : 'IN PROGRESS'}</Text></View><Text style={[styles.title, { color: colors.foreground }]}>{project.name}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{project.subject} · {project.location}</Text></View>
        <View style={styles.actions}><Pressable testID="capture-button" onPress={() => router.push({ pathname: '/capture', params: { projectId: project.id } })} style={({ pressed }) => [styles.captureAction, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Feather name="camera" size={20} color={colors.primaryForeground} /><Text style={[styles.captureText, { color: colors.primaryForeground }]}>Add progress photo</Text></Pressable><Pressable testID="timeline-button" onPress={() => router.push({ pathname: '/timeline', params: { id: project.id } })} style={[styles.timelineAction, { borderColor: colors.border }]}><Feather name="film" size={19} color={colors.foreground} /><Text style={[styles.timelineText, { color: colors.foreground }]}>View timeline</Text></Pressable></View>
        <View style={styles.stats}><View><Text style={[styles.statNumber, { color: colors.foreground }]}>{project.photos.length}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>frames captured</Text></View><View style={[styles.statDivider, { backgroundColor: colors.border }]} /><View><Text style={[styles.statNumber, { color: colors.foreground }]}>{Math.max(0, Math.floor((Date.now() - new Date(project.startedAt).getTime()) / 86400000))}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>days in motion</Text></View><View style={[styles.statDivider, { backgroundColor: colors.border }]} /><View><Text style={[styles.statNumber, { color: colors.foreground }]}>{project.reminderEnabled ? formatReminderShort(getReminderHours(project)) : '—'}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>check-in rhythm</Text></View></View>
        {!project.completed && <Pressable testID="edit-reminder-button" onPress={() => setShowReminder(true)} style={[styles.reminderCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.reminderCardIcon, { backgroundColor: colors.accent }]}><Feather name="bell" size={17} color={colors.accentForeground} /></View><View style={styles.reminderCardCopy}><Text style={[styles.reminderCardTitle, { color: colors.foreground }]}>{project.reminderEnabled ? 'Reminder set' : 'Set a check-in reminder'}</Text><Text style={[styles.reminderCardBody, { color: colors.mutedForeground }]}>{project.reminderEnabled ? `${formatReminderShort(getReminderHours(project))} · Tap to change` : 'Choose how often MyLifelens should nudge you'}</Text></View><Feather name="chevron-right" size={19} color={colors.mutedForeground} /></Pressable>}
        <View style={styles.sectionHeading}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>The journey so far</Text><Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>Newest frame on top</Text></View>
        {project.photos.length ? [...project.photos].reverse().map((_, reversedIndex) => <PhotoTile key={project.photos[project.photos.length - 1 - reversedIndex].id} project={project} index={project.photos.length - 1 - reversedIndex} />) : <View style={[styles.empty, { borderColor: colors.border }]}><Feather name="image" size={25} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your first frame is waiting</Text><Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>Use the camera button to set the starting point.</Text></View>}
        {!project.completed && project.photos.length >= 2 && <Pressable testID="finish-project-button" onPress={() => router.push({ pathname: '/timeline', params: { id: project.id, finishing: 'true' } })} style={styles.finishButton}><Feather name="flag" size={17} color={colors.mutedForeground} /><Text style={[styles.finishText, { color: colors.mutedForeground }]}>This project is finished</Text></Pressable>}
      </ScrollView>
      <Modal visible={showReminder} animationType="slide" transparent onRequestClose={() => setShowReminder(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(23, 33, 43, 0.45)' }]}><View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}><View><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Keep the rhythm</Text><Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>How often should we remind you to check in?</Text></View><Pressable onPress={() => setShowReminder(false)}><Feather name="x" size={23} color={colors.mutedForeground} /></Pressable></View>
          <ScrollView style={styles.reminderOptions} showsVerticalScrollIndicator={false}>
            <ReminderPicker selectedHours={project.reminderEnabled ? getReminderHours(project) : null} onSelect={(hours) => void updateReminder(hours)} disabled={isSavingReminder} showNone />
          </ScrollView>
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { height: 64, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButton: { width: 42, height: 42, justifyContent: 'center' },
  shareButton: { width: 42, height: 42, alignItems: 'flex-end', justifyContent: 'center' },
  reminderCard: { marginHorizontal: 20, marginTop: 18, padding: 13, borderWidth: 1, borderRadius: 17, flexDirection: 'row', alignItems: 'center' },
  reminderCardIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  reminderCardCopy: { flex: 1 },
  reminderCardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  reminderCardBody: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  hero: { paddingHorizontal: 20, paddingTop: 22 },
  heroLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  status: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.3 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 35, lineHeight: 39, letterSpacing: -1.5, marginTop: 12 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 14, marginTop: 9 },
  actions: { paddingHorizontal: 20, marginTop: 27, gap: 10 },
  captureAction: { height: 54, borderRadius: 17, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9 },
  captureText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  timelineAction: { height: 50, borderWidth: 1, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9 },
  timelineText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  stats: { marginHorizontal: 20, marginTop: 26, paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#D7D2C7', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statNumber: { fontFamily: 'Inter_700Bold', fontSize: 23, letterSpacing: -0.8 },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 4 },
  statDivider: { width: 1, height: 29 },
  sectionHeading: { paddingHorizontal: 20, marginTop: 31, marginBottom: 14 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.5 },
  sectionHint: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  photoTile: { marginHorizontal: 20, borderRadius: 18, overflow: 'hidden', marginBottom: 14 },
  tileImage: { height: 230, width: '100%' },
  tileMeta: { paddingHorizontal: 15, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between' },
  tileDate: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  empty: { marginHorizontal: 20, borderWidth: 1, borderStyle: 'dashed', borderRadius: 20, padding: 27, alignItems: 'center' },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, marginTop: 11 },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7 },
  finishButton: { flexDirection: 'row', gap: 7, justifyContent: 'center', alignItems: 'center', paddingVertical: 23 },
  finishText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12 },
  sheetHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 3, backgroundColor: '#C9C3B8', marginBottom: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 20, marginBottom: 20 },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.8 },
  sheetSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 285 },
  reminderOptions: { maxHeight: 390 },
});