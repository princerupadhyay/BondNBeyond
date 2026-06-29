import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  generateInviteCode,
} from "./firebase";

// ─── Types ───────────────────────────────────────────────────────────────

export type Profile = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  gender: string | null;
  exam_name: string | null;
  exam_date: string | null;
  occupation: string | null;
  is_working_professional: boolean;
  daily_study_goal: number;
  weekly_study_goal: number;
  preferred_study_time: string;
  timezone: string;
  partner_id: string | null;
  invite_code: string;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
};

export type WeeklyContract = {
  id: string;
  couple_id: string;
  week_start: string;
  week_end: string;
  user_a: string;
  user_b: string;
  user_a_agreed: boolean;
  user_b_agreed: boolean;
  locked: boolean;
  sunday_earned: boolean | null;
  created_at: string;
};

export type ContractGoal = {
  id: string;
  contract_id: string;
  user_id: string;
  subject: string;
  target_hours: number;
  target_count: number;
  unit: string;
  completed_hours: number;
  completed_count: number;
};

export type StudySession = {
  id: string;
  user_id: string;
  subject: string | null;
  duration_minutes: number;
  mode: string;
  started_at: string;
  completed_at: string | null;
};

export type DailyProgress = {
  id: string;
  user_id: string;
  date: string;
  status: string;
  hours_studied: number;
  note: string | null;
};

export type DailyLetter = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  date: string;
  created_at: string;
};

export type ActivityItem = {
  id: string;
  user_id: string;
  type: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type Achievement = {
  id: string;
  user_id: string;
  key: string;
  unlocked_at: string;
};

// ─── Profiles ─────────────────────────────────────────────────────────────

export async function getProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(doc(db, "profiles", uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Profile;
}

export async function createProfile(
  uid: string,
  email: string,
): Promise<Profile> {
  const now = new Date().toISOString();
  const profile: Omit<Profile, "id"> = {
    email,
    name: "",
    avatar_url: null,
    gender: null,
    exam_name: null,
    exam_date: null,
    occupation: null,
    is_working_professional: false,
    daily_study_goal: 4,
    weekly_study_goal: 28,
    preferred_study_time: "evening",
    timezone: "UTC",
    partner_id: null,
    invite_code: generateInviteCode(),
    onboarding_complete: false,
    created_at: now,
    updated_at: now,
  };
  await setDoc(doc(db, "profiles", uid), profile);
  return { id: uid, ...profile } as Profile;
}

export async function updateProfile(
  uid: string,
  patch: Partial<Profile>,
): Promise<Profile | null> {
  await updateDoc(doc(db, "profiles", uid), {
    ...patch,
    updated_at: new Date().toISOString(),
  });
  return getProfile(uid);
}

export async function deleteProfile(uid: string): Promise<void> {
  await deleteDoc(doc(db, "profiles", uid));
}

export async function getProfileByInviteCode(
  code: string,
): Promise<Profile | null> {
  const snap = await getDocs(
    query(
      collection(db, "profiles"),
      where("invite_code", "==", code.toUpperCase()),
      limit(1),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Profile;
}

export async function linkPartners(
  uid: string,
  partnerId: string,
): Promise<void> {
  await updateDoc(doc(db, "profiles", uid), {
    partner_id: partnerId,
    updated_at: new Date().toISOString(),
  });
  await updateDoc(doc(db, "profiles", partnerId), {
    partner_id: uid,
    updated_at: new Date().toISOString(),
  });
}

export async function unlinkPartners(
  uid: string,
  partnerId: string,
): Promise<void> {
  await updateDoc(doc(db, "profiles", uid), {
    partner_id: null,
    updated_at: new Date().toISOString(),
  });
  await updateDoc(doc(db, "profiles", partnerId), {
    partner_id: null,
    updated_at: new Date().toISOString(),
  });
}

// ─── Weekly Contracts ────────────────────────────────────────────────────

export async function getWeeklyContract(
  weekStart: string,
): Promise<WeeklyContract | null> {
  const snap = await getDocs(
    query(
      collection(db, "weekly_contracts"),
      where("week_start", "==", weekStart),
      limit(1),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as WeeklyContract;
}

export async function getContractWithGoals(
  weekStart: string,
): Promise<(WeeklyContract & { goals: ContractGoal[] }) | null> {
  const contract = await getWeeklyContract(weekStart);
  if (!contract) return null;
  const goalsSnap = await getDocs(
    query(
      collection(db, "contract_goals"),
      where("contract_id", "==", contract.id),
    ),
  );
  const goals = goalsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as ContractGoal,
  );
  return { ...contract, goals };
}

export async function createContract(
  data: Omit<WeeklyContract, "id" | "created_at">,
): Promise<WeeklyContract> {
  const ref = await addDoc(collection(db, "weekly_contracts"), {
    ...data,
    created_at: new Date().toISOString(),
  });
  return {
    id: ref.id,
    ...data,
    created_at: new Date().toISOString(),
  } as WeeklyContract;
}

export async function updateContract(
  contractId: string,
  patch: Partial<WeeklyContract>,
): Promise<void> {
  await updateDoc(doc(db, "weekly_contracts", contractId), patch);
}

// ─── Contract Goals ──────────────────────────────────────────────────────

export async function addContractGoals(
  goals: Omit<ContractGoal, "id">[],
): Promise<void> {
  for (const g of goals) {
    await addDoc(collection(db, "contract_goals"), g);
  }
}

export async function updateContractGoal(
  goalId: string,
  patch: Partial<ContractGoal>,
): Promise<void> {
  await updateDoc(doc(db, "contract_goals", goalId), patch);
}

// ─── Study Sessions ────────────────────────────────────────────────────────

export async function addStudySession(
  data: Omit<StudySession, "id">,
): Promise<void> {
  await addDoc(collection(db, "study_sessions"), data);
}

export async function getStudySessions(
  uid: string,
  days: number,
): Promise<StudySession[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const snap = await getDocs(
    query(
      collection(db, "study_sessions"),
      where("user_id", "==", uid),
      where("started_at", ">=", since.toISOString()),
      orderBy("started_at", "desc"),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StudySession);
}

export async function countSessionsToday(uid: string): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const snap = await getDocs(
    query(
      collection(db, "study_sessions"),
      where("user_id", "==", uid),
      where("started_at", ">=", today),
    ),
  );
  return snap.size;
}

// ─── Daily Progress ───────────────────────────────────────────────────────

export async function getDailyProgress(
  uid: string,
  date: string,
): Promise<DailyProgress | null> {
  const snap = await getDocs(
    query(
      collection(db, "daily_progress"),
      where("user_id", "==", uid),
      where("date", "==", date),
      limit(1),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as DailyProgress;
}

export async function upsertDailyProgress(
  uid: string,
  date: string,
  hoursStudied: number,
  status: string,
): Promise<void> {
  const existing = await getDailyProgress(uid, date);
  if (existing) {
    await updateDoc(doc(db, "daily_progress", existing.id), {
      hours_studied: existing.hours_studied + hoursStudied,
      status,
    });
  } else {
    await addDoc(collection(db, "daily_progress"), {
      user_id: uid,
      date,
      status,
      hours_studied: hoursStudied,
      note: null,
    });
  }
}

export async function getDailyProgressRange(
  uid: string,
  days: number,
): Promise<DailyProgress[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split("T")[0];
  const snap = await getDocs(
    query(
      collection(db, "daily_progress"),
      where("user_id", "==", uid),
      where("date", ">=", sinceStr),
      orderBy("date", "asc"),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DailyProgress);
}

// ─── Daily Letters ─────────────────────────────────────────────────────────

export async function addDailyLetter(
  data: Omit<DailyLetter, "id" | "created_at">,
): Promise<void> {
  await addDoc(collection(db, "daily_letters"), {
    ...data,
    created_at: new Date().toISOString(),
  });
}

export async function getDailyLetters(
  date: string,
  uid: string,
  partnerId: string | null,
): Promise<DailyLetter[]> {
  const constraints = [where("date", "==", date)];
  const snap = await getDocs(
    query(collection(db, "daily_letters"), ...constraints),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as DailyLetter)
    .filter(
      (l) =>
        l.sender_id === uid ||
        l.recipient_id === uid ||
        (partnerId &&
          (l.sender_id === partnerId || l.recipient_id === partnerId)),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getDailyLettersForUser(
  uid: string,
): Promise<DailyLetter[]> {
  const snap = await getDocs(
    query(collection(db, "daily_letters"), where("sender_id", "==", uid)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DailyLetter);
}

export async function getDailyLettersForRecipient(
  uid: string,
): Promise<DailyLetter[]> {
  const snap = await getDocs(
    query(collection(db, "daily_letters"), where("recipient_id", "==", uid)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DailyLetter);
}

// ─── Activity Feed ────────────────────────────────────────────────────────

export async function addActivity(
  uid: string,
  type: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await addDoc(collection(db, "activity_feed"), {
    user_id: uid,
    type,
    message,
    metadata: metadata ?? null,
    created_at: new Date().toISOString(),
  });
}

export async function getActivityFeed(
  uids: string[],
  max: number,
): Promise<ActivityItem[]> {
  if (uids.length === 0) return [];
  const snap = await getDocs(
    query(
      collection(db, "activity_feed"),
      where("user_id", "in", uids),
      orderBy("created_at", "desc"),
      limit(max),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ActivityItem);
}

// ─── Achievements ─────────────────────────────────────────────────────────

export async function getAchievements(uid: string): Promise<Achievement[]> {
  const snap = await getDocs(
    query(collection(db, "achievements"), where("user_id", "==", uid)),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Achievement)
    .sort((a, b) => (b.unlocked_at ?? "").localeCompare(a.unlocked_at ?? ""));
}

export async function unlockAchievement(
  uid: string,
  key: string,
): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, "achievements"),
      where("user_id", "==", uid),
      where("key", "==", key),
      limit(1),
    ),
  );
  if (!snap.empty) return;
  await addDoc(collection(db, "achievements"), {
    user_id: uid,
    key,
    unlocked_at: new Date().toISOString(),
  });
}

// ─── Data Export ──────────────────────────────────────────────────────────

export async function exportUserData(uid: string): Promise<{
  sessions: StudySession[];
  progress: DailyProgress[];
  lettersSent: DailyLetter[];
  lettersReceived: DailyLetter[];
}> {
  const [sessions, progress, lettersSent, lettersReceived] = await Promise.all([
    getStudySessions(uid, 3650),
    getDailyProgressRange(uid, 3650),
    getDailyLettersForUser(uid),
    getDailyLettersForRecipient(uid),
  ]);
  return { sessions, progress, lettersSent, lettersReceived };
}
