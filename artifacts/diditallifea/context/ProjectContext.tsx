import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

export type ProgressPhoto = {
  id: string;
  uri: string;
  capturedAt: string;
  note?: string;
  isSample?: boolean;
};

export type Project = {
  id: string;
  name: string;
  subject: string;
  location: string;
  startedAt: string;
  reminderIntervalHours: number;
  /** Kept only so projects saved by older versions can be migrated on load. */
  reminderInterval?: number;
  reminderEnabled: boolean;
  nextReminderAt?: string;
  scheduledNotificationId?: string;
  completed: boolean;
  photos: ProgressPhoto[];
};

type ProjectContextValue = {
  projects: Project[];
  isLoaded: boolean;
  addProject: (name: string, subject: string, location: string, reminderHours?: number) => Promise<AddProjectResult>;
  addPhoto: (projectId: string, photo: Omit<ProgressPhoto, 'id'>) => Promise<void>;
  setReminder: (projectId: string, intervalHours: number, enabled: boolean) => Promise<ReminderResult>;
  completeProject: (projectId: string) => Promise<void>;
};

export type ReminderResult = { success: true } | { success: false; reason: string };
type AddProjectResult = { project: Project; reminderResult?: ReminderResult };

export const REMINDER_OPTIONS = [
  { hours: 6, label: 'Every 6 hours', shortLabel: '6h' },
  { hours: 24, label: 'Every day', shortLabel: '1d' },
  { hours: 120, label: 'Every 5 days', shortLabel: '5d' },
  { hours: 168, label: 'Every week', shortLabel: '1w' },
  { hours: 336, label: 'Every 2 weeks', shortLabel: '2w' },
  { hours: 720, label: 'Every month', shortLabel: 'Monthly' },
] as const;

export function getReminderHours(project: Pick<Project, 'reminderIntervalHours' | 'reminderInterval'>) {
  return project.reminderIntervalHours ?? (project.reminderInterval ?? 7) * 24;
}

export function getReminderOption(intervalHours: number) {
  return REMINDER_OPTIONS.find((option) => option.hours === intervalHours);
}

export function formatReminderShort(intervalHours: number) {
  return getReminderOption(intervalHours)?.shortLabel ?? `${intervalHours}h`;
}

const STORAGE_KEY = '@mylifelens/projects';
const LEGACY_STORAGE_KEY = '@diditallifea/projects';
const ProjectContext = createContext<ProjectContextValue | null>(null);

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const seedProjects: Project[] = [
  {
    id: 'sample-garden',
    name: 'Back garden studio',
    subject: 'Garden project',
    location: 'Home',
    startedAt: '2026-08-02T09:00:00.000Z',
    reminderIntervalHours: 168,
    reminderEnabled: true,
    nextReminderAt: '2026-08-30T09:00:00.000Z',
    completed: false,
    photos: [
      {
        id: 'sample-1',
        uri: 'sample-garden',
        capturedAt: '2026-08-02T09:00:00.000Z',
        note: 'First look — marking out the new beds.',
        isSample: true,
      },
      {
        id: 'sample-2',
        uri: 'sample-garden-finished',
        capturedAt: '2026-08-23T16:30:00.000Z',
        note: 'The frame is in and the planting is settling.',
        isSample: true,
      },
    ],
  },
];

const normalizeProject = (project: Project): Project => ({
  ...project,
  reminderIntervalHours: getReminderHours(project),
});

async function cancelNotification(notificationId?: string) {
  if (!notificationId || Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // The OS may have already removed an expired or replaced notification.
  }
}

type ScheduledReminder = {
  scheduledNotificationId: string;
  nextReminderAt: string;
};

async function scheduleReminderNotification(project: Project, intervalHours: number): Promise<ScheduledReminder | ReminderResult> {
  if (Platform.OS === 'web') {
    return { success: false, reason: 'Device reminders are available in the MyLifelens mobile app.' };
  }

  try {
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) {
      permission = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: false, allowSound: true },
      });
    }
    if (!permission.granted) {
      return {
        success: false,
        reason: 'Please allow notifications in your device settings to turn on reminders.',
      };
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Photo reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }

    const seconds = Math.max(60, intervalHours * 60 * 60);
    const scheduledNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time for your MyLifelens check-in',
        body: `Capture the next frame of “${project.name}”.`,
        sound: 'default',
        data: { projectId: project.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: true,
        ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
      },
    });
    return {
      scheduledNotificationId,
      nextReminderAt: new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString(),
    };
  } catch {
    return {
      success: false,
      reason: 'We could not schedule that reminder. Please try again on your device.',
    };
  }
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const legacyStored = stored ? null : await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
        const loadedProjects = stored
          ? (JSON.parse(stored) as Project[]).map(normalizeProject)
          : legacyStored
            ? (JSON.parse(legacyStored) as Project[]).map(normalizeProject)
            : seedProjects;
        setProjects(loadedProjects);
        if (!stored && legacyStored) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loadedProjects));
        }
      } catch {
        setProjects(seedProjects);
      } finally {
        setIsLoaded(true);
      }
    };
    void loadProjects();
  }, []);

  const persist = async (next: Project[]) => {
    setProjects(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const value = useMemo<ProjectContextValue>(
    () => ({
      projects,
      isLoaded,
      addProject: async (name, subject, location, reminderHours) => {
        const project: Project = {
          id: makeId(),
          name,
          subject,
          location,
          startedAt: new Date().toISOString(),
          reminderIntervalHours: 168,
          reminderEnabled: false,
          completed: false,
          photos: [],
        };
        await persist([project, ...projects]);
        if (reminderHours === undefined) return { project };

        const scheduled = await scheduleReminderNotification(project, reminderHours);
        if ('success' in scheduled) return { project, reminderResult: scheduled };
        const scheduledProject = {
          ...project,
          reminderIntervalHours: reminderHours,
          reminderEnabled: true,
          nextReminderAt: scheduled.nextReminderAt,
          scheduledNotificationId: scheduled.scheduledNotificationId,
        };
        await persist([scheduledProject, ...projects]);
        return { project: scheduledProject, reminderResult: { success: true } };
      },
      addPhoto: async (projectId, photo) => {
        const next = projects.map((project) =>
          project.id === projectId
            ? { ...project, photos: [...project.photos, { ...photo, id: makeId() }] }
            : project,
        );
        await persist(next);
      },
      setReminder: async (projectId, intervalHours, enabled) => {
        const project = projects.find((item) => item.id === projectId);
        if (!project) return { success: false, reason: 'That project could not be found.' };

        if (!enabled) {
          await cancelNotification(project.scheduledNotificationId);
          await persist(
            projects.map((item) =>
              item.id === projectId
                ? {
                    ...item,
                    reminderIntervalHours: getReminderHours(item),
                    reminderEnabled: false,
                    nextReminderAt: undefined,
                    scheduledNotificationId: undefined,
                  }
                : item,
            ),
          );
          return { success: true };
        }

        try {
          await cancelNotification(project.scheduledNotificationId);
          const scheduled = await scheduleReminderNotification(project, intervalHours);
          if ('success' in scheduled) return scheduled;
          await persist(
            projects.map((item) =>
              item.id === projectId
                ? {
                    ...item,
                    reminderIntervalHours: intervalHours,
                    reminderEnabled: true,
                    nextReminderAt: scheduled.nextReminderAt,
                    scheduledNotificationId: scheduled.scheduledNotificationId,
                  }
                : item,
            ),
          );
          return { success: true };
        } catch {
          return {
            success: false,
            reason: 'We could not schedule that reminder. Please try again on your device.',
          };
        }
      },
      completeProject: async (projectId) => {
        const project = projects.find((item) => item.id === projectId);
        await cancelNotification(project?.scheduledNotificationId);
        await persist(
          projects.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  completed: true,
                  reminderEnabled: false,
                  nextReminderAt: undefined,
                  scheduledNotificationId: undefined,
                }
              : project,
          ),
        );
      },
    }),
    [isLoaded, projects],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProjects must be used inside ProjectProvider');
  return context;
}