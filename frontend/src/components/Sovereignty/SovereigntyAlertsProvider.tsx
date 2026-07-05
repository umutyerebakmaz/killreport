"use client";

import { SovereigntyAlertSubscription, useSovereigntyAlertSubscription } from "@/generated/graphql";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AlertToastStack, type ToastAlert } from "./AlertToast";

export type SovAlert = SovereigntyAlertSubscription["sovereigntyAlert"];

interface AlertsContextValue {
  recent: SovAlert[];
  unread: number;
  markAllRead: () => void;
  clear: () => void;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

export function useSovereigntyAlerts(): AlertsContextValue {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useSovereigntyAlerts must be used within SovereigntyAlertsProvider");
  return ctx;
}

const RECENT_KEY = "sov_alerts_recent";
const UNREAD_KEY = "sov_alerts_unread";
const CAP = 30;

/**
 * App-wide sovereignty alert stream. Subscribes over SSE, keeps a rolling recent
 * list + unread count in localStorage (survives navigation/reload), shows a toast
 * per new alert, and exposes state to the header NotificationBell via context.
 */
export function SovereigntyAlertsProvider({ children }: { children: React.ReactNode }) {
  const [recent, setRecent] = useState<SovAlert[]>([]);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  const seeded = useRef(false);
  const toastSeq = useRef(0);

  // Hydrate persisted state client-side (after mount, to avoid SSR mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
      setUnread(Number(localStorage.getItem(UNREAD_KEY)) || 0);
    } catch {
      /* ignore corrupt storage */
    }
    seeded.current = true;
  }, []);

  const { data } = useSovereigntyAlertSubscription();

  useEffect(() => {
    const alert = data?.sovereigntyAlert;
    // Ignore until persisted state is loaded, so we don't clobber it.
    if (!alert || !seeded.current) return;

    setRecent((prev) => {
      const next = [alert, ...prev].slice(0, CAP);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* quota / disabled */
      }
      return next;
    });
    setUnread((u) => {
      const n = u + 1;
      try {
        localStorage.setItem(UNREAD_KEY, String(n));
      } catch {
        /* quota / disabled */
      }
      return n;
    });
    const id = `t${toastSeq.current++}`;
    setToasts((t) => [{ id, type: alert.type, message: alert.message }, ...t].slice(0, 5));
  }, [data]);

  const markAllRead = () => {
    setUnread(0);
    try {
      localStorage.setItem(UNREAD_KEY, "0");
    } catch {
      /* ignore */
    }
  };
  const clear = () => {
    setRecent([]);
    setUnread(0);
    try {
      localStorage.removeItem(RECENT_KEY);
      localStorage.setItem(UNREAD_KEY, "0");
    } catch {
      /* ignore */
    }
  };
  const dismissToast = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <AlertsContext.Provider value={{ recent, unread, markAllRead, clear }}>
      {children}
      <AlertToastStack toasts={toasts} onDismiss={dismissToast} />
    </AlertsContext.Provider>
  );
}
