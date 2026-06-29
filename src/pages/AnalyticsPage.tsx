import { useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { TrendingUp, Clock, Target, Zap, Award, Lightbulb } from "lucide-react";
import { useStudySessions, useDailyProgress } from "../lib/hooks";
import { Card } from "../components/ui";

const COLORS = [
  "#F97316",
  "#E11D48",
  "#10B981",
  "#F59E0B",
  "#3B82F6",
  "#8B5CF6",
];

export function AnalyticsPage() {
  const { data: sessions } = useStudySessions(90);
  const { data: progress } = useDailyProgress(365);

  // Daily hours last 14 days
  const dailyData = useMemo(() => {
    const days: { date: string; hours: number; label: string }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const p = progress?.find((pr) => pr.date === dateStr);
      days.push({
        date: dateStr,
        hours: p?.hours_studied ?? 0,
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
      });
    }
    return days;
  }, [progress]);

  // Weekly progress, last 8 calendar weeks (Sunday-start, matching
  // lib/utils.ts getWeekStart() — same week boundary the Sunday banner and
  // weekly contract use, so "this week" means the same thing everywhere).
  //
  // FIX: the previous version built weekStart/weekEnd from `new Date()`
  // with no time-of-day reset, so each rolling 7-day window was anchored to
  // the exact moment the component rendered rather than midnight. That
  // created a gap between consecutive windows roughly the size of "time
  // elapsed since midnight" — a session logged earlier today could fall
  // after the end of last week's window and before the start of this
  // week's window, matching neither and vanishing from the chart entirely.
  // That's why 11 real sessions produced an empty Weekly Progress bar.
  const weeklyData = useMemo(() => {
    const weeks: { week: string; hours: number }[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayDow = now.getDay(); // 0 = Sun
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - todayDow);

    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(thisWeekStart);
      weekStart.setDate(thisWeekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7); // exclusive upper bound

      const weekHours =
        (sessions ?? [])
          .filter((s) => {
            const d = new Date(s.started_at);
            return d >= weekStart && d < weekEnd;
          })
          .reduce((sum, s) => sum + s.duration_minutes, 0) / 60;
      weeks.push({
        week: `W${8 - i}`,
        hours: Math.round(weekHours * 10) / 10,
      });
    }
    return weeks;
  }, [sessions]);

  // Subject distribution
  const subjectData = useMemo(() => {
    const map = new Map<string, number>();
    (sessions ?? []).forEach((s) => {
      const subj = s.subject || "Unspecified";
      map.set(subj, (map.get(subj) ?? 0) + s.duration_minutes / 60);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [sessions]);

  // Stats
  const totalHours =
    (sessions ?? []).reduce((s, sess) => s + sess.duration_minutes, 0) / 60;
  const avgSessionLen = sessions?.length
    ? (totalHours / sessions.length) * 60
    : 0;
  const consistencyScore = progress?.length
    ? Math.round(
        (progress.filter((p) => p.hours_studied > 0).length / progress.length) *
          100,
      )
    : 0;

  // AI-style insights
  const insights = useMemo(() => {
    const tips: { icon: string; text: string }[] = [];
    // Best time
    const hourMap = new Map<number, number>();
    (sessions ?? []).forEach((s) => {
      const h = new Date(s.started_at).getHours();
      hourMap.set(h, (hourMap.get(h) ?? 0) + s.duration_minutes);
    });
    if (hourMap.size > 0) {
      const bestHour = Array.from(hourMap.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0][0];
      tips.push({
        icon: "clock",
        text: `You focus best around ${bestHour}:00 — ${bestHour < 12 ? "morning" : bestHour < 17 ? "afternoon" : "evening"} sessions are your strongest.`,
      });
    }
    // Weakest day
    const dayMap = new Map<number, number>();
    (sessions ?? []).forEach((s) => {
      const d = new Date(s.started_at).getDay();
      dayMap.set(d, (dayMap.get(d) ?? 0) + s.duration_minutes);
    });
    if (dayMap.size > 0) {
      const worstDay = Array.from(dayMap.entries()).sort(
        (a, b) => a[1] - b[1],
      )[0][0];
      const dayName = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ][worstDay];
      tips.push({
        icon: "alert",
        text: `You study least on ${dayName}s. Try scheduling a lighter session to maintain momentum.`,
      });
    }
    // Subject
    if (subjectData.length > 1) {
      const weakest = subjectData[subjectData.length - 1];
      const strongest = subjectData[0];
      tips.push({
        icon: "brain",
        text: `${strongest.name} is your strongest subject. ${weakest.name} needs more attention.`,
      });
    }
    // Consistency
    if (consistencyScore >= 70) {
      tips.push({
        icon: "zap",
        text: `Your consistency score is ${consistencyScore}%. You're building a powerful habit.`,
      });
    } else if (consistencyScore < 40) {
      tips.push({
        icon: "zap",
        text: `Your consistency is ${consistencyScore}%. Small daily sessions will compound fast.`,
      });
    }
    return tips;
  }, [sessions, subjectData, consistencyScore]);

  // Heatmap data
  const heatmapData = useMemo(() => {
    const map = new Map<string, number>();
    (progress ?? []).forEach((p) => {
      map.set(p.date, p.hours_studied);
    });
    return map;
  }, [progress]);

  const today = new Date();
  const heatStart = new Date(today);
  heatStart.setDate(heatStart.getDate() - 364);
  // Align to Sunday
  heatStart.setDate(heatStart.getDate() - heatStart.getDay());

  const heatWeeks: { date: string; hours: number }[][] = [];
  const cursor = new Date(heatStart);
  while (cursor <= today) {
    const week: { date: string; hours: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = cursor.toISOString().split("T")[0];
      week.push({ date: dateStr, hours: heatmapData.get(dateStr) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    heatWeeks.push(week);
  }

  const heatColor = (hours: number) => {
    if (hours === 0) return "bg-black/5 dark:bg-white/5";
    if (hours < 2) return "bg-danger-500/40";
    if (hours < 4) return "bg-warning-500/50";
    return "bg-success-500/60";
  };

  const radialData = [
    { name: "Consistency", value: consistencyScore, fill: "#F97316" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Analytics</h1>
        <p className="text-sm text-muted">
          Track your journey. Understand your patterns.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted">Total Hours</p>
            <p className="font-display text-xl font-bold">
              {totalHours.toFixed(1)}h
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500/10 text-accent-500">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted">Avg Session</p>
            <p className="font-display text-xl font-bold">
              {avgSessionLen.toFixed(0)} min
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success-500/10 text-success-500">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted">Consistency</p>
            <p className="font-display text-xl font-bold">
              {consistencyScore}%
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning-500/10 text-warning-500">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted">Sessions</p>
            <p className="font-display text-xl font-bold">
              {sessions?.length ?? 0}
            </p>
          </div>
        </Card>
      </div>

      {/* Charts */}
      {/*
        FIX (mobile overflow): each chart card sat in a `grid lg:grid-cols-2`
        with no `min-width: 0` on the cards. CSS grid items default to
        `min-width: auto`, which lets a wide child (Recharts'
        ResponsiveContainer + its rendered SVG) force the column past the
        viewport instead of shrinking to fit — exactly the W1...W8 chart
        bleeding off the right edge in the screenshot. `min-w-0` on each
        card is the actual fix; `overflow-hidden` is a backstop in case any
        chart internals (axis labels, tooltips) still try to render wider
        than the card.
      */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0 overflow-hidden">
          <h2 className="mb-4 font-display font-bold">Daily Study Hours</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(128,128,128,0.1)"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                stroke="rgba(128,128,128,0.5)"
              />
              <YAxis tick={{ fontSize: 11 }} stroke="rgba(128,128,128,0.5)" />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="hours"
                stroke="#F97316"
                strokeWidth={2}
                fill="url(#hoursGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <h2 className="mb-4 font-display font-bold">Weekly Progress</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(128,128,128,0.1)"
              />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11 }}
                stroke="rgba(128,128,128,0.5)"
              />
              <YAxis tick={{ fontSize: 11 }} stroke="rgba(128,128,128,0.5)" />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                {weeklyData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <h2 className="mb-4 font-display font-bold">Subject Distribution</h2>
          {subjectData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={subjectData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                >
                  {subjectData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted">
              No subject data yet.
            </div>
          )}
          {subjectData.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {subjectData.map((s, i) => (
                <span
                  key={s.name}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  {s.name}
                </span>
              ))}
            </div>
          )}
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <h2 className="mb-4 font-display font-bold">Consistency Score</h2>

          <div className="relative h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                data={radialData}
                innerRadius="70%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar
                  dataKey="value"
                  cornerRadius={10}
                  fill="#F97316"
                  background={{ fill: "rgba(128,128,128,0.1)" }}
                />
              </RadialBarChart>
            </ResponsiveContainer>

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="font-display text-3xl font-bold">
                {consistencyScore}%
              </p>
              <p className="text-xs text-muted">days studied</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Heatmap */}
      <Card className="min-w-0 overflow-hidden">
        <h2 className="mb-4 font-display font-bold">Study Heatmap</h2>
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex gap-1">
            {heatWeeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.hours.toFixed(1)}h`}
                    className={`h-3 w-3 rounded-sm ${heatColor(day.hours)}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          <span>Less</span>
          <div className="h-3 w-3 rounded-sm bg-black/5 dark:bg-white/5" />
          <div className="h-3 w-3 rounded-sm bg-danger-500/40" />
          <div className="h-3 w-3 rounded-sm bg-warning-500/50" />
          <div className="h-3 w-3 rounded-sm bg-success-500/60" />
          <span>More</span>
        </div>
      </Card>

      {/* AI Insights */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
            <Lightbulb className="h-4 w-4" />
          </div>
          <h2 className="font-display font-bold">AI Insights</h2>
        </div>
        <div className="space-y-3">
          {insights.length > 0 ? (
            insights.map((tip, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl bg-black/[0.02] p-3 dark:bg-white/[0.03]"
              >
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                <p className="text-sm">{tip.text}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">
              Complete a few study sessions to unlock personalized insights.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
