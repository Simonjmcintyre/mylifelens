import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

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
  reminderInterval: number;
  reminderEnabled: boolean;
  nextReminderAt?: string;
  completed: boolean;
  photos: ProgressPhoto[];
};

type ProjectContextValue = {
  projects: Project[];
  isLoaded: boolean;
  addProject: (name: string, subject: string, location: string) => Promise<Project>;
  addPhoto: (projectId: string, photo: Omit<ProgressPhoto, 'id'>) => Promise<void>;
  setReminder: (projectId: string, days: number, enabled: boolean) => Promise<void>;
  completeProject: (projectId: string) => Promise<void>;
};

const STORAGE_KEY = '@diditallifea/projects';
const ProjectContext = createContext<ProjectContextValue | null>(null);

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const seedProjects: Project[] = [
  {
    id: 'sample-garden',
    name: 'Back garden studio',
    subject: 'Garden project',
    location: 'Home',
    startedAt: '2026-08-02T09:00:00.000Z',
    reminderInterval: 7,
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

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        setProjects(stored ? (JSON.parse(stored) as Project[]) : seedProjects);
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
      addProject: async (name, subject, location) => {
        const project: Project = {
          id: makeId(),
          name,
          subject,
          location,
          startedAt: new Date().toISOString(),
          reminderInterval: 7,
          reminderEnabled: false,
          completed: false,
          photos: [],
        };
        await persist([project, ...projects]);
        return project;
      },
      addPhoto: async (projectId, photo) => {
        const next = projects.map((project) =>
          project.id === projectId
            ? { ...project, photos: [...project.photos, { ...photo, id: makeId() }] }
            : project,
        );
        await persist(next);
      },
      setReminder: async (projectId, days, enabled) => {
        const nextReminder = new Date();
        nextReminder.setDate(nextReminder.getDate() + days);
        const next = projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                reminderInterval: days,
                reminderEnabled: enabled,
                nextReminderAt: enabled ? nextReminder.toISOString() : undefined,
              }
            : project,
        );
        await persist(next);
      },
      completeProject: async (projectId) => {
        await persist(
          projects.map((project) =>
            project.id === projectId ? { ...project, completed: true, reminderEnabled: false } : project,
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