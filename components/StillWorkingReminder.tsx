'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Square, BellRing, BellOff, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/lib/context';
import {
  addMinutesToWallClock,
  formatTime,
  minutesSincePunchIn,
  MAX_SESSION_HOURS,
  MAX_SESSION_MINUTES,
} from '@/lib/utils-dtr';
import {
  getNotificationPermission,
  requestNotificationPermission,
  showBrowserNotification,
} from '@/lib/browser-notifications';

/** Minutes between "Are you still working?" check-ins while punched in. */
export const STILL_WORKING_INTERVAL_MINUTES = 60;

const STORAGE_PREFIX = 'wmedlaw_still_working_';

/** Per-session progress: last check-in the employee answered, and last one we sent a browser alert for. */
type CheckInState = { ack: number; notified: number };

// In-memory fallback for browsers where localStorage is unavailable (private mode, blocked storage)
const memoryStore = new Map<string, CheckInState>();

function readCheckInState(sessionId: string): CheckInState {
  const key = STORAGE_PREFIX + sessionId;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ack: Number(parsed.ack) || 0, notified: Number(parsed.notified) || 0 };
    }
  } catch {
    // fall through to memory
  }
  return memoryStore.get(key) || { ack: 0, notified: 0 };
}

function writeCheckInState(sessionId: string, state: CheckInState) {
  const key = STORAGE_PREFIX + sessionId;
  memoryStore.set(key, state);
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // memory fallback already updated
  }
}

function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hour${h === 1 ? '' : 's'}` : `${h}h ${m}m`;
}

interface StillWorkingReminderProps {
  /** Opens the punch-out flow (remarks + confirm). */
  onPunchOut: () => void;
}

/**
 * Every hour while an employee is punched in, asks "Are you still working?":
 *  - an in-app dialog on whatever page they are on, and
 *  - a browser/desktop notification when the app is in a background tab or another window is focused.
 * Answering in one tab dismisses it in the employee's other open tabs too.
 * The last check-in is before the automatic close at MAX_SESSION_HOURS.
 */
export function StillWorkingReminder({ onPunchOut }: StillWorkingReminderProps) {
  const { currentOpenSession, serverCurrentDate, serverCurrentTime } = useApp();
  const [version, setVersion] = useState(0);
  const notificationRef = useRef<Notification | null>(null);
  const lastNotifiedKeyRef = useRef<string | null>(null);

  const sessionId = currentOpenSession?.id || null;

  // Re-read when another tab answers the check-in
  useEffect(() => {
    if (!sessionId) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_PREFIX + sessionId) setVersion((v) => v + 1);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [sessionId]);

  const checkInState = useMemo(
    () => (sessionId ? readCheckInState(sessionId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, version]
  );

  const elapsedMinutes = currentOpenSession
    ? minutesSincePunchIn(currentOpenSession.work_date, currentOpenSession.time_in, serverCurrentDate, serverCurrentTime)
    : 0;

  // Check-in number reached so far (1 = first hour). No check-in at the auto-close mark itself.
  const lastCheckIn = Math.ceil(MAX_SESSION_MINUTES / STILL_WORKING_INTERVAL_MINUTES) - 1;
  const checkIn = Math.min(Math.floor(elapsedMinutes / STILL_WORKING_INTERVAL_MINUTES), lastCheckIn);
  const isDue = Boolean(currentOpenSession && checkInState && checkIn >= 1 && checkIn > checkInState.ack);

  const autoCloseAt = currentOpenSession
    ? addMinutesToWallClock(currentOpenSession.work_date, currentOpenSession.time_in, MAX_SESSION_MINUTES)
    : null;

  // Fire the browser notification once per check-in, only when the employee isn't looking at the app
  useEffect(() => {
    if (!isDue || !sessionId || !checkInState || !currentOpenSession || checkInState.notified >= checkIn) return;
    const notifyKey = `${sessionId}:${checkIn}`;
    if (lastNotifiedKeyRef.current === notifyKey) return;
    lastNotifiedKeyRef.current = notifyKey;
    writeCheckInState(sessionId, { ...checkInState, notified: checkIn });

    let appHasFocus = false;
    try {
      appHasFocus = document.visibilityState === 'visible' && document.hasFocus();
    } catch {
      // ignore
    }
    if (appHasFocus) return;

    notificationRef.current?.close();
    notificationRef.current = showBrowserNotification('Are you still working?', {
      body: `You've been punched in for ${formatDuration(elapsedMinutes)} (since ${formatTime(
        currentOpenSession.time_in
      )}). Open the app to confirm or punch out.${
        autoCloseAt ? ` Your log auto-closes at ${formatTime(autoCloseAt.time)}.` : ''
      }`,
      tag: `still-working-${sessionId}`,
      requireInteraction: true,
    });
    // elapsedMinutes/autoCloseAt are derived from the same inputs; only re-run when a new check-in is due
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDue, sessionId, checkIn, checkInState]);

  // Close a lingering desktop notification once the session ends (punched out or auto-closed)
  useEffect(() => {
    if (!sessionId) {
      notificationRef.current?.close();
      notificationRef.current = null;
    }
  }, [sessionId]);

  if (!isDue || !currentOpenSession || !sessionId || !checkInState) return null;

  const acknowledge = () => {
    writeCheckInState(sessionId, { ack: checkIn, notified: Math.max(checkInState.notified, checkIn) });
    notificationRef.current?.close();
    notificationRef.current = null;
    setVersion((v) => v + 1);
  };

  const permission = getNotificationPermission();
  const minutesLeft = Math.max(0, MAX_SESSION_MINUTES - elapsedMinutes);

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="still-working-title"
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 id="still-working-title" className="font-bold text-slate-900 text-base">
              Are you still working?
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              You&apos;ve been punched in for <strong className="text-slate-900">{formatDuration(elapsedMinutes)}</strong>{' '}
              (since {formatTime(currentOpenSession.time_in)}).
            </p>
          </div>
        </div>

        {autoCloseAt && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
            If you forget to punch out, your log closes automatically at{' '}
            <strong className="font-mono">{formatTime(autoCloseAt.time)}</strong> ({MAX_SESSION_HOURS}-hour max,{' '}
            {formatDuration(minutesLeft)} left) and is sent for admin review.
          </div>
        )}

        {permission === 'default' && (
          <button
            type="button"
            onClick={async () => {
              await requestNotificationPermission();
              setVersion((v) => v + 1);
            }}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 py-1 cursor-pointer"
          >
            <BellRing className="w-3.5 h-3.5" />
            Turn on desktop alerts so you get this reminder in other tabs
          </button>
        )}
        {permission === 'denied' && (
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <BellOff className="w-3.5 h-3.5 shrink-0" />
            Desktop alerts are blocked. Allow notifications for this site in your browser settings.
          </p>
        )}

        <div className="flex flex-col-reverse xs:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              acknowledge();
              onPunchOut();
            }}
            className="flex-1 justify-center px-4 py-2.5 min-h-[44px] bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Square className="w-4 h-4 text-rose-600" />
            Punch out now
          </button>
          <button
            type="button"
            autoFocus
            onClick={acknowledge}
            className="flex-1 justify-center px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Yes, still working
          </button>
        </div>
      </div>
    </div>
  );
}
