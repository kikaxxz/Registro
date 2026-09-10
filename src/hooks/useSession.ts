import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase/client";
import { api } from "../services/api";
import { errorMessage } from "../utils/errors";
import type { Profile } from "../types";
export function useSession() {
  const [user, setUser] = useState<User | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(Boolean(auth)),
    [error, setError] = useState("");
  useEffect(() => {
    if (!auth) return;
    let generation = 0,
      current: User | null = null;
    async function refresh() {
      const request = ++generation;
      if (!current) return;
      try {
        const data = await api<{ profile: Profile }>("/session");
        if (request === generation) {
          setProfile(data.profile);
          setError("");
        }
      } catch (e) {
        if (request === generation) {
          setProfile(null);
          setError(errorMessage(e));
        }
      } finally {
        if (request === generation) setLoading(false);
      }
    }
    const stop = onAuthStateChanged(auth, (next) => {
      current = next;
      generation++;
      setUser(next);
      setProfile(null);
      setError("");
      setLoading(Boolean(next));
      if (next) void refresh();
    });
    const timer = setInterval(() => {
      if (current) void refresh();
    }, 30000);
    const denied = (e: Event) => {
      generation++;
      setProfile(null);
      setLoading(false);
      setError((e as CustomEvent).detail);
    };
    const focus = () => {
      if (current) void refresh();
    };
    window.addEventListener("access-denied", denied);
    window.addEventListener("focus", focus);
    return () => {
      generation++;
      stop();
      clearInterval(timer);
      window.removeEventListener("access-denied", denied);
      window.removeEventListener("focus", focus);
    };
  }, []);
  return { user, profile, loading, error };
}
