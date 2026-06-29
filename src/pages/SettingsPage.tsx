import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sun, Moon, Monitor, Bell, Timer, Clock, Link2, Copy,
  Download, UserX, LogOut, Check, Camera,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/auth';
import { useSettings } from '../lib/settings';
import { getProfileByInviteCode, linkPartners, unlinkPartners, deleteProfile, exportUserData } from '../lib/db';
import { Card } from '../components/ui';
import { cn } from '../lib/utils';

function SettingRow({
  icon: Icon, label, desc, children,
}: {
  icon: typeof Sun; label: string; desc: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-black/5 py-4 last:border-0 dark:border-white/5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/5 dark:bg-white/5">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function SettingsPage() {
  const { profile, signOut, updateProfile, updateAvatar, user } = useAuth();
  const navigate = useNavigate();
  const settings = useSettings();
  const [partnerCode, setPartnerCode] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarUrl = profile?.avatar_url ?? user?.photoURL ?? null;

  const themes = [
    { key: 'dark' as const, icon: Moon, label: 'Dark' },
    { key: 'light' as const, icon: Sun, label: 'Light' },
    { key: 'system' as const, icon: Monitor, label: 'System' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const linkPartner = async () => {
    if (!partnerCode.trim() || !profile) return;
    const partner = await getProfileByInviteCode(partnerCode.trim());
    if (!partner) {
      toast.error('No partner found with that code');
      return;
    }
    await linkPartners(profile.id, partner.id);
    toast.success('Partner linked!');
    setPartnerCode('');
    window.location.reload();
  };

  const unlinkPartner = async () => {
    if (!profile?.partner_id) return;
    await unlinkPartners(profile.id, profile.partner_id);
    toast.success('Partner unlinked');
    window.location.reload();
  };

  const exportData = async () => {
    if (!profile) return;
    const data = await exportUserData(profile.id);
    const blob = new Blob([JSON.stringify({ profile, ...data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bondandbeyond-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported');
  };

  const deleteAccount = async () => {
    if (!confirm('Are you sure? This will sign you out. Your auth account remains — contact support to fully delete.')) return;
    if (profile) {
      await deleteProfile(profile.id);
    }
    await signOut();
    navigate('/login');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Settings</h1>
        <p className="text-sm text-muted">Customize your Bond&Beyond experience.</p>
      </div>

      {/* Theme */}
      <Card>
        <h2 className="mb-2 font-display font-bold">Appearance</h2>
        <div className="grid grid-cols-3 gap-2">
          {themes.map((t) => (
            <button
              key={t.key}
              onClick={() => settings.setTheme(t.key)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border p-4 transition-all',
                settings.theme === t.key
                  ? 'border-primary-500 bg-primary-500/5'
                  : 'border-black/5 hover:border-primary-500/30 dark:border-white/5'
              )}
            >
              <t.icon className={cn('h-5 w-5', settings.theme === t.key ? 'text-primary-500' : 'text-muted')} />
              <span className="text-sm font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Notifications */}
      <Card>
        <h2 className="mb-2 font-display font-bold">Notifications</h2>
        <SettingRow icon={Bell} label="Push Notifications" desc="Study reminders and partner updates">
          <button
            onClick={() => settings.setNotificationsEnabled(!settings.notificationsEnabled)}
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors',
              settings.notificationsEnabled ? 'bg-primary-500' : 'bg-black/10 dark:bg-white/10'
            )}
          >
            <motion.span
              layout
              className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow', settings.notificationsEnabled ? 'left-5' : 'left-0.5')}
            />
          </button>
        </SettingRow>
        <SettingRow icon={Clock} label="Morning Reminder" desc="Start your day with intention">
          <input
            type="time"
            value={settings.morningReminder}
            onChange={(e) => settings.setMorningReminder(e.target.value)}
            className="input-field w-28 py-1.5"
          />
        </SettingRow>
        <SettingRow icon={Clock} label="Evening Reminder" desc="Check in before bed">
          <input
            type="time"
            value={settings.eveningReminder}
            onChange={(e) => settings.setEveningReminder(e.target.value)}
            className="input-field w-28 py-1.5"
          />
        </SettingRow>
      </Card>

      {/* Pomodoro */}
      <Card>
        <h2 className="mb-2 font-display font-bold">Pomodoro Preferences</h2>
        <SettingRow icon={Timer} label="Default Mode" desc="Your preferred focus/break ratio">
          <select
            value={settings.pomodoroMode}
            onChange={(e) => settings.setPomodoroMode(e.target.value)}
            className="input-field w-28 py-1.5"
          >
            <option value="25/5">25 / 5</option>
            <option value="50/10">50 / 10</option>
            <option value="90/20">90 / 20</option>
          </select>
        </SettingRow>
      </Card>

      {/* Partner Management */}
      <Card>
        <h2 className="mb-2 font-display font-bold">Partner Management</h2>
        <div className="rounded-xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Your Invite Code</p>
          <div className="flex items-center justify-between">
            <code className="font-mono text-xl font-bold tracking-widest gradient-text">{profile?.invite_code}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(profile?.invite_code ?? '');
                toast.success('Copied!');
              }}
              className="btn-ghost p-2"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>

        {profile?.partner_id ? (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-success-500/10 p-4">
            <div className="flex items-center gap-2 text-sm text-success-500">
              <Check className="h-4 w-4" /> Partner linked
            </div>
            <button onClick={unlinkPartner} className="btn-ghost px-4 py-2 text-sm text-danger-500">
              Unlink
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium">Link Partner</label>
            <div className="flex gap-2">
              <input
                value={partnerCode}
                onChange={(e) => setPartnerCode(e.target.value)}
                placeholder="Enter invite code"
                className="input-field font-mono uppercase"
                maxLength={8}
              />
              <button onClick={linkPartner} className="btn-primary px-4">
                <Link2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Profile Edit */}
      <Card>
        <h2 className="mb-2 font-display font-bold">Profile</h2>
        <div className="mb-4 flex items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 overflow-hidden rounded-full bg-gradient-warm">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-bold text-white">
                  {(profile?.name || user?.email || 'U')[0].toUpperCase()}
                </div>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg disabled:opacity-50"
            >
              <Camera className="h-3 w-3" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploadingAvatar(true);
                const { error } = await updateAvatar(file);
                setUploadingAvatar(false);
                if (error) toast.error(error);
                else toast.success('Avatar updated!');
              }}
            />
          </div>
          <div>
            <p className="text-sm font-medium">{profile?.name || 'User'}</p>
            <p className="text-xs text-muted">{profile?.email}</p>
            {uploadingAvatar && <p className="text-xs text-primary-500">Uploading...</p>}
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input
              defaultValue={profile?.name}
              onBlur={(e) => updateProfile({ name: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Exam Name</label>
            <input
              defaultValue={profile?.exam_name ?? ''}
              onBlur={(e) => updateProfile({ exam_name: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Exam Date</label>
            <input
              type="date"
              defaultValue={profile?.exam_date ?? ''}
              onBlur={(e) => updateProfile({ exam_date: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Daily Goal (hrs)</label>
              <input
                type="number"
                defaultValue={profile?.daily_study_goal ?? 4}
                onBlur={(e) => updateProfile({ daily_study_goal: Number(e.target.value) })}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Weekly Goal (hrs)</label>
              <input
                type="number"
                defaultValue={profile?.weekly_study_goal ?? 28}
                onBlur={(e) => updateProfile({ weekly_study_goal: Number(e.target.value) })}
                className="input-field"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Data & Account */}
      <Card>
        <h2 className="mb-2 font-display font-bold">Data & Account</h2>
        <SettingRow icon={Download} label="Export Study Data" desc="Download all your data as JSON">
          <button onClick={exportData} className="btn-ghost px-4 py-2 text-sm">
            Export
          </button>
        </SettingRow>
        <SettingRow icon={LogOut} label="Sign Out" desc="Sign out of your account">
          <button onClick={handleSignOut} className="btn-ghost px-4 py-2 text-sm">
            Sign Out
          </button>
        </SettingRow>
        <SettingRow icon={UserX} label="Delete Account" desc="Remove your profile data">
          <button onClick={deleteAccount} className="btn-ghost px-4 py-2 text-sm text-danger-500">
            Delete
          </button>
        </SettingRow>
      </Card>

      <p className="pb-4 text-center text-xs text-muted">
        Bond&Beyond — Beyond Love. Beyond Distance. Beyond Excuses.
      </p>
    </div>
  );
}
