import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, tokenStore } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!tokenStore.get()) { setLoading(false); return; }
      try {
        const { user } = await api.me();
        if (alive) setUser(user);
      } catch {
        tokenStore.clear();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user } = await api.login({ email, password });
    tokenStore.set(token);
    setUser(user);
  }, []);

  const register = useCallback(async (email, password, name) => {
    const { token, user } = await api.register({ email, password, name });
    tokenStore.set(token);
    setUser(user);
  }, []);

  // Adopt a token obtained out-of-band (e.g. the Google OAuth callback) and load the profile.
  const loginWithToken = useCallback(async (token) => {
    tokenStore.set(token);
    const { user } = await api.me();
    setUser(user);
  }, []);

  // Re-fetch the current profile (e.g. after email verification flips the flag).
  const refreshUser = useCallback(async () => {
    try {
      const { user } = await api.me();
      setUser(user);
    } catch { /* ignore */ }
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, loginWithToken, refreshUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
