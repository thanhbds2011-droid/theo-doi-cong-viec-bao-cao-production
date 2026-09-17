"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase-client";
import { apiFetch } from "@/lib/api-client";
import type { AppUser } from "@/lib/types";

type AuthContextValue = {
  firebaseUser: User | null;
  profile: AppUser | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ngăn phản hồi đăng nhập cũ ghi đè hồ sơ sau khi người dùng đổi tài khoản.
  const authGeneration = useRef(0);

  async function bootstrap(user: User, generation = authGeneration.current) {
    setError(null);
    try {
      const response = await apiFetch<{ ok: true; profile: AppUser }>("/api/auth/bootstrap", { method: "POST" });
      if (generation !== authGeneration.current || auth.currentUser?.uid !== user.uid) return;
      setProfile(response.profile);
    } catch (bootstrapError) {
      if (generation !== authGeneration.current) return;
      setProfile(null);
      setError("Không thể tải thông tin tài khoản. Vui lòng thử lại.");
      throw bootstrapError;
    } finally {
      if (generation === authGeneration.current) setLoading(false);
    }
  }

  async function refreshProfile() {
    const user = auth.currentUser;
    if (!user) return;
    await bootstrap(user);
  }

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      const generation = ++authGeneration.current;
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }
      setFirebaseUser(user);
      setProfile(null);
      setError(null);
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        await bootstrap(user, generation);
        if (generation !== authGeneration.current || auth.currentUser?.uid !== user.uid) return;
        unsubscribeProfile = onSnapshot(
          doc(db, "users", user.uid),
          (snap) => {
            if (generation !== authGeneration.current || auth.currentUser?.uid !== user.uid) return;
            if (snap.exists()) setProfile({ uid: snap.id, ...(snap.data() as Omit<AppUser, "uid">) });
          },
          (error) => console.error("Profile listener error", error)
        );
      } catch (error) {
        console.error("Bootstrap failed", error);
        setLoading(false);
      }
    });

    return () => {
      authGeneration.current++;
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      loading,
      error,
      refreshProfile,
      logout: async () => {
        authGeneration.current++;
        setFirebaseUser(null);
        setProfile(null);
        setError(null);
        await signOut(auth);
      }
    }),
    [firebaseUser, profile, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
