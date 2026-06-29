import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Link2,
  Copy,
  Camera,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../lib/auth";
import { getProfileByInviteCode, linkPartners } from "../lib/db";
import { AnimatedBackground } from "../components/AnimatedBackground";
import { Logo } from "../components/Logo";

const STEPS = ["Profile", "Exam", "Goals", "Partner"];

export function OnboardingPage() {
  const { profile, updateProfile, refreshProfile, updateAvatar, user } =
    useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [partnerCode, setPartnerCode] = useState("");

  // FIX: name and avatar now come straight from the Google account
  // (user.displayName / user.photoURL via Firebase Auth), not a manual
  // form field. Gender and DOB are dropped entirely — Google Sign-In via
  // Firebase only ever exposes displayName, email, photoURL, and
  // emailVerified. Gender and birthdate are NOT part of that data and
  // can't be "fetched from Google" no matter how this form is built —
  // there's no OAuth scope a consumer app can request for them. If you
  // need gender for something later, it would have to go back to being a
  // self-reported field, not an auto-fetched one.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    profile?.avatar_url ?? user?.photoURL ?? null,
  );
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Name auto-fills from the Google account's displayName. Falls back to
  // the part of the email before the @ if displayName is missing (e.g.
  // email/password sign-ups have no displayName at all), so the field is
  // never blank — but it's still editable in case the person wants to
  // change how their name appears in the app.
  const fallbackName =
    profile?.name ||
    user?.displayName ||
    (user?.email ? user.email.split("@")[0] : "");

  const [form, setForm] = useState({
    name: fallbackName,
    occupation: profile?.occupation ?? "",
    is_working_professional: profile?.is_working_professional ?? false,
    exam_name: profile?.exam_name ?? "",
    exam_date: profile?.exam_date ?? "",
    daily_study_goal: profile?.daily_study_goal ?? 4,
    weekly_study_goal: profile?.weekly_study_goal ?? 28,
    preferred_study_time: profile?.preferred_study_time ?? "evening",
    timezone:
      profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const finish = async () => {
    setLoading(true);
    // Persist the Google avatar URL too, in case the profile record
    // doesn't have one yet and the person never manually uploaded one.
    const { error } = await updateProfile({
      ...form,
      avatar_url: avatarUrl,
      onboarding_complete: true,
    } as never);
    setLoading(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Profile complete!");
      navigate("/app");
    }
  };

  const linkPartner = async () => {
    if (!partnerCode.trim()) return;
    setLoading(true);
    try {
      const partner = await getProfileByInviteCode(partnerCode.trim());

      if (!partner) {
        toast.error("No partner found with that code");
        setLoading(false);
        return;
      }

      if (profile) {
        await linkPartners(profile.id, partner.id);
      }
      await refreshProfile();
      toast.success("Partner linked!");
      setLoading(false);
    } catch {
      toast.error("Failed to link partner");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8">
      <AnimatedBackground />
      <div className="relative z-10 mx-auto max-w-lg">
        <div className="mb-8 flex items-center justify-between">
          <Logo size="md" />
          <button
            onClick={() => navigate("/app")}
            className="text-sm text-muted hover:text-primary-500"
          >
            Skip for now
          </button>
        </div>

        {/* Stepper */}
        <div className="mb-8 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  i <= step
                    ? "bg-gradient-warm text-white"
                    : "bg-black/5 text-muted dark:bg-white/10"
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 rounded ${i < step ? "bg-primary-500" : "bg-black/5 dark:bg-white/10"}`}
                />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="card glass p-6 sm:p-8"
          >
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="font-display text-xl font-bold">
                  Tell us about you
                </h2>

                {/* Avatar — pulled from Google automatically. The camera
                    button still lets the person override it with their
                    own photo if they want something different. */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="h-20 w-20 overflow-hidden rounded-full bg-gradient-warm">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Avatar"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-white">
                          {(form.name || user?.email || "U")[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg disabled:opacity-50"
                    >
                      <Camera className="h-3.5 w-3.5" />
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
                        else {
                          setAvatarUrl(URL.createObjectURL(file));
                          toast.success("Avatar uploaded!");
                        }
                      }}
                    />
                  </div>
                  {uploadingAvatar && (
                    <p className="text-xs text-muted">Uploading...</p>
                  )}
                  {avatarUrl && avatarUrl === user?.photoURL && (
                    <p className="text-xs text-muted">
                      Using your Google profile photo
                    </p>
                  )}
                </div>

                {/* Name — auto-filled from Google, still editable in case
                    the person wants their app name to differ. */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Full Name
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Your name"
                    className="input-field"
                  />
                  {user?.displayName && (
                    <p className="mt-1 text-xs text-muted">
                      Pulled from your Google account — feel free to change it.
                    </p>
                  )}
                </div>

                {/* Occupation kept — not something Google exposes either
                    way, and not part of what was asked to be removed. */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Occupation
                  </label>
                  <input
                    value={form.occupation}
                    onChange={(e) => set("occupation", e.target.value)}
                    placeholder="e.g. Software Engineer"
                    className="input-field"
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_working_professional}
                    onChange={(e) =>
                      set("is_working_professional", e.target.checked)
                    }
                    className="h-4 w-4 rounded accent-primary-500"
                  />
                  <span className="text-sm">I'm a working professional</span>
                </label>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h2 className="font-display text-xl font-bold">
                  Your exam target
                </h2>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Exam Name
                  </label>
                  <input
                    value={form.exam_name}
                    onChange={(e) => set("exam_name", e.target.value)}
                    placeholder="e.g. GATE, NET, UPSC"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Exam Date
                  </label>
                  <input
                    type="date"
                    value={form.exam_date}
                    onChange={(e) => set("exam_date", e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Timezone
                  </label>
                  <input
                    value={form.timezone}
                    onChange={(e) => set("timezone", e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-display text-xl font-bold">
                  Your study goals
                </h2>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Daily Study Goal (hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="16"
                    value={form.daily_study_goal}
                    onChange={(e) =>
                      set("daily_study_goal", Number(e.target.value))
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Weekly Study Goal (hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="80"
                    value={form.weekly_study_goal}
                    onChange={(e) =>
                      set("weekly_study_goal", Number(e.target.value))
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Preferred Study Time
                  </label>
                  <select
                    value={form.preferred_study_time}
                    onChange={(e) =>
                      set("preferred_study_time", e.target.value)
                    }
                    className="input-field"
                  >
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                    <option value="night">Night</option>
                  </select>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <h2 className="font-display text-xl font-bold">
                  Connect with your partner
                </h2>
                <p className="text-sm text-muted">
                  Share your invite code with your partner, or enter theirs to
                  link up.
                </p>

                <div className="rounded-2xl border border-dashed border-primary-500/30 bg-primary-500/5 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                    Your Invite Code
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <code className="font-mono text-2xl font-bold tracking-widest gradient-text">
                      {profile?.invite_code ?? "--------"}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          profile?.invite_code ?? "",
                        );
                        toast.success("Copied!");
                      }}
                      className="btn-ghost px-3 py-2"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Partner's Invite Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={partnerCode}
                      onChange={(e) => setPartnerCode(e.target.value)}
                      placeholder="Enter 8-char code"
                      className="input-field font-mono uppercase"
                      maxLength={8}
                    />
                    <button
                      onClick={linkPartner}
                      disabled={loading}
                      className="btn-primary px-4 disabled:opacity-50"
                    >
                      <Link2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {profile?.partner_id && (
                  <div className="flex items-center gap-2 rounded-xl bg-success-500/10 px-4 py-3 text-sm text-success-500">
                    <Check className="h-4 w-4" /> Partner linked successfully!
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-between">
          {step > 0 ? (
            <button
              onClick={back}
              className="btn-ghost flex items-center gap-2 px-4 py-2.5"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : (
            <div />
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={next}
              className="btn-primary flex items-center gap-2 px-6 py-2.5"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={loading}
              className="btn-primary flex items-center gap-2 px-6 py-2.5 disabled:opacity-50"
            >
              {loading ? (
                "Saving..."
              ) : (
                <>
                  Complete <Check className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
