'use client';

/**
 * Thin wrapper around the browser Notification API.
 * Every function is safe to call on the server, in browsers without notification support,
 * and in contexts where the API throws (e.g. some embedded webviews).
 */

export type BrowserNotificationPermission = NotificationPermission | 'unsupported';

export function getNotificationPermission(): BrowserNotificationPermission {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

/**
 * Asks the user for permission to show desktop notifications.
 * Call it from a click handler (e.g. Punch In): Safari and Firefox only show the prompt after a user gesture.
 * Never prompts again once the user has allowed or blocked notifications.
 */
export async function requestNotificationPermission(): Promise<BrowserNotificationPermission> {
  const current = getNotificationPermission();
  if (current !== 'default') return current;
  try {
    return await Notification.requestPermission();
  } catch {
    return getNotificationPermission();
  }
}

export function showBrowserNotification(
  title: string,
  options: { body?: string; tag?: string; requireInteraction?: boolean; onClick?: () => void } = {}
): Notification | null {
  if (getNotificationPermission() !== 'granted') return null;
  try {
    const notification = new Notification(title, {
      body: options.body,
      tag: options.tag,
      icon: '/wmedlaw_logo.jpeg',
      badge: '/wmedlaw_logo.jpeg',
      requireInteraction: options.requireInteraction,
    });
    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // ignore
      }
      options.onClick?.();
      notification.close();
    };
    return notification;
  } catch {
    // e.g. Chrome on Android only allows notifications through a service worker
    return null;
  }
}
