import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Flame,
  Clock,
  Target,
  TrendingUp,
  Calendar,
  Heart,
  Award,
  Check,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  usePartner,
  useStudySessions,
  useDailyProgress,
  useWeeklyContract,
} from "../lib/hooks";
import { Card, CircularProgress, Badge, ProgressBar } from "../components/ui";
import { getGreeting, initials, cn } from "../lib/utils";

/* -------------------------------------------------------------------------- */
/*  Date helpers                                                             */
/* -------------------------------------------------------------------------- */
/*
  DailyProgress.date is always written as a plain 'YYYY-MM-DD' string (see
  completeSession / logManualProgress in TimerPage, both of which do
  `new Date().toISOString().split('T')[0]`), so dashboard reads can compare
  against that format directly with no normalization step. StudySession's
  started_at is always a full ISO datetime string from the same source.
  No Firestore Timestamp objects are involved anywhere in this schema.
*/

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayKey(): string {
  return localDateKey(new Date());
}

/**
 * Sunday-start week, matching lib/utils.ts getWeekStart() exactly — that's
 * what useWeeklyContract() uses to fetch the current WeeklyContract, so the
 * dashboard's week strip has to use the same boundary or it'll show 7 days
 * that don't correspond to the actual contract week.
 */
function weekKeysContaining(date: Date): string[] {
  const dow = date.getDay(); // 0 = Sun ... 6 = Sat
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - dow);
  sunday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return localDateKey(d);
  });
}

/* -------------------------------------------------------------------------- */
/*  Exam countdown (unchanged)                                                */
/* -------------------------------------------------------------------------- */

function useCountdown(targetDate: string | null) {
  const [time, setTime] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    if (!targetDate) return;
    const calc = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTime({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTime({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return time;
}

function CountdownCard({
  label,
  date,
  examName,
}: {
  label: string;
  date: string | null;
  examName: string | null;
}) {
  const t = useCountdown(date);
  const units = [
    { label: "Days", value: t.days },
    { label: "Hours", value: t.hours },
    { label: "Min", value: t.minutes },
    { label: "Sec", value: t.seconds },
  ];

  return (
    <Card hover className="flex-1">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {label}
          </p>
          <p className="font-display text-lg font-bold">
            {examName ?? "No exam set"}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-warm-soft text-primary-500">
          <Calendar className="h-5 w-5" />
        </div>
      </div>
      {date ? (
        <div className="grid grid-cols-4 gap-2">
          {units.map((u) => (
            <div key={u.label} className="text-center">
              <motion.div
                key={u.value}
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="rounded-lg bg-black/5 py-2 font-mono text-xl font-bold dark:bg-white/5"
              >
                {String(u.value).padStart(2, "0")}
              </motion.div>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">
                {u.label}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Set your exam date in settings.</p>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sunday Together banner — redesigned                                      */
/* -------------------------------------------------------------------------- */
/*
  Design notes:
  - One accent identity (ember orange) instead of a different gradient per
    weekday. Color now encodes meaning (progress, not "which day is it").
  - The signature element is the week strip: seven segments, Sunday-start
    to match the app's actual week boundary (lib/utils.ts getWeekStart),
    each one literally filling as that day's combined completion comes in.
    This replaces decorative floating sparkles with something that actually
    carries information — it's the GitHub-heatmap idea from the spec,
    compressed into the current week and built directly into the banner.
  - Confetti is reserved for the rising edge of "unlocked" — it now means
    something, instead of running as ambient decoration on every render.
  - Sunday itself still gets a full takeover, but quieter: no checklist of
    generic phrases, just space.
*/

const MOTIVATIONAL_QUOTES = [
  "Distance is temporary. Consistency isn't.",
  "Today's chapter becomes tomorrow's future.",
  "Study now. Sunday will thank you.",
  "Small sessions. Big dreams.",
  "Love grows through consistency.",
  "Every Pomodoro is another promise kept.",
  "You're not studying alone.",
  "Two dreams. One journey.",
  "The countdown isn't to Sunday. It's to being together.",
];

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function useSundayCountdown() {
  const [state, setState] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    dayOfWeek: new Date().getDay(),
    isSunday: new Date().getDay() === 0,
  });

  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const isSunday = dayOfWeek === 0;

      const daysUntilSunday = (7 - dayOfWeek) % 7;
      const deadline = new Date(now);
      deadline.setDate(now.getDate() + daysUntilSunday + 1);
      deadline.setHours(0, 0, 0, 0);

      const diff = Math.max(0, deadline.getTime() - now.getTime());
      setState({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        dayOfWeek,
        isSunday,
      });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, []);

  return state;
}

function dayLabel(dayOfWeek: number): string {
  switch (dayOfWeek) {
    case 1:
      return "A new week begins";
    case 2:
      return "Building momentum";
    case 3:
    case 4:
      return "Halfway there";
    case 5:
      return "Almost there";
    case 6:
      return "Final stretch";
    default:
      return "Today's the day";
  }
}

function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.4,
        color: ["#ff9a4d", "#ffb86b", "#ffd9a8", "#ff7a26"][i % 4],
        rotate: Math.random() * 360 - 180,
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 block h-2 w-2 rounded-sm"
          style={{ left: `${p.x}%`, backgroundColor: p.color }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ y: 240, opacity: 0, rotate: p.rotate }}
          transition={{ duration: 1.6, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

/** The signature element: seven Sunday-start segments, each one's fill is
 *  that day's combined (you + partner average) completion percentage. */
function WeekStrip({
  dayCompletions,
  todayIndex,
}: {
  dayCompletions: number[]; // length 7, Mon..Sun, 0-100
  todayIndex: number; // 0-6, Sun-start
}) {
  return (
    <div className="relative">
      <div className="flex gap-1">
        {dayCompletions.map((pct, i) => (
          <div
            key={i}
            className={cn(
              "h-[7px] flex-1 overflow-hidden rounded-full",
              i > todayIndex ? "bg-white/[0.05]" : "bg-white/[0.08]",
            )}
          >
            {i <= todayIndex && (
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.04 }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1">
        {DAY_LETTERS.map((l, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 text-center text-[10px] font-medium",
              i === todayIndex ? "text-orange-400" : "text-white/30",
            )}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatRow({
  label,
  pct,
  emoji,
}: {
  label: string;
  pct: number;
  emoji: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex w-[72px] shrink-0 items-center gap-1.5 text-[13px] font-medium text-white/80">
        <span className="text-[15px]">{emoji}</span> {label}
      </span>
      <div className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-white/[0.07]">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-orange-500"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-[13px] font-semibold tabular-nums text-white/90">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SundayTogetherBanner({
  earned,
  myCompletion,
  partnerCompletion,
  dayCompletions,
  lastWeekSummary,
}: {
  earned?: boolean;
  myCompletion: number;
  partnerCompletion: number;
  dayCompletions: number[];
  lastWeekSummary: { you: number; partner: number } | null;
}) {
  const { days, hours, minutes, seconds, dayOfWeek, isSunday } =
    useSundayCountdown();
  const unlocked = !!earned;
  const todayIndex = dayOfWeek; // Sun-start index, 0-6 — matches weekKeysContaining

  const [quote] = useState(
    () =>
      MOTIVATIONAL_QUOTES[
        Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)
      ],
  );

  const [showConfetti, setShowConfetti] = useState(false);
  const prevUnlocked = useRef(unlocked);
  useEffect(() => {
    if (unlocked && !prevUnlocked.current) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 2200);
      return () => clearTimeout(t);
    }
    prevUnlocked.current = unlocked;
  }, [unlocked]);

  // Full takeover only once Sunday has actually arrived and is unlocked.
  if (isSunday && unlocked) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-orange-900/40 bg-[#181410] p-7 sm:p-9"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 100% at 50% 0%, rgba(255,154,38,0.12) 0%, transparent 65%)",
          }}
        />
        <div className="relative flex items-center gap-2 text-orange-400">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
          <span className="text-[11px] font-semibold uppercase tracking-widest">
            Sunday together
          </span>
        </div>
        <p className="relative mt-3 font-display text-2xl font-bold text-orange-100 sm:text-3xl">
          Happy Sunday
        </p>
        <p className="relative mt-1 text-sm text-orange-200/70 sm:text-base">
          Today is yours. No goals, no timers.
        </p>
        <ul className="relative mt-5 space-y-2 text-sm text-orange-200/80 sm:text-base">
          {[
            "Spend the day together",
            "Put the apps down",
            "Talk about anything but exams",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2.5">
              <span className="h-1 w-1 shrink-0 rounded-full bg-orange-400/80" />
              {item}
            </li>
          ))}
          <li className="flex items-center gap-2.5 font-semibold text-orange-100">
            <span className="h-1 w-1 shrink-0 rounded-full bg-orange-400" />
            You earned this one.
          </li>
        </ul>
      </motion.div>
    );
  }

  const units = [
    { label: "Days", value: days },
    { label: "Hrs", value: hours },
    { label: "Min", value: minutes },
    { label: "Sec", value: seconds },
  ];

  const headline = unlocked ? "Sunday unlocked" : dayLabel(dayOfWeek);
  const sub = unlocked
    ? "Both of you kept every promise this week."
    : lastWeekSummary && dayOfWeek === 1
      ? `Last week: you ${Math.round(lastWeekSummary.you)}% · partner ${Math.round(lastWeekSummary.partner)}%.`
      : "Keep the week on track for both of you.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-3xl border p-6 sm:p-7",
        unlocked
          ? "border-orange-900/30 bg-[#181410]"
          : "border-white/[0.08] bg-[#141414]",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(120% 100% at 15% 0%, rgba(255,122,38,${unlocked ? 0.13 : 0.06}) 0%, transparent 60%)`,
        }}
      />
      {showConfetti && <ConfettiBurst />}

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/55">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              unlocked ? "bg-orange-400" : "bg-orange-500/70",
            )}
          />
          <span className="text-[11px] font-semibold uppercase tracking-widest">
            Sunday together
          </span>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/55">
          {WEEKDAY_SHORT[dayOfWeek]}
        </span>
      </div>

      <p
        className={cn(
          "relative mt-3 font-display text-xl font-bold sm:text-2xl",
          unlocked ? "text-orange-100" : "text-white",
        )}
      >
        {headline}
      </p>
      <p className="relative mt-1 text-[13px] text-white/55 sm:text-sm">
        {sub}
      </p>

      <div className="relative mt-5">
        <WeekStrip dayCompletions={dayCompletions} todayIndex={todayIndex} />
      </div>

      <div className="relative mt-5 grid grid-cols-4 gap-2">
        {units.map((u) => (
          <div
            key={u.label}
            className="rounded-xl border border-white/[0.05] bg-white/[0.035] py-2.5 text-center"
          >
            <motion.div
              key={u.value}
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="font-display text-xl font-bold tabular-nums text-white sm:text-2xl"
            >
              {String(u.value).padStart(2, "0")}
            </motion.div>
            <p className="mt-1 text-[9px] uppercase tracking-wide text-white/40">
              {u.label}
            </p>
          </div>
        ))}
      </div>

      <div className="relative mt-5 space-y-2.5">
        {unlocked ? (
          <>
            <p className="flex items-center gap-2 text-[13px] font-medium text-orange-200/90">
              <Check className="h-3.5 w-3.5 text-orange-400" /> You completed
              every goal
            </p>
            <p className="flex items-center gap-2 text-[13px] font-medium text-orange-200/90">
              <Check className="h-3.5 w-3.5 text-orange-400" /> Partner
              completed every goal
            </p>
          </>
        ) : (
          <>
            <StatRow label="You" emoji="🧑" pct={myCompletion} />
            <StatRow label="Partner" emoji="❤️" pct={partnerCompletion} />
          </>
        )}
      </div>

      <p
        className={cn(
          "relative mt-5 border-t pt-3 text-[12px] sm:text-[13px]",
          unlocked
            ? "border-orange-900/25 text-orange-200/60"
            : "border-white/[0.06] italic text-white/40",
        )}
      >
        {unlocked ? "Enjoy it guilt-free. It's earned." : `"${quote}"`}
      </p>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dashboard page                                                            */
/* -------------------------------------------------------------------------- */

/** A loading/empty hairline used wherever a real number isn't available yet,
 *  so "no data" is visually distinct from "zero progress". */
function StatValue({
  loading,
  children,
}: {
  loading: boolean;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <span className="inline-block h-5 w-12 animate-pulse rounded bg-white/10" />
    );
  }
  return <>{children}</>;
}

export function DashboardPage() {
  const { profile } = useAuth();
  const { data: partner } = usePartner();
  const { data: sessions, isLoading: sessionsLoading } = useStudySessions(30);
  const { data: progress, isLoading: progressLoading } = useDailyProgress(30);
  const { data: contract, isLoading: contractLoading } = useWeeklyContract();

  const dataLoading = sessionsLoading || progressLoading;

  const today = todayKey();

  // DailyProgress.date is a plain 'YYYY-MM-DD' string (see TimerPage's
  // completeSession / logManualProgress), so this can compare directly.
  const progressByDate = useMemo(
    () => new Map((progress ?? []).map((p) => [p.date, p])),
    [progress],
  );

  const todayProgress = progressByDate.get(today);
  const todayHours = todayProgress?.hours_studied ?? 0;
  const dailyGoal = profile?.daily_study_goal ?? 4;
  const dailyPct =
    dailyGoal > 0 ? Math.min(100, (todayHours / dailyGoal) * 100) : 0;

  // Week hours: sum session minutes whose started_at (a full ISO datetime
  // string) falls within the last 7 days. Compared directly as Dates —
  // no need to collapse to a date-only key first, which would have shifted
  // the 7-day boundary by up to 24h.
  const weekHours = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const minutes = (sessions ?? []).reduce((sum, s) => {
      const started = new Date(s.started_at);
      if (Number.isNaN(started.getTime())) return sum;
      return started >= weekAgo ? sum + (s.duration_minutes ?? 0) : sum;
    }, 0);
    return minutes / 60;
  }, [sessions]);

  const weeklyGoal = profile?.weekly_study_goal ?? 28;
  const weeklyPct =
    weeklyGoal > 0 ? Math.min(100, (weekHours / weeklyGoal) * 100) : 0;

  const monthHours =
    (sessions ?? []).reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0) /
    60;

  // Streak: consecutive days with real progress, walking back from today.
  // "Real progress" means hours_studied > 0 OR status === 'yes' — the
  // latter covers count-based goal logs (e.g. "10 DSA questions"), which
  // TimerPage.logManualProgress writes with status:'yes' but hours_studied:
  // 0 since no actual duration is known. Checking hours alone would let a
  // pure count-based day silently break the streak despite real progress.
  const streak = useMemo(() => {
    if (!progressByDate.size) return 0;
    let count = 0;
    const cursor = new Date();
    while (true) {
      const key = localDateKey(cursor);
      const entry = progressByDate.get(key);
      const studied =
        !!entry && ((entry.hours_studied ?? 0) > 0 || entry.status === "yes");
      if (studied) {
        count++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }, [progressByDate]);

  const totalHours = monthHours;
  const focusScore = Math.round((dailyPct + weeklyPct) / 2);

  // Matches ContractGoal from lib/db.ts exactly — target_hours and
  // target_count are always-present numbers; a goal that tracks hours has
  // target_count === 0 and vice versa (see addContractGoals / the Contract
  // creation form), so checking target_hours > 0 is enough to pick the
  // right metric without needing `||` fallbacks that could mask a real 0%.
  type Goal = {
    user_id: string;
    completed_hours: number;
    target_hours: number;
    completed_count: number;
    target_count: number;
  };

  const completionPct = (goals: Goal[]): number => {
    if (!goals.length) return 0;
    const total = goals.reduce((sum, g) => {
      const pct =
        g.target_hours > 0
          ? g.completed_hours / g.target_hours
          : g.target_count > 0
            ? g.completed_count / g.target_count
            : 0;
      return sum + Math.min(1, pct);
    }, 0);
    return (total / goals.length) * 100;
  };

  const myGoals: Goal[] =
    contract?.goals?.filter((g: Goal) => g.user_id === profile?.id) ?? [];
  const partnerGoals: Goal[] =
    contract?.goals?.filter((g: Goal) => g.user_id === profile?.partner_id) ??
    [];

  const myCompletion = completionPct(myGoals);
  const partnerCompletion = completionPct(partnerGoals);

  const hasContract = !contractLoading && !!contract;
  const sundayEarned =
    contract?.sunday_earned ??
    (hasContract &&
      myCompletion >= 100 &&
      partnerCompletion >= 100 &&
      contract?.locked);

  // Per-day completion for the week strip: each of the 7 days of the
  // current week, scored against the daily study goal from DailyProgress.
  // Today uses the live dailyPct so the strip visibly moves through the
  // day rather than waiting for midnight. A day with a count-based log
  // (status:'yes', hours_studied:0 — see TimerPage.logManualProgress) gets
  // a small visible floor rather than reading identically to a day with
  // no activity at all; it's not 0% toward the hours goal, but it's not
  // nothing either.
  const dayCompletions = useMemo(() => {
    const keys = weekKeysContaining(new Date());
    const goal = profile?.daily_study_goal ?? 4;
    return keys.map((key) => {
      if (key === today) return dailyPct;
      const entry = progressByDate.get(key);
      if (!entry) return 0;
      const hoursPct =
        goal > 0 ? Math.min(100, ((entry.hours_studied ?? 0) / goal) * 100) : 0;
      if (hoursPct === 0 && entry.status === "yes") return 8;
      return hoursPct;
    });
  }, [progressByDate, today, dailyPct, profile?.daily_study_goal]);

  // "Last week's result" copy (e.g. "you 92% · partner 84%") would need a
  // field on WeeklyContract that records the prior week's outcome — no such
  // field exists on the current schema (lib/db.ts), so the banner falls
  // back to its generic Monday message instead of guessing a field name.
  const lastWeekSummary: { you: number; partner: number } | null = null;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-2xl font-extrabold sm:text-3xl"
        >
          {getGreeting()}, {profile?.name?.split(" ")[0] || "Scholar"}.
        </motion.h1>
        <p className="mt-1 text-sm text-muted">
          {sundayEarned
            ? "You earned your Sunday together."
            : "Keep your promises. Earn your Sunday."}
        </p>
      </div>

      {/* Sunday Together Banner */}
      <SundayTogetherBanner
        earned={sundayEarned}
        myCompletion={myCompletion}
        partnerCompletion={partnerCompletion}
        dayCompletions={dayCompletions}
        lastWeekSummary={lastWeekSummary}
      />

      {/* Progress Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4">
          <CircularProgress value={dailyPct} size={80} strokeWidth={8}>
            <span className="text-sm font-bold">
              <StatValue loading={progressLoading}>
                {Math.round(dailyPct)}%
              </StatValue>
            </span>
          </CircularProgress>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Today
            </p>
            <p className="font-display text-xl font-bold">
              <StatValue loading={progressLoading}>
                {todayHours.toFixed(1)}h
              </StatValue>
            </p>
            <p className="text-xs text-muted">of {dailyGoal}h goal</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <CircularProgress value={weeklyPct} size={80} strokeWidth={8}>
            <span className="text-sm font-bold">
              <StatValue loading={sessionsLoading}>
                {Math.round(weeklyPct)}%
              </StatValue>
            </span>
          </CircularProgress>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              This Week
            </p>
            <p className="font-display text-xl font-bold">
              <StatValue loading={sessionsLoading}>
                {weekHours.toFixed(1)}h
              </StatValue>
            </p>
            <p className="text-xs text-muted">of {weeklyGoal}h goal</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-warning-500/10">
            <Flame className="h-8 w-8 text-warning-500" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Streak
            </p>
            <p className="font-display text-xl font-bold">
              <StatValue loading={progressLoading}>{streak} days</StatValue>
            </p>
            <p className="text-xs text-muted">keep it alive</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-500/10">
            <Target className="h-8 w-8 text-primary-500" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Focus Score
            </p>
            <p className="font-display text-xl font-bold">
              <StatValue loading={dataLoading}>{focusScore}</StatValue>
            </p>
            <p className="text-xs text-muted">out of 100</p>
          </div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Study Progress Detail */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Study Progress</h2>
            <Link
              to="/app/analytics"
              className="text-sm text-primary-500 hover:underline"
            >
              Analytics
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col items-center rounded-xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
              <CircularProgress value={dailyPct} size={100}>
                <span className="font-display text-lg font-bold">
                  {Math.round(dailyPct)}%
                </span>
                <span className="text-[10px] text-muted">Today</span>
              </CircularProgress>
              <p className="mt-2 text-sm font-medium">
                {todayHours.toFixed(1)}h studied
              </p>
            </div>
            <div className="flex flex-col items-center rounded-xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
              <CircularProgress value={weeklyPct} size={100}>
                <span className="font-display text-lg font-bold">
                  {Math.round(weeklyPct)}%
                </span>
                <span className="text-[10px] text-muted">Week</span>
              </CircularProgress>
              <p className="mt-2 text-sm font-medium">
                {weekHours.toFixed(1)}h this week
              </p>
            </div>
            <div className="flex flex-col items-center rounded-xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
              <CircularProgress
                value={Math.min(100, (monthHours / (weeklyGoal * 4)) * 100)}
                size={100}
              >
                <span className="font-display text-lg font-bold">
                  {monthHours.toFixed(0)}
                </span>
                <span className="text-[10px] text-muted">Hours</span>
              </CircularProgress>
              <p className="mt-2 text-sm font-medium">Last 30 days</p>
            </div>
          </div>

          {!dataLoading && !sessions?.length && !progress?.length && (
            <div className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-muted">
              No study sessions yet. Start a focus session to see your progress
              here.
            </div>
          )}

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted">
                <Clock className="h-4 w-4" /> Total Study Hours
              </span>
              <span className="font-bold">{totalHours.toFixed(1)}h</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted">
                <TrendingUp className="h-4 w-4" /> Current Streak
              </span>
              <span className="font-bold">{streak} days</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted">
                <Award className="h-4 w-4" /> Focus Score
              </span>
              <span className="font-bold">{focusScore}/100</span>
            </div>
          </div>
        </Card>

        {/* Partner Card */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Partner</h2>
            <Badge variant={partner ? "success" : "default"}>
              {partner ? "Connected" : "Not linked"}
            </Badge>
          </div>
          {partner ? (
            <div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-warm text-lg font-bold text-white">
                    {initials(partner.name || partner.email)}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white bg-success-500 dark:border-ink-800" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {partner.name || "Partner"}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {partner.exam_name ?? "No exam set"}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted">Today</span>
                    <span className="font-semibold">
                      {Math.round(partnerCompletion)}%
                    </span>
                  </div>
                  <ProgressBar value={partnerCompletion} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted">Weekly</span>
                    <span className="font-semibold">
                      {Math.round(partnerCompletion)}%
                    </span>
                  </div>
                  <ProgressBar value={partnerCompletion} />
                </div>
              </div>

              <Link to="/app/partner" className="mt-4 block">
                <button className="btn-ghost w-full py-2 text-sm">
                  View Partner Activity
                </button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <Heart className="mb-3 h-10 w-10 text-muted" />
              <p className="text-sm text-muted">No partner linked yet.</p>
              <Link to="/app/settings" className="mt-4">
                <button className="btn-primary px-4 py-2 text-sm">
                  Link Partner
                </button>
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* Countdowns */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <CountdownCard
          label="Your Exam"
          date={profile?.exam_date ?? null}
          examName={profile?.exam_name ?? null}
        />
        <CountdownCard
          label="Partner Exam"
          date={partner?.exam_date ?? null}
          examName={partner?.exam_name ?? null}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/app/contract">
          <Card hover className="cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
                <FileTextIcon />
              </div>
              <div>
                <p className="font-semibold">Weekly Contract</p>
                <p className="text-xs text-muted">Set your weekly goals</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/app/timer">
          <Card hover className="cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/10 text-accent-500">
                <TimerIcon />
              </div>
              <div>
                <p className="font-semibold">Focus Timer</p>
                <p className="text-xs text-muted">Start a study session</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/app/partner">
          <Card hover className="cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-500/10 text-success-500">
                <Heart className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Daily Letter</p>
                <p className="text-xs text-muted">Send encouragement</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function FileTextIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

function TimerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2M5 3L2 6M19 3l3 3" />
    </svg>
  );
}
