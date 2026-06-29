import { motion } from 'framer-motion';
import { Trophy, Flame, Target, Heart, Star, Award, Zap, Calendar, BookOpen, Crown } from 'lucide-react';
import { useAchievements } from '../lib/hooks';
import { Card } from '../components/ui';
import { cn } from '../lib/utils';

const ACHIEVEMENTS = [
  { key: 'first_session', name: 'First Step', desc: 'Complete your first study session', icon: BookOpen, color: 'from-primary-500 to-accent-500' },
  { key: '30_sessions', name: 'Dedicated', desc: 'Complete 30 study sessions', icon: Target, color: 'from-accent-500 to-primary-600' },
  { key: '100_hours', name: 'Century', desc: 'Study for 100 total hours', icon: Star, color: 'from-warning-500 to-primary-500' },
  { key: '500_hours', name: 'Master', desc: 'Study for 500 total hours', icon: Crown, color: 'from-primary-600 to-accent-600' },
  { key: '30_streak', name: 'Unbreakable', desc: '30-day study streak', icon: Flame, color: 'from-accent-500 to-warning-500' },
  { key: 'perfect_week', name: 'Perfect Week', desc: 'Complete all weekly goals', icon: Trophy, color: 'from-success-500 to-primary-500' },
  { key: 'perfect_month', name: 'Perfect Month', desc: '4 perfect weeks in a row', icon: Award, color: 'from-primary-500 to-success-500' },
  { key: 'sunday_10', name: 'Sunday Earned x10', desc: 'Earn 10 Sundays together', icon: Heart, color: 'from-accent-500 to-accent-600' },
  { key: 'consistency_master', name: 'Consistency Master', desc: '80%+ consistency for 30 days', icon: Zap, color: 'from-warning-500 to-accent-500' },
  { key: 'never_missed', name: 'Never Missed', desc: 'Study every day for a week', icon: Calendar, color: 'from-success-500 to-accent-500' },
];

export function AchievementsPage() {
  const { data: unlocked } = useAchievements();
  const unlockedKeys = new Set((unlocked ?? []).map((a) => a.key));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Achievements</h1>
        <p className="text-sm text-muted">
          {unlockedKeys.size} of {ACHIEVEMENTS.length} unlocked
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((ach, i) => {
          const isUnlocked = unlockedKeys.has(ach.key);
          const Icon = ach.icon;
          return (
            <motion.div
              key={ach.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className={cn('relative overflow-hidden', !isUnlocked && 'opacity-60')}>
                {isUnlocked && (
                  <div className={cn('absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br opacity-20 blur-2xl', ach.color)} />
                )}
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-2xl transition-all',
                    isUnlocked
                      ? `bg-gradient-to-br ${ach.color} text-white shadow-lg`
                      : 'bg-black/5 text-muted dark:bg-white/5'
                  )}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-display font-bold">{ach.name}</p>
                    <p className="text-xs text-muted">{ach.desc}</p>
                    {isUnlocked && (
                      <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-success-500">
                        <Trophy className="h-3 w-3" /> Unlocked
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
