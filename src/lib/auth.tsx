import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  auth,
  onAuthStateChanged,
  fbSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  googleProvider,
  sendPasswordResetEmail,
  fbUpdateProfile,
  uploadAvatar as fbUploadAvatar,
  type FirebaseUser,
} from './firebase';
import { getProfile, createProfile, updateProfile as dbUpdateProfile, type Profile } from './db';

type AuthContextType = {
  user: FirebaseUser | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<{ error: string | null }>;
  updateAvatar: (file: File) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string, email: string) => {
    const existing = await getProfile(uid);
    if (existing) {
      setProfile(existing);
      return existing;
    }
    const created = await createProfile(uid, email);
    setProfile(created);
    return created;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        (async () => {
          await loadProfile(fbUser.uid, fbUser.email ?? '');
          setLoading(false);
        })();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Sign up failed' };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Sign in failed' };
    }
  };

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Google sign in failed' };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Reset failed' };
    }
  };

  const signOut = async () => {
    await fbSignOut(auth);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.uid, user.email ?? '');
  };

  const updateProfile = async (patch: Partial<Profile>) => {
    if (!user) return { error: 'Not authenticated' };
    try {
      const updated = await dbUpdateProfile(user.uid, patch);
      if (updated) setProfile(updated);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Update failed' };
    }
  };

  const updateAvatar = async (file: File) => {
    if (!user) return { error: 'Not authenticated' };
    try {
      const url = await fbUploadAvatar(file, user.uid);
      await fbUpdateProfile(user, { photoURL: url });
      const updated = await dbUpdateProfile(user.uid, { avatar_url: url });
      if (updated) setProfile(updated);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Upload failed' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        resetPassword,
        signOut,
        refreshProfile,
        updateProfile,
        updateAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
