import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Send, MessageCircle, Activity, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { usePartner, useActivityFeed, useDailyLetter } from "../lib/hooks";
import { addDailyLetter } from "../lib/db";
import { Card, EmptyState } from "../components/ui";
import { initials, cn } from "../lib/utils";

const ACTIVITY_ICONS: Record<string, { icon: typeof Heart; color: string }> = {
  session: { icon: Clock, color: "text-primary-500 bg-primary-500/10" },
  letter: { icon: Heart, color: "text-accent-500 bg-accent-500/10" },
  goal: { icon: Activity, color: "text-success-500 bg-success-500/10" },
  default: { icon: Activity, color: "text-warning-500 bg-warning-500/10" },
};

export function PartnerPage() {
  const { profile } = useAuth();
  const { data: partner } = usePartner();
  const { data: activity } = useActivityFeed(50);
  const { data: letters } = useDailyLetter();
  const queryClient = useQueryClient();
  const [letter, setLetter] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const myLetterToday = letters?.find((l) => l.sender_id === profile?.id);
  const partnerLetterToday = letters?.find(
    (l) => l.sender_id === profile?.partner_id,
  );

  // FIX: useActivityFeed(50) fetches the most recent 50 items with no date
  // filter at all (the underlying getActivityFeed query only does
  // orderBy('created_at', 'desc') + limit(50)) — so without this filter,
  // the feed shows your entire history up to 50 items, not just today.
  // Filtering client-side here is the minimal fix without touching the
  // hook/db layer. Note: if both partners generate more than 50 combined
  // activity items in a single day, this could theoretically miss older
  // same-day items that fell outside the fetched 50 — fine for normal use,
  // but worth knowing if activity volume ever gets that high.
  const todaysActivity = activity?.filter((item) => {
    const itemDate = new Date(item.created_at).toISOString().split("T")[0];
    return itemDate === today;
  });

  const sendLetter = async () => {
    if (!profile || !partner) return;
    if (!letter.trim()) return;
    if (letter.length > 200) {
      toast.error("Keep it under 200 characters.");
      return;
    }
    try {
      await addDailyLetter({
        sender_id: profile.id,
        recipient_id: partner.id,
        content: letter.trim(),
        date: today,
      });
      toast.success("Letter sent!");
      setLetter("");
      queryClient.invalidateQueries({ queryKey: ["letter"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send letter");
    }
  };

  if (!partner) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-extrabold">Partner</h1>
        <Card>
          <EmptyState
            icon={<Heart className="h-8 w-8" />}
            title="No partner linked"
            description="Link your partner using their invite code to share progress, letters, and activity."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Partner</h1>
        <p className="text-sm text-muted">
          Your shared journey, one day at a time.
        </p>
      </div>

      {/* Partner Header */}
      <Card className="flex items-center gap-4">
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-warm text-xl font-bold text-white">
            {initials(partner.name || partner.email)}
          </div>
          <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white bg-success-500 dark:border-ink-800" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-lg font-bold">
            {partner.name || "Partner"}
          </h2>
          <p className="text-sm text-muted">
            {partner.exam_name ?? "No exam set"}
          </p>
        </div>
      </Card>

      {/* Daily Letter */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 text-accent-500">
            <MessageCircle className="h-4 w-4" />
          </div>
          <h2 className="font-display font-bold">Daily Motivation Letter</h2>
        </div>

        {/* Partner's letter to me */}
        {partnerLetterToday ? (
          <div className="mb-4 rounded-xl bg-gradient-warm-soft p-4">
            <p className="mb-1 text-xs font-semibold text-primary-500">
              {partner.name || "Partner"} wrote:
            </p>
            <p className="text-sm italic">"{partnerLetterToday.content}"</p>
          </div>
        ) : (
          <p className="mb-4 text-sm text-muted">
            Your partner hasn't sent a letter today.
          </p>
        )}

        {/* My letter */}
        {myLetterToday ? (
          <div className="rounded-xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
            <p className="mb-1 text-xs font-semibold text-muted">You sent:</p>
            <p className="text-sm italic">"{myLetterToday.content}"</p>
            <p className="mt-2 text-xs text-muted">
              Come back tomorrow to send another.
            </p>
          </div>
        ) : (
          <div>
            <textarea
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
              placeholder="Write one encouraging message (max 200 chars)..."
              maxLength={200}
              rows={3}
              className="input-field resize-none"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted">{letter.length}/200</span>
              <button
                onClick={sendLetter}
                disabled={!letter.trim()}
                className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> Send Letter
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Activity Feed — today only */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
            <Activity className="h-4 w-4" />
          </div>
          <h2 className="font-display font-bold">Today's Activity</h2>
        </div>

        {todaysActivity && todaysActivity.length > 0 ? (
          <div className="space-y-3">
            {todaysActivity.map((item, i) => {
              const isMe = item.user_id === profile?.id;
              const actor = isMe ? profile : partner;
              const config =
                ACTIVITY_ICONS[item.type] ?? ACTIVITY_ICONS.default;
              const Icon = config.icon;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3"
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      config.color,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 border-b border-black/5 pb-3 dark:border-white/5">
                    <p className="text-sm">
                      <span className="font-semibold">
                        {isMe ? "You" : actor?.name || "Partner"}
                      </span>{" "}
                      {item.message}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {new Date(item.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted">
            No activity yet today. Start a study session!
          </p>
        )}
      </Card>
    </div>
  );
}
