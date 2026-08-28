import { BrandMark } from '@/components/BrandMark';
import { PhotoImage } from '@/components/PhotoImage';
import { ReminderPicker } from '@/components/ReminderPicker';
import {
  formatReminderShort,
  getReminderHours,
  Project,
  useProjects,
} from '@/context/ProjectContext';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(date));

function ProjectCard({ project, onReminder }: { project: Project; onReminder: () => void }) {
  const colors = useColors();
  const latest = project.photos[project.photos.length - 1];
  const daysSince = latest
    ? Math.max(0, Math.floor((Date.now() - new Date(latest.capturedAt).getTime()) / 86400000))
    : null;

  return (
    <Pressable
      testID={`project-${project.id}`}
      onPress={() => router.push({ pathname: '/project', params: { id: project.id } })}
      style={({ pressed }) => [styles.projectCard, { backgroundColor: colors.card }, pressed && styles.pressed]}
    >
      <View style={styles.cardImageWrap}>
        {latest ? <PhotoImage uri={latest.uri} style={styles.cardImage} /> : <View style={[styles.cardImage, { backgroundColor: colors.secondary }]} />}
        <View style={[styles.photoCount, { backgroundColor: colors.foreground }]}>
          <Feather name="layers" size={13} color={colors.background} />
          <Text style={[styles.photoCountText, { color: colors.background }]}>{project.photos.length}</Text>
        </View>
        {project.completed && (
          <View style={[styles.finishedPill, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.finishedText, { color: colors.secondaryForeground }]}>Finished</Text>
          </View>
        )}
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeading}>
          <View style={styles.flex}>
            <Text style={[styles.projectName, { color: colors.foreground }]}>{project.name}</Text>
            <Text style={[styles.projectMeta, { color: colors.mutedForeground }]}>
              {project.subject} · Started {formatDate(project.startedAt)}
            </Text>
          </View>
          <Feather name="arrow-up-right" size={20} color={colors.mutedForeground} />
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.latestRow}>
            <View style={[styles.statusDot, { backgroundColor: project.completed ? colors.secondaryForeground : colors.primary }]} />
            <Text style={[styles.latestText, { color: colors.mutedForeground }]}>
              {daysSince === null ? 'Ready for first photo' : daysSince === 0 ? 'Updated today' : `Updated ${daysSince}d ago`}
            </Text>
          </View>
          {!project.completed && (
            <Pressable testID={`reminder-${project.id}`} onPress={(event) => { event.stopPropagation(); onReminder(); }} hitSlop={10} style={styles.reminderButton}>
              <Feather name="bell" size={14} color={project.reminderEnabled ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.reminderText, { color: project.reminderEnabled ? colors.primary : colors.mutedForeground }]}>
                {project.reminderEnabled ? formatReminderShort(getReminderHours(project)) : 'Remind me'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { projects, isLoaded, addProject, setReminder } = useProjects();
  const [showNew, setShowNew] = useState(false);
  const [showReminder, setShowReminder] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [location, setLocation] = useState('');
  const [newReminderHours, setNewReminderHours] = useState<number | null>(null);
  const [isSavingReminder, setIsSavingReminder] = useState(false);

  const activeProjects = projects.filter((project) => !project.completed);
  const completedProjects = projects.filter((project) => project.completed);
  const nextReminder = useMemo(
    () =>
      activeProjects
        .filter((project) => project.reminderEnabled && project.nextReminderAt)
        .sort((a, b) => new Date(a.nextReminderAt ?? '').getTime() - new Date(b.nextReminderAt ?? '').getTime())[0],
    [activeProjects],
  );

  const createProject = async () => {
    if (!name.trim() || !subject.trim()) {
      Alert.alert('Add a little more', 'Give your project a name and say what you are tracking.');
      return;
    }
    const { project, reminderResult } = await addProject(
      name.trim(),
      subject.trim(),
      location.trim() || 'Personal',
      newReminderHours ?? undefined,
    );
    if (reminderResult && !reminderResult.success) {
      Alert.alert('Project created without a reminder', reminderResult.reason);
    }
    setName('');
    setSubject('');
    setLocation('');
    setNewReminderHours(null);
    setShowNew(false);
    router.push({ pathname: '/project', params: { id: project.id } });
  };

  const chooseReminder = async (intervalHours: number) => {
    if (!showReminder) return;
    setIsSavingReminder(true);
    const result = await setReminder(showReminder.id, intervalHours, true);
    setIsSavingReminder(false);
    if (!result.success) {
      Alert.alert('Reminders need permission', result.reason);
      return;
    }
    setShowReminder(null);
  };

  const turnReminderOff = async () => {
    if (!showReminder) return;
    setIsSavingReminder(true);
    const result = await setReminder(showReminder.id, getReminderHours(showReminder), false);
    setIsSavingReminder(false);
    if (!result.success) {
      Alert.alert('Could not turn reminders off', result.reason);
      return;
    }
    setShowReminder(null);
  };

  if (!isLoaded) return <View style={[styles.loading, { backgroundColor: colors.background }]}><Text style={{ color: colors.mutedForeground }}>Loading your projects…</Text></View>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <BrandMark />
          <Pressable testID="new-project-top" onPress={() => setShowNew(true)} style={[styles.iconButton, { backgroundColor: colors.card }]}>
            <Feather name="plus" size={21} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.intro}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR VISUAL LOG</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Small moments.{'\n'}Big changes.</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Keep showing up. We’ll help you see how far you’ve come.
          </Text>
        </View>

        <View style={[styles.insight, { backgroundColor: colors.insightBackground }]}>
          <View style={styles.insightCopy}>
            <View style={styles.insightLabel}><Feather name="sun" size={14} color={colors.primary} /><Text style={[styles.insightEyebrow, { color: colors.primary }]}>NEXT CHECK-IN</Text></View>
            <Text style={[styles.insightTitle, { color: colors.insightForeground }]}>
              {nextReminder ? `${nextReminder.name} · ${formatDate(nextReminder.nextReminderAt ?? '')}` : 'Ready when you are'}
            </Text>
            <Text style={[styles.insightBody, { color: colors.insightMuted }]}>
              {nextReminder ? 'A gentle nudge to capture the next chapter.' : 'Start a project to begin your visual timeline.'}
            </Text>
          </View>
          <View style={[styles.insightOrb, { backgroundColor: colors.primary }]}><Feather name="arrow-down-right" size={20} color={colors.insightBackground} /></View>
        </View>

        <View style={styles.sectionHeader}>
          <View><Text style={[styles.sectionTitle, { color: colors.foreground }]}>In progress</Text><Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>{activeProjects.length} {activeProjects.length === 1 ? 'story' : 'stories'} unfolding</Text></View>
          <Pressable onPress={() => setShowNew(true)}><Text style={[styles.addText, { color: colors.primary }]}>New project</Text></Pressable>
        </View>

        {activeProjects.length ? activeProjects.map((project) => <ProjectCard key={project.id} project={project} onReminder={() => setShowReminder(project)} />) : (
          <View style={[styles.empty, { borderColor: colors.border }]}><Feather name="camera" size={26} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing in motion yet</Text><Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>Create your first project and make the first frame count.</Text></View>
        )}

        {completedProjects.length > 0 && <><View style={[styles.sectionHeader, { marginTop: 28 }]}><View><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Finished stories</Text><Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>The view from here</Text></View></View>{completedProjects.map((project) => <ProjectCard key={project.id} project={project} onReminder={() => undefined} />)}</>}
      </ScrollView>

      <Pressable testID="new-project-floating" onPress={() => setShowNew(true)} style={({ pressed }) => [styles.fab, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
        <Feather name="plus" size={24} color={colors.primaryForeground} />
        <Text style={[styles.fabText, { color: colors.primaryForeground }]}>New project</Text>
      </Pressable>

      <Modal visible={showNew} animationType="slide" transparent onRequestClose={() => setShowNew(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(23, 33, 43, 0.45)' }]}><View style={[styles.sheet, styles.newProjectSheet, { backgroundColor: colors.card }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}><View><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Start a new story</Text><Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>Give your future self something to look back on.</Text></View><Pressable onPress={() => setShowNew(false)}><Feather name="x" size={23} color={colors.mutedForeground} /></Pressable></View>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Project name</Text><TextInput testID="project-name-input" value={name} onChangeText={setName} placeholder="e.g. Kitchen renovation" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>What are you tracking?</Text><TextInput testID="project-subject-input" value={subject} onChangeText={setSubject} placeholder="e.g. A build, a person, a garden" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Where? <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>(optional)</Text></Text><TextInput value={location} onChangeText={setLocation} placeholder="e.g. Home, studio, site" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
            <View style={styles.reminderHeading}><View><Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Check-in reminders</Text><Text style={[styles.reminderHint, { color: colors.mutedForeground }]}>Choose a rhythm now, or leave it off.</Text></View><Feather name="bell" size={17} color={colors.primary} /></View>
            <View style={styles.newReminderOptions}><ReminderPicker selectedHours={newReminderHours} onSelect={setNewReminderHours} showNone /></View>
            <Pressable testID="create-project-button" onPress={() => void createProject()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.foreground }, pressed && styles.pressed]}><Text style={[styles.primaryButtonText, { color: colors.background }]}>Create project</Text><Feather name="arrow-right" size={18} color={colors.background} /></Pressable>
          </ScrollView>
        </View></View>
      </Modal>

      <Modal visible={!!showReminder} animationType="slide" transparent onRequestClose={() => setShowReminder(null)}>
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(23, 33, 43, 0.45)' }]}><View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Keep the rhythm</Text><Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>How often should we remind you to check in?</Text></View><Pressable onPress={() => setShowReminder(null)}><Feather name="x" size={23} color={colors.mutedForeground} /></Pressable></View>
          <ScrollView style={styles.reminderOptions} showsVerticalScrollIndicator={false}>
            <ReminderPicker selectedHours={showReminder?.reminderEnabled ? getReminderHours(showReminder) : null} onSelect={(hours) => { if (hours !== null) void chooseReminder(hours); }} disabled={isSavingReminder} />
          </ScrollView>
          {showReminder?.reminderEnabled && <Pressable disabled={isSavingReminder} onPress={() => void turnReminderOff()} style={[styles.disableReminder, isSavingReminder && { opacity: 0.6 }]}><Text style={[styles.disableReminderText, { color: colors.destructive }]}>Turn reminders off</Text></Pressable>}
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  intro: { paddingTop: 42, paddingBottom: 26 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 39, lineHeight: 42, letterSpacing: -1.8, marginTop: 10 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, marginTop: 13, maxWidth: 305 },
  insight: { borderRadius: 22, padding: 20, minHeight: 155, flexDirection: 'row', justifyContent: 'space-between', overflow: 'hidden' },
  insightCopy: { flex: 1, paddingRight: 12 },
  insightLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  insightEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  insightTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 21, lineHeight: 25, marginTop: 16, maxWidth: 230 },
  insightBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 8, maxWidth: 240 },
  insightOrb: { width: 45, height: 45, borderRadius: 23, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 31, marginBottom: 14 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 21, letterSpacing: -0.5 },
  sectionHint: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  addText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 3 },
  projectCard: { borderRadius: 21, overflow: 'hidden', marginBottom: 14 },
  cardImageWrap: { height: 188, position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  photoCount: { position: 'absolute', left: 12, top: 12, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 5 },
  photoCountText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  finishedPill: { position: 'absolute', right: 12, top: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  finishedText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  cardContent: { padding: 17 },
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start' },
  flex: { flex: 1 },
  projectName: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.3 },
  projectMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 5 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 19 },
  latestRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  latestText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  reminderButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reminderText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 21, padding: 25, alignItems: 'center' },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, marginTop: 12 },
  emptyBody: { fontFamily: 'Inter_400Regular', textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 7, maxWidth: 250 },
  fab: { position: 'absolute', right: 20, bottom: 22, borderRadius: 22, height: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 4 },
  fabText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12 },
  newProjectSheet: { maxHeight: '92%', flexShrink: 1 },
  sheetHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 3, backgroundColor: '#C9C3B8', marginBottom: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 20, marginBottom: 20 },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.8 },
  sheetSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 285 },
  inputLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 7, marginTop: 7 },
  input: { borderWidth: 1, borderRadius: 14, height: 50, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 15, marginBottom: 5 },
  primaryButton: { height: 54, borderRadius: 17, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9, marginTop: 21 },
  primaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  reminderOptions: { maxHeight: 390 },
  newReminderOptions: {},
  reminderHeading: { marginTop: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reminderHint: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  disableReminder: { alignItems: 'center', paddingTop: 13 },
  disableReminderText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});