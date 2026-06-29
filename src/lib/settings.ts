import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light' | 'system';

type SettingsState = {
  theme: Theme;
  pomodoroMode: string;
  morningReminder: string;
  eveningReminder: string;
  notificationsEnabled: boolean;
  setTheme: (t: Theme) => void;
  setPomodoroMode: (m: string) => void;
  setMorningReminder: (t: string) => void;
  setEveningReminder: (t: string) => void;
  setNotificationsEnabled: (v: boolean) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      pomodoroMode: '25/5',
      morningReminder: '08:00',
      eveningReminder: '21:00',
      notificationsEnabled: true,
      setTheme: (theme) => set({ theme }),
      setPomodoroMode: (pomodoroMode) => set({ pomodoroMode }),
      setMorningReminder: (morningReminder) => set({ morningReminder }),
      setEveningReminder: (eveningReminder) => set({ eveningReminder }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
    }),
    { name: 'bb-settings' }
  )
);
