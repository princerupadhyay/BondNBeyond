import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Lock,
  Check,
  X,
  FileText,
  Sparkles,
  Heart,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { usePartner, useWeeklyContract } from "../lib/hooks";
import {
  createContract as dbCreateContract,
  addContractGoals,
  updateContract,
  updateContractGoal,
} from "../lib/db";
import { Card, Badge, ProgressBar, EmptyState } from "../components/ui";
import {
  getWeekStart,
  getWeekEnd,
  getCoupleId,
  initials,
  cn,
} from "../lib/utils";

type GoalDraft = {
  subject: string;
  target_hours: number;
  target_count: number;
  unit: string;
};

// Mirrors the formatHours helper in TimerPage — progress values are raw
// floats (e.g. 1 minute studied = 0.01666...h). Round for display so this
// never shows something like "0.4166666666666667/2h".
const formatHours = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
};

export function ContractPage() {
  const { profile } = useAuth();
  const { data: partner } = usePartner();
  const { data: contract, isLoading } = useWeeklyContract();
  const queryClient = useQueryClient();

  const [draftGoals, setDraftGoals] = useState<GoalDraft[]>([
    { subject: "", target_hours: 4, target_count: 0, unit: "hours" },
  ]);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const weekStart = getWeekStart();
  const weekEnd = getWeekEnd(weekStart);

  const myGoals =
    contract?.goals?.filter(
      (g: { user_id: string }) => g.user_id === profile?.id,
    ) ?? [];
  const partnerGoals =
    contract?.goals?.filter(
      (g: { user_id: string }) => g.user_id === profile?.partner_id,
    ) ?? [];

  const myAgreed =
    profile?.id === contract?.user_a
      ? contract?.user_a_agreed
      : contract?.user_b_agreed;
  const partnerAgreed =
    profile?.id === contract?.user_a
      ? contract?.user_b_agreed
      : contract?.user_a_agreed;

  // NEW: track whether each side has actually committed to goals.
  // A contract with an "agreed" flag but zero goals is not a valid contract.
  const myHasGoals = myGoals.length > 0;
  const partnerHasGoals = partnerGoals.length > 0;

  const calcCompletion = (
    goals: {
      completed_hours: number;
      target_hours: number;
      completed_count: number;
      target_count: number;
    }[],
  ) => {
    if (!goals.length) return 0;
    return (
      (goals.reduce((sum, g) => {
        const hPct =
          g.target_hours > 0 ? g.completed_hours / g.target_hours : 0;
        const cPct =
          g.target_count > 0 ? g.completed_count / g.target_count : 0;
        return sum + (hPct || cPct);
      }, 0) /
        goals.length) *
      100
    );
  };

  const myCompletion = calcCompletion(myGoals);
  const partnerCompletion = calcCompletion(partnerGoals);
  const bothAgreed = myAgreed && partnerAgreed;
  const locked = contract?.locked ?? false;
  const sundayEarned =
    contract?.sunday_earned ??
    (bothAgreed && myCompletion >= 100 && partnerCompletion >= 100);

  const addGoal = () =>
    setDraftGoals((g) => [
      ...g,
      { subject: "", target_hours: 4, target_count: 0, unit: "hours" },
    ]);
  const removeGoal = (i: number) =>
    setDraftGoals((g) => g.filter((_, idx) => idx !== i));
  const updateGoal = (i: number, patch: Partial<GoalDraft>) =>
    setDraftGoals((g) =>
      g.map((goal, idx) => (idx === i ? { ...goal, ...patch } : goal)),
    );

  // FIX: previously this function only handled the case where NO contract
  // existed yet — it always called dbCreateContract(). That meant once one
  // partner created the contract document, the other partner had no path
  // to add their own goals at all (the "creating" UI never reappeared
  // because `contract` was already truthy). Now it branches:
  //   - no contract yet -> create the document AND add my goals
  //   - contract exists, but I have no goals yet -> just add my goals to it
  const saveMyGoals = async () => {
    if (!profile || !partner) {
      toast.error("Link your partner first to create a contract.");
      return;
    }
    const valid = draftGoals.filter((g) => g.subject.trim());
    if (!valid.length) {
      toast.error("Add at least one study goal.");
      return;
    }
    setSaving(true);
    try {
      let contractId = contract?.id;

      if (!contractId) {
        const coupleId = getCoupleId(profile.id, partner.id);
        const newContract = await dbCreateContract({
          couple_id: coupleId,
          week_start: weekStart,
          week_end: weekEnd,
          user_a: profile.id,
          user_b: partner.id,
          user_a_agreed: false,
          user_b_agreed: false,
          locked: false,
          sunday_earned: null,
        });
        contractId = newContract.id;
      }

      const goalsToInsert = valid.map((g) => ({
        contract_id: contractId,
        user_id: profile.id,
        subject: g.subject.trim(),
        target_hours: g.unit === "hours" ? g.target_hours : 0,
        target_count: g.unit === "count" ? g.target_count : 0,
        unit: g.unit,
        completed_hours: 0,
        completed_count: 0,
      }));
      await addContractGoals(goalsToInsert);

      toast.success("Your goals are saved!");
      setCreating(false);
      setDraftGoals([
        { subject: "", target_hours: 4, target_count: 0, unit: "hours" },
      ]);
      queryClient.invalidateQueries({ queryKey: ["contract"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save your goals");
    }
    setSaving(false);
  };

  // FIX: block agreement until the agreeing user has at least one goal on the books.
  // This is the root cause of the bug you hit — previously either side could
  // press "I Agree" with zero goals, and once both flags were true the
  // useEffect below would lock the week with one side having nothing to track.
  const agree = async () => {
    if (!contract || !profile) return;
    if (!myHasGoals) {
      toast.error(
        "Add at least one study goal before you can agree to the contract.",
      );
      return;
    }
    const patch =
      profile.id === contract.user_a
        ? { user_a_agreed: true }
        : { user_b_agreed: true };
    try {
      await updateContract(contract.id, patch);
      toast.success("You agreed to the contract!");
      queryClient.invalidateQueries({ queryKey: ["contract"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to agree");
    }
  };

  const unagree = async () => {
    if (!contract || !profile) return;
    const patch =
      profile.id === contract.user_a
        ? { user_a_agreed: false }
        : { user_b_agreed: false };
    await updateContract(contract.id, patch);
    queryClient.invalidateQueries({ queryKey: ["contract"] });
  };

  const updateProgress = async (
    goalId: string,
    field: "completed_hours" | "completed_count",
    value: number,
  ) => {
    await updateContractGoal(goalId, { [field]: value });
    queryClient.invalidateQueries({ queryKey: ["contract"] });
  };

  // FIX: the auto-lock effect now also checks that BOTH sides have goals,
  // not just that both "agreed" flags are true. This is a second line of
  // defense in case a contract somehow reaches this state (e.g. legacy data,
  // or a future code path that sets the agreed flags directly).
  useEffect(() => {
    if (
      contract &&
      contract.user_a_agreed &&
      contract.user_b_agreed &&
      !contract.locked &&
      myHasGoals &&
      partnerHasGoals
    ) {
      updateContract(contract.id, { locked: true }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["contract"] });
      });
    }
  }, [contract, queryClient, myHasGoals, partnerHasGoals]);

  // NEW: recovery path for contracts that are ALREADY locked in the broken
  // state (your current contract). Unlock automatically so the missing
  // side can add goals and you can re-agree properly.
  useEffect(() => {
    if (contract && contract.locked && (!myHasGoals || !partnerHasGoals)) {
      updateContract(contract.id, {
        locked: false,
        user_a_agreed: false,
        user_b_agreed: false,
      }).then(() => {
        toast.error(
          "This contract was locked without both partners setting goals. It has been reopened.",
        );
        queryClient.invalidateQueries({ queryKey: ["contract"] });
      });
    }
    // Only run this recovery check once per contract id, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract?.id]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold">
            Weekly Contract
          </h1>
          <p className="text-sm text-muted">
            Week of{" "}
            {new Date(weekStart).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}{" "}
            —{" "}
            {new Date(weekEnd).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        {contract && !locked && !creating && (
          <Badge variant="warning">
            <span className="h-1.5 w-1.5 rounded-full bg-warning-500" />{" "}
            Awaiting agreement
          </Badge>
        )}
        {locked && (
          <Badge variant={sundayEarned ? "success" : "default"}>
            <Lock className="h-3 w-3" />{" "}
            {sundayEarned ? "Sunday Earned" : "Locked"}
          </Badge>
        )}
      </div>

      {/* NEW: warning banner if partner has no goals but hasn't locked yet (pre-lock state) */}
      {contract && !locked && !creating && !partnerHasGoals && (
        <Card className="flex items-center gap-3 border border-warning-500/30 bg-warning-500/10">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-warning-500" />
          <p className="text-sm">
            <span className="font-semibold">
              {partner?.name || "Your partner"}
            </span>{" "}
            hasn't added any study goals yet. They won't be able to agree to the
            contract until they do.
          </p>
        </Card>
      )}

      {/* Sunday Status */}
      {locked && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "relative overflow-hidden rounded-2xl p-6 text-center",
            sundayEarned
              ? "bg-gradient-to-br from-success-500/20 via-primary-500/15 to-accent-500/20 border border-success-500/30"
              : "bg-gradient-to-br from-ink-800 to-ink-700 border border-white/5",
          )}
        >
          {sundayEarned ? (
            <>
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-success-500/20"
              >
                <Heart className="h-8 w-8 text-success-500" />
              </motion.div>
              <h2 className="font-display text-2xl font-bold gradient-text">
                Sunday Earned
              </h2>
              <p className="mt-1 text-sm text-muted">
                You both kept your promises. Enjoy your day together.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-3xl">
                🔒
              </div>
              <h2 className="font-display text-2xl font-bold">Sunday Locked</h2>
              <p className="mt-1 text-sm text-muted">
                You completed {Math.round(myCompletion)}% · Partner completed{" "}
                {Math.round(partnerCompletion)}%
              </p>
              <p className="mt-2 text-xs text-muted">
                Finish your commitments next week to unlock your next Sunday.
              </p>
            </>
          )}
        </motion.div>
      )}

      {/* No contract yet, OR contract exists but I haven't added my goals yet */}
      {(!contract || (!locked && !myHasGoals)) && !creating && (
        <Card>
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title={
              contract
                ? "You haven't added your goals yet"
                : "No contract this week"
            }
            description={
              contract
                ? "Add your study goals for this week so you and your partner can both agree."
                : "Create your weekly study contract. Both partners must agree to lock it in."
            }
            action={
              partner ? (
                <button
                  onClick={() => setCreating(true)}
                  className="btn-primary flex items-center gap-2 px-5 py-2.5"
                >
                  <Plus className="h-4 w-4" />{" "}
                  {contract ? "Add Your Goals" : "Create Contract"}
                </button>
              ) : (
                <p className="text-sm text-muted">
                  Link your partner in Settings first.
                </p>
              )
            }
          />
        </Card>
      )}

      {/* Creating / adding own goals */}
      {creating && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Your Study Goals</h2>
            <button
              onClick={() => setCreating(false)}
              className="btn-ghost p-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-3">
            {draftGoals.map((goal, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-black/[0.02] p-3 dark:bg-white/[0.03]"
              >
                <input
                  value={goal.subject}
                  onChange={(e) => updateGoal(i, { subject: e.target.value })}
                  placeholder="Subject (e.g. DSA)"
                  className="input-field flex-1"
                />
                <select
                  value={goal.unit}
                  onChange={(e) => updateGoal(i, { unit: e.target.value })}
                  className="input-field w-28"
                >
                  <option value="hours">Hours</option>
                  <option value="count">Count</option>
                </select>
                {goal.unit === "hours" ? (
                  <input
                    type="number"
                    min="0"
                    value={goal.target_hours}
                    onChange={(e) =>
                      updateGoal(i, { target_hours: Number(e.target.value) })
                    }
                    className="input-field w-20"
                  />
                ) : (
                  <input
                    type="number"
                    min="0"
                    value={goal.target_count}
                    onChange={(e) =>
                      updateGoal(i, { target_count: Number(e.target.value) })
                    }
                    className="input-field w-20"
                  />
                )}
                <button
                  onClick={() => removeGoal(i)}
                  className="btn-ghost p-2.5 text-danger-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={addGoal}
              className="btn-ghost flex items-center gap-2 px-4 py-2.5"
            >
              <Plus className="h-4 w-4" /> Add Goal
            </button>
            <button
              onClick={saveMyGoals}
              disabled={saving}
              className="btn-primary flex-1 py-2.5 disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : contract
                  ? "Save Your Goals"
                  : "Create Contract"}
            </button>
          </div>
        </Card>
      )}

      {/* Contract View — only once I have my own goals in place */}
      {contract && !creating && myHasGoals && (
        <>
          {/* Agreement Bar */}
          {!locked && (
            <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full",
                    myAgreed
                      ? "bg-success-500/20 text-success-500"
                      : "bg-black/5 dark:bg-white/5 text-muted",
                  )}
                >
                  {myAgreed ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <X className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    You {myAgreed ? "agreed" : "haven't agreed"}
                  </p>
                  <p className="text-xs text-muted">
                    Partner {partnerAgreed ? "agreed" : "hasn't agreed yet"}
                  </p>
                </div>
              </div>
              {myAgreed ? (
                <button
                  onClick={unagree}
                  className="btn-ghost px-5 py-2.5 text-sm"
                >
                  Withdraw Agreement
                </button>
              ) : (
                <button
                  onClick={agree}
                  disabled={!myHasGoals}
                  title={
                    !myHasGoals ? "Add at least one goal first" : undefined
                  }
                  className="btn-primary flex items-center gap-2 px-5 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> I Agree
                </button>
              )}
            </Card>
          )}

          {/* Goals Grid */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* My Goals */}
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-warm text-xs font-bold text-white">
                    {initials(profile?.name || "Y")}
                  </div>
                  <h2 className="font-display font-bold">Your Goals</h2>
                </div>
                <Badge variant={myCompletion >= 100 ? "success" : "primary"}>
                  {Math.round(myCompletion)}%
                </Badge>
              </div>
              <ProgressBar value={myCompletion} className="mb-4" />
              <div className="space-y-3">
                {myGoals.length === 0 && (
                  <p className="text-sm text-muted">No goals set.</p>
                )}
                {myGoals.map(
                  (goal: {
                    id: string;
                    subject: string;
                    target_hours: number;
                    target_count: number;
                    unit: string;
                    completed_hours: number;
                    completed_count: number;
                  }) => {
                    const pct =
                      goal.target_hours > 0
                        ? (goal.completed_hours / goal.target_hours) * 100
                        : (goal.completed_count / goal.target_count) * 100;
                    return (
                      <div
                        key={goal.id}
                        className="rounded-xl bg-black/[0.02] p-3 dark:bg-white/[0.03]"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-medium">{goal.subject}</span>
                          <span className="text-xs text-muted">
                            {goal.target_hours > 0
                              ? `${formatHours(goal.completed_hours)}/${formatHours(goal.target_hours)}h`
                              : `${goal.completed_count}/${goal.target_count}`}
                          </span>
                        </div>
                        <ProgressBar value={pct} className="mb-2" />
                        {!locked && (
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted">
                              Update:
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              defaultValue={
                                goal.target_hours > 0
                                  ? goal.completed_hours
                                  : goal.completed_count
                              }
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                updateProgress(
                                  goal.id,
                                  goal.target_hours > 0
                                    ? "completed_hours"
                                    : "completed_count",
                                  v,
                                );
                              }}
                              className="input-field w-20 py-1.5 text-sm"
                            />
                            <span className="text-xs text-muted">
                              {goal.unit === "hours" ? "hrs" : "done"}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            </Card>

            {/* Partner Goals */}
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-warm text-xs font-bold text-white">
                    {initials(partner?.name || "P")}
                  </div>
                  <h2 className="font-display font-bold">
                    {partner?.name || "Partner"}'s Goals
                  </h2>
                </div>
                <Badge
                  variant={partnerCompletion >= 100 ? "success" : "primary"}
                >
                  {Math.round(partnerCompletion)}%
                </Badge>
              </div>
              <ProgressBar value={partnerCompletion} className="mb-4" />
              <div className="space-y-3">
                {partnerGoals.length === 0 && (
                  <p className="text-sm text-muted">
                    {locked
                      ? "Partner locked this contract without setting goals — it will reopen automatically."
                      : "No goals set yet."}
                  </p>
                )}
                {partnerGoals.map(
                  (goal: {
                    id: string;
                    subject: string;
                    target_hours: number;
                    target_count: number;
                    completed_hours: number;
                    completed_count: number;
                  }) => {
                    const pct =
                      goal.target_hours > 0
                        ? (goal.completed_hours / goal.target_hours) * 100
                        : (goal.completed_count / goal.target_count) * 100;
                    return (
                      <div
                        key={goal.id}
                        className="rounded-xl bg-black/[0.02] p-3 dark:bg-white/[0.03]"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-medium">{goal.subject}</span>
                          <span className="text-xs text-muted">
                            {goal.target_hours > 0
                              ? `${formatHours(goal.completed_hours)}/${formatHours(goal.target_hours)}h`
                              : `${goal.completed_count}/${goal.target_count}`}
                          </span>
                        </div>
                        <ProgressBar value={pct} />
                      </div>
                    );
                  },
                )}
              </div>
            </Card>
          </div>

          {/* Philosophy */}
          <Card className="flex items-center gap-3 bg-gradient-warm-soft">
            <Sparkles className="h-5 w-5 text-primary-500" />
            <p className="text-sm font-medium italic">
              "You don't earn your Sunday by waiting for it. You earn it by
              keeping your promises."
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
