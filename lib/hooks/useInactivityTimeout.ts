'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

type Options = {
  inactivityMs: number; // e.g., 60 * 60 * 1000
  hardCapMs: number; // e.g., 24 * 60 * 60 * 1000
  warningBeforeMs: number; // e.g., 10 * 60 * 1000
  onTimeout: () => void;
  onWarn?: (msRemaining: number) => void;
};

const STORAGE_KEYS = {
  lastActivity: 'admin_last_activity',
  sessionStartedAt: 'admin_session_started_at',
};

export function useInactivityTimeout({
  inactivityMs,
  hardCapMs,
  warningBeforeMs,
  onTimeout,
  onWarn,
}: Options) {
  const [warn, setWarn] = useState(false);
  const [msRemaining, setMsRemaining] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const now = () => Date.now();

  const getLastActivity = () => {
    if (typeof window === 'undefined') return now();
    const stored = localStorage.getItem(STORAGE_KEYS.lastActivity);
    return stored ? Number(stored) : now();
  };

  const getSessionStartedAt = () => {
    if (typeof window === 'undefined') return now();
    const stored = localStorage.getItem(STORAGE_KEYS.sessionStartedAt);
    return stored ? Number(stored) : now();
  };

  const setActivity = useCallback(() => {
    if (typeof window === 'undefined') return;
    const t = now();
    localStorage.setItem(STORAGE_KEYS.lastActivity, String(t));
    setWarn(false);
  }, []);

  const ensureSessionStart = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(STORAGE_KEYS.sessionStartedAt)) {
      localStorage.setItem(STORAGE_KEYS.sessionStartedAt, String(now()));
    }
  }, []);

  const clearSession = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.lastActivity);
    localStorage.removeItem(STORAGE_KEYS.sessionStartedAt);
  }, []);

  useEffect(() => {
    ensureSessionStart();
    setActivity(); // initialize

    const handleActivity = () => setActivity();
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, handleActivity));
    document.addEventListener('visibilitychange', handleActivity);

    intervalRef.current = setInterval(() => {
      const last = getLastActivity();
      const sessionStart = getSessionStartedAt();
      const elapsed = now() - last;
      const sessionElapsed = now() - sessionStart;

      // Hard cap check
      if (sessionElapsed > hardCapMs) {
        clearSession();
        onTimeout();
        return;
      }

      const remaining = inactivityMs - elapsed;
      if (remaining <= 0) {
        clearSession();
        onTimeout();
        return;
      }

      // Warning threshold
      if (remaining <= warningBeforeMs) {
        setWarn(true);
        setMsRemaining(remaining);
        onWarn?.(remaining);
      } else {
        setWarn(false);
        setMsRemaining(null);
      }
    }, 30_000); // check every 30s

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
      document.removeEventListener('visibilitychange', handleActivity);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [clearSession, ensureSessionStart, hardCapMs, inactivityMs, onTimeout, onWarn, setActivity]);

  return {
    warn,
    msRemaining,
    reset: setActivity,
    clearSession,
  };
}


