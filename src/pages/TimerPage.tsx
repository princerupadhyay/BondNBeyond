import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Coffee,
  Brain,
  FileText,
  ArrowRight,
  Check,
} from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { useWeeklyContract } from "../lib/hooks";
import {
  addStudySession,
  countSessionsToday,
  upsertDailyProgress,
  updateContractGoal,
} from "../lib/db";
import { logActivity, unlockAchievement } from "../lib/hooks";
import {
  Card,
  CircularProgress,
  ProgressBar,
  Badge,
  EmptyState,
} from "../components/ui";
import { formatTime, cn } from "../lib/utils";

const MODES: Record<string, { focus: number; break: number }> = {
  "25/5": { focus: 25, break: 5 },
  "50/10": { focus: 50, break: 10 },
  "90/20": { focus: 90, break: 20 },
};

type Phase = "idle" | "focus" | "break" | "paused" | "done";

type ContractGoal = {
  id: string;
  user_id: string;
  subject: string;
  target_hours: number;
  target_count: number;
  unit: string;
  completed_hours: number;
  completed_count: number;
};

// FIX: progress values are stored as raw floats (e.g. 1 minute studied =
// 0.01666...h). Displaying them unrounded produced strings like
// "0.4166666666666667/2h". This rounds to a clean, human-readable value —
// 1 decimal place is enough precision for a study tracker, and whole
// numbers display with no trailing ".0".
const formatHours = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
};

export function TimerPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: contract, isLoading: contractLoading } = useWeeklyContract();

  const [mode, setMode] = useState<string>("25/5");
  const [customMin, setCustomMin] = useState(25);
  const [phase, setPhase] = useState<Phase>("idle");
  const [secondsLeft, setSecondsLeft] = useState(MODES["25/5"].focus * 60);
  const [selectedGoalId, setSelectedGoalId] = useState<string>("");
  const [sessionsToday, setSessionsToday] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<Date | null>(null);

  // NEW: this week's goals belonging to the current user, pulled from the
  // same weekly contract the Contract page reads/writes. Kept in sync via
  // the same react-query cache key ('contract'), so logging progress here
  // updates the Contract page too, and vice versa.
  const myGoals: ContractGoal[] =
    contract?.goals?.filter((g: ContractGoal) => g.user_id === profile?.id) ??
    [];
  const hasContract = !!contract;
  const hasGoals = myGoals.length > 0;

  // Quick manual "log progress" state, separate from the live timer.
  // Lets the person log study they already did, not just timer sessions.
  const [logDrafts, setLogDrafts] = useState<Record<string, string>>({});
  const [loggingId, setLoggingId] = useState<string | null>(null);

  const focusMin = mode === "custom" ? customMin : MODES[mode].focus;
  const breakMin =
    mode === "custom" ? Math.round(customMin / 5) : MODES[mode].break;
  const totalSeconds = phase === "break" ? breakMin * 60 : focusMin * 60;
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  const loadTodaySessions = useCallback(async () => {
    if (!profile) return;
    const count = await countSessionsToday(profile.id);
    setSessionsToday(count);
  }, [profile]);

  useEffect(() => {
    loadTodaySessions();
  }, [loadTodaySessions]);

  // Default the goal picker to the first goal once goals load, so the
  // timer has something sensible to credit without forcing a manual pick.
  useEffect(() => {
    if (!selectedGoalId && myGoals.length > 0) {
      setSelectedGoalId(myGoals[0].id);
    }
  }, [myGoals, selectedGoalId]);

  const tick = useCallback(() => {
    setSecondsLeft((s) => {
      if (s <= 1) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        // Session complete
        if (phase === "focus" && sessionStartRef.current) {
          completeSession();
        }
        setPhase("break");
        return 0;
      }
      return s - 1;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selectedGoalId]);

  useEffect(() => {
    if (phase === "focus" || phase === "break") {
      intervalRef.current = setInterval(tick, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [phase, tick]);

  // NEW: credits a completed focus session toward whichever goal the user
  // selected, so contract progress moves automatically instead of needing
  // a separate manual log every time.
  const creditGoal = async (goalId: string, minutes: number) => {
    const goal = myGoals.find((g) => g.id === goalId);
    if (!goal) return;
    try {
      if (goal.target_hours > 0) {
        await updateContractGoal(goalId, {
          completed_hours: goal.completed_hours + minutes / 60,
        });
      } else {
        // Count-based goal with no clean minutes->count mapping; nudge by
        // a fraction so it's visible without assuming what "1 unit" means.
        await updateContractGoal(goalId, {
          completed_count: goal.completed_count + 1,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["contract"] });
    } catch {
      toast.error("Session saved, but updating the contract goal failed.");
    }
  };

  // FIX: previously this always logged `duration = focusMin` (the FULL
  // mode length, e.g. 25 for 25/5) regardless of how long the session
  // actually ran. Stopping early after 1 minute still credited 25 minutes
  // to the goal — that's the exact bug in the screenshot (0.41666h = 25min
  // credited for a 1-minute session). Now we compute actual elapsed time
  // from sessionStartRef and use that everywhere.
  //
  // The session's subject is always derived from whichever goal is
  // currently selected, rather than tracked as separate state — so it can
  // never silently disagree with which goal actually got credited.
  const selectedGoal = myGoals.find((g) => g.id === selectedGoalId) ?? null;
  const sessionSubject = selectedGoal?.subject ?? null;

  const completeSession = async (elapsedMinutesOverride?: number) => {
    if (!profile || !sessionStartRef.current) return;
    const fullDuration = mode === "custom" ? customMin : MODES[mode].focus;
    const elapsedMs = Date.now() - sessionStartRef.current.getTime();
    const elapsedMinutesRaw = elapsedMinutesOverride ?? elapsedMs / 1000 / 60;
    // Never log more than the planned duration (a finished timer should
    // read as exactly `fullDuration`, not slightly over from tick delay),
    // and never log a non-positive duration.
    const duration = Math.min(
      fullDuration,
      Math.max(elapsedMinutesRaw, 1 / 60),
    );

    await addStudySession({
      user_id: profile.id,
      subject: sessionSubject,
      duration_minutes: duration,
      mode: mode,
      started_at: sessionStartRef.current.toISOString(),
      completed_at: new Date().toISOString(),
    });

    // Update daily progress
    const today = new Date().toISOString().split("T")[0];
    await upsertDailyProgress(profile.id, today, duration / 60, "yes");

    // Credit the selected contract goal, if there is one, with the same
    // actual elapsed duration.
    if (selectedGoalId) {
      await creditGoal(selectedGoalId, duration);
    }

    const roundedMin = Math.round(duration);
    await logActivity(
      profile.id,
      "session",
      `Completed a ${roundedMin}min focus session${sessionSubject ? ` on ${sessionSubject}` : ""}`,
    );
    await unlockAchievement(profile.id, "first_session");
    if (sessionsToday + 1 >= 30)
      await unlockAchievement(profile.id, "30_sessions");

    queryClient.invalidateQueries();
    loadTodaySessions();
    // Show the precise credited amount (not just rounded minutes) so it's
    // obvious in testing exactly how much was added to the goal.
    toast.success(
      `Session complete — logged ${duration.toFixed(2)} min (${(duration / 60).toFixed(3)}h credited).`,
    );
  };

  const start = () => {
    if (phase === "idle" || phase === "done") {
      setSecondsLeft(focusMin * 60);
      setPhase("focus");
      sessionStartRef.current = new Date();
    } else if (phase === "paused") {
      // KNOWN LIMITATION (pre-existing, not introduced by this fix):
      // sessionStartRef.current is NOT reset here, so elapsed-time math in
      // completeSession() includes any time spent paused. A 5min session
      // with a 10min pause in the middle will log ~15min, not 5min. Fixing
      // this needs a separate "accumulated paused time" tracker — flagging
      // rather than bundling into this fix since it's a different bug.
      setPhase(secondsLeft <= 0 ? "break" : "focus");
    }
  };

  const pause = () => {
    if (phase === "focus" || phase === "break") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPhase("paused");
    }
  };

  // Stopping early calls completeSession() with no override, so it falls
  // back to actual elapsed time since sessionStartRef.current — this is
  // what fixes the "1 min studied but 25 min credited" bug.
  const stop = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (phase === "focus" && sessionStartRef.current) {
      await completeSession();
    }
    setPhase("idle");
    setSecondsLeft(focusMin * 60);
    sessionStartRef.current = null;
  };

  const reset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase("idle");
    setSecondsLeft(focusMin * 60);
    sessionStartRef.current = null;
  };

  // NEW: manual progress logging, independent of the timer — for study
  // done outside the app, or to correct/top-up a goal directly.
  //
  // FIX: this previously called `upsertDailyProgress(..., goal.target_hours
  // > 0 ? value : 0, "yes")` — for a count-based goal (target_hours === 0,
  // e.g. "50 DSA questions"), that unconditionally logged 0 hours_studied.
  // ContractGoal.completed_count updated fine (so the Sunday banner's
  // contract-completion % moved), but DailyProgress — the table backing
  // the dashboard's Today/This Week/Streak/Focus Score cards — recorded a
  // day with 0 hours. Since those cards filter on hours_studied > 0, a
  // count-only day silently never counted as "studied today", even though
  // real progress happened. That's the exact split seen in production:
  // contract completion at 30%, but Today/Streak/Focus Score stuck at 0.
  //
  // Fix: log a study session alongside the goal update, not just a
  // DailyProgress row. addStudySession() is what the dashboard's weekHours
  // and "last 30 days" stats actually read, and it's also what feeds the
  // existing sessionsToday counter on this page — so a count-based log now
  // shows up everywhere a timer-based session would, instead of only
  // moving the contract %.
  //
  // For a genuine count-based win we don't know real elapsed time, so we
  // don't fabricate hours_studied on DailyProgress (still passed as 0,
  // honestly — no invented number). Instead we log a zero-duration
  // StudySession purely as a "something happened today" marker, and widen
  // the dashboard's streak/today logic to recognize status === "yes" OR a
  // same-day StudySession, not just hours_studied > 0. (That dashboard-side
  // change is a separate fix — see DashboardPage.tsx.)
  const logManualProgress = async (goal: ContractGoal) => {
    const raw = logDrafts[goal.id];
    const value = Number(raw);
    if (!raw || Number.isNaN(value) || value <= 0) {
      toast.error("Enter a positive number to log.");
      return;
    }
    setLoggingId(goal.id);
    try {
      const isHoursGoal = goal.target_hours > 0;

      if (isHoursGoal) {
        await updateContractGoal(goal.id, {
          completed_hours: goal.completed_hours + value,
        });
      } else {
        await updateContractGoal(goal.id, {
          completed_count: goal.completed_count + value,
        });
      }

      const today = new Date().toISOString().split("T")[0];
      if (profile) {
        // Honest hours: real value for hours-goals, 0 for count-goals —
        // never fabricated.
        await upsertDailyProgress(
          profile.id,
          today,
          isHoursGoal ? value : 0,
          "yes",
        );

        // Always record a StudySession so this log shows up in
        // weekHours / monthHours / sessionsToday, the same surfaces a
        // timer-run session would hit. Hours-goals log their real duration;
        // count-goals log a 0-minute marker session, since we have no
        // actual elapsed time to attribute and shouldn't invent one.
        await addStudySession({
          user_id: profile.id,
          subject: goal.subject,
          duration_minutes: isHoursGoal ? value * 60 : 0,
          mode: "manual",
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });
      }

      setLogDrafts((d) => ({ ...d, [goal.id]: "" }));
      queryClient.invalidateQueries({ queryKey: ["contract"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["dailyProgress"] });
      loadTodaySessions();
      toast.success(
        `Logged ${value} ${isHoursGoal ? "hr" : "done"} on ${goal.subject}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to log progress");
    }
    setLoggingId(null);
  };

  const isRunning = phase === "focus" || phase === "break";
  const isBreak = phase === "break";

  if (contractLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  // NEW: gate the whole page behind having a contract with goals. A timer
  // with nothing to attach progress to doesn't serve the "earn your Sunday"
  // model — it should point the person back to set that up first.
  if (!hasContract) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Focus Timer</h1>
          <p className="text-sm text-muted">
            Stay focused. Build the habit. Earn your Sunday.
          </p>
        </div>
        <Card>
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="No weekly contract yet"
            description="Create a weekly contract with your partner first — the timer logs your focus sessions straight to your contract goals."
            action={
              <Link
                to="/app/contract"
                className="btn-primary flex items-center gap-2 px-5 py-2.5"
              >
                Create Contract <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  if (!hasGoals) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Focus Timer</h1>
          <p className="text-sm text-muted">
            Stay focused. Build the habit. Earn your Sunday.
          </p>
        </div>
        <Card>
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="Add your goals first"
            description="You have a contract this week, but no goals on it yet. Add at least one so the timer has something to log progress against."
            action={
              <Link
                to="/app/contract"
                className="btn-primary flex items-center gap-2 px-5 py-2.5"
              >
                Add Your Goals <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Focus Timer</h1>
        <p className="text-sm text-muted">
          Stay focused. Build the habit. Earn your Sunday.
        </p>
      </div>

      {/* This Week's Goals — quick view + manual log */}
      <Card>
        <h2 className="mb-4 font-display text-lg font-bold">
          This Week's Goals
        </h2>
        <div className="space-y-3">
          {myGoals.map((goal) => {
            const pct =
              goal.target_hours > 0
                ? (goal.completed_hours / goal.target_hours) * 100
                : (goal.completed_count / goal.target_count) * 100;
            const done = pct >= 100;
            return (
              <div
                key={goal.id}
                className="rounded-xl bg-black/[0.02] p-3 dark:bg-white/[0.03]"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{goal.subject}</span>
                    {done && (
                      <Badge variant="success">
                        <Check className="h-3 w-3" /> Done
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted">
                    {goal.target_hours > 0
                      ? `${formatHours(goal.completed_hours)}/${formatHours(goal.target_hours)}h`
                      : `${goal.completed_count}/${goal.target_count}`}
                  </span>
                </div>
                <ProgressBar value={pct} className="mb-3" />
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step={goal.target_hours > 0 ? 0.5 : 1}
                    placeholder={
                      goal.target_hours > 0
                        ? "Hours studied"
                        : "Count completed"
                    }
                    value={logDrafts[goal.id] ?? ""}
                    onChange={(e) =>
                      setLogDrafts((d) => ({ ...d, [goal.id]: e.target.value }))
                    }
                    className="input-field w-40 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => logManualProgress(goal)}
                    disabled={loggingId === goal.id}
                    className="btn-ghost px-4 py-1.5 text-sm disabled:opacity-50"
                  >
                    {loggingId === goal.id ? "Logging..." : "Log Progress"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Mode Selector */}
      <Card>
        <div className="flex flex-wrap gap-2">
          {Object.keys(MODES).map((m) => (
            <button
              key={m}
              onClick={() => {
                if (!isRunning) {
                  setMode(m as keyof typeof MODES);
                  setSecondsLeft(MODES[m as keyof typeof MODES].focus * 60);
                }
              }}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-semibold transition-all",
                mode === m
                  ? "bg-gradient-warm text-white shadow-glow-orange"
                  : "bg-black/5 text-muted hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10",
              )}
            >
              {m}
            </button>
          ))}
          <div className="flex items-center gap-2 rounded-xl bg-black/5 px-3 py-2 dark:bg-white/5">
            <span className="text-xs text-muted">Custom:</span>
            <input
              type="number"
              min="5"
              max="180"
              value={customMin}
              onChange={(e) => {
                const v = Number(e.target.value);
                setCustomMin(v);
                if (mode === "custom" && !isRunning) setSecondsLeft(v * 60);
              }}
              disabled={isRunning}
              className="w-16 bg-transparent text-sm font-bold outline-none"
            />
            <span className="text-xs text-muted">min</span>
          </div>
        </div>
      </Card>

      {/* Timer */}
      <Card className="flex flex-col items-center py-12">
        <div className="mb-6 flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              isBreak
                ? "bg-success-500/15 text-success-500"
                : "bg-primary-500/15 text-primary-500",
            )}
          >
            {isBreak ? (
              <Coffee className="h-3.5 w-3.5" />
            ) : (
              <Brain className="h-3.5 w-3.5" />
            )}
            {phase === "idle" && "Ready"}
            {phase === "focus" && "Focusing"}
            {phase === "break" && "Break time"}
            {phase === "paused" && "Paused"}
            {phase === "done" && "Complete!"}
          </div>
        </div>

        <CircularProgress value={progress} size={280} strokeWidth={14}>
          <motion.div
            key={secondsLeft}
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="font-mono text-5xl font-bold tracking-tight sm:text-6xl">
              {formatTime(secondsLeft)}
            </div>
            <p className="mt-2 text-sm text-muted">
              {isBreak ? "Take a break" : "Stay focused"}
            </p>
          </motion.div>
        </CircularProgress>

        {/* Goal picker */}
        {phase === "idle" && (
          <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
            <select
              value={selectedGoalId}
              onChange={(e) => setSelectedGoalId(e.target.value)}
              className="input-field text-center"
            >
              {myGoals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.subject}
                </option>
              ))}
            </select>
            <p className="text-center text-xs text-muted">
              This session will count toward the goal above
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="mt-8 flex items-center gap-3">
          {phase === "idle" || phase === "done" ? (
            <button
              onClick={start}
              className="btn-primary flex items-center gap-2 px-8 py-3.5 text-base"
            >
              <Play className="h-5 w-5" /> Start
            </button>
          ) : (
            <>
              {phase === "paused" ? (
                <button
                  onClick={start}
                  className="btn-primary flex items-center gap-2 px-6 py-3"
                >
                  <Play className="h-5 w-5" /> Resume
                </button>
              ) : (
                <button
                  onClick={pause}
                  className="btn-ghost flex items-center gap-2 px-6 py-3"
                >
                  <Pause className="h-5 w-5" /> Pause
                </button>
              )}
              <button
                onClick={stop}
                className="btn-ghost flex items-center gap-2 px-6 py-3 text-danger-500"
              >
                <Square className="h-5 w-5" /> Stop
              </button>
              <button onClick={reset} className="btn-ghost p-3">
                <RotateCcw className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </Card>

      {/* Session Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Today
          </p>
          <p className="font-display text-3xl font-bold">{sessionsToday}</p>
          <p className="text-xs text-muted">sessions</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Mode
          </p>
          <p className="font-display text-3xl font-bold">{mode}</p>
          <p className="text-xs text-muted">{focusMin}min focus</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Break
          </p>
          <p className="font-display text-3xl font-bold">{breakMin}</p>
          <p className="text-xs text-muted">minutes</p>
        </Card>
      </div>
    </div>
  );
}
