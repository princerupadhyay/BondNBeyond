import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { getWeekStart } from "./utils";
import {
  getProfile,
  getContractWithGoals,
  getStudySessions,
  getDailyProgressRange,
  getActivityFeed,
  getAchievements,
  getDailyLetters,
  addActivity,
  unlockAchievement as dbUnlockAchievement,
  type Profile,
  type WeeklyContract,
  type ContractGoal,
  type StudySession,
  type DailyProgress,
  type DailyLetter,
  type ActivityItem,
  type Achievement,
} from "./db";

export function usePartner() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["partner", profile?.partner_id],
    queryFn: async () => {
      if (!profile?.partner_id) return null;
      return getProfile(profile.partner_id);
    },
    enabled: !!profile?.partner_id,
  });
}

export function useWeeklyContract() {
  const { profile } = useAuth();
  const weekStart = getWeekStart();
  return useQuery({
    queryKey: ["contract", weekStart, profile?.id],
    queryFn: async () => {
      if (!profile) return null;
      return getContractWithGoals(weekStart);
    },
    enabled: !!profile,
  });
}

export function useStudySessions(days = 30) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["sessions", days, profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      return getStudySessions(profile.id, days);
    },
    enabled: !!profile,
  });
}

export function useDailyProgress(days = 365) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["dailyProgress", days, profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      return getDailyProgressRange(profile.id, days);
    },
    enabled: !!profile,
  });
}

export function useActivityFeed(max = 50) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["activity", max, profile?.id, profile?.partner_id],
    queryFn: async () => {
      if (!profile) return [];

      const uids = [profile.id];
      if (profile.partner_id) uids.push(profile.partner_id);

      console.log("UIDs:", uids);

      try {
        const result = await getActivityFeed(uids, max);
        console.log("Result:", result);
        return result;
      } catch (err) {
        console.error("getActivityFeed error:", err);
        throw err;
      }
    },
    enabled: !!profile,
  });
}

export function useAchievements() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["achievements", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      return getAchievements(profile.id);
    },
    enabled: !!profile,
  });
}

export function useDailyLetter() {
  const { profile } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["letter", today, profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      return getDailyLetters(today, profile.id, profile.partner_id);
    },
    enabled: !!profile,
  });
}

export async function logActivity(
  uid: string,
  type: string,
  message: string,
  metadata?: Record<string, unknown>,
) {
  await addActivity(uid, type, message, metadata);
}

export async function unlockAchievement(uid: string, key: string) {
  await dbUnlockAchievement(uid, key);
}

export type {
  Profile,
  WeeklyContract,
  ContractGoal,
  StudySession,
  DailyProgress,
  DailyLetter,
  ActivityItem,
  Achievement,
};
