import { getMessaging, getToken, deleteToken, onMessage, isSupported } from 'firebase/messaging';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore';
import app, { db, firebaseConfig } from '../firebase';

/**
 * Web push (Firebase Cloud Messaging) enrollment.
 *
 * A device is "enrolled" when the browser has granted notification permission
 * and we have stored its FCM registration token against the user in the
 * `pushDevices` collection. The delivery backend reads that collection to
 * decide where to send.
 */

const DEVICES_COLLECTION = 'pushDevices';
const SW_PATH = '/firebase-messaging-sw.js';
const LOCAL_TOKEN_KEY = 'iwce_push_token';

export interface PushDevice {
  /** Firestore doc id, which is the FCM token itself. */
  token: string;
  userId: string;
  userName: string;
  label: string;
  userAgent: string;
  createdAt: string;
  /** True when this token belongs to the browser currently open. */
  isCurrentDevice?: boolean;
}

export type PushPermission = 'unsupported' | 'default' | 'granted' | 'denied';

function vapidKey(): string {
  return import.meta.env.VITE_FIREBASE_VAPID_KEY ?? '';
}

export function isPushConfigured(): boolean {
  return vapidKey().trim().length > 0;
}

/** Short human label for the current browser, used to identify devices in the UI. */
function describeCurrentDevice(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser';

  const platform = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'device';

  return `${browser} on ${platform}`;
}

class PushNotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;

  async getPermissionState(): Promise<PushPermission> {
    if (!(await isSupported()) || !('Notification' in window)) return 'unsupported';
    return Notification.permission as PushPermission;
  }

  /** The token stored for this browser, if it has ever been enrolled. */
  getLocalToken(): string | null {
    return localStorage.getItem(LOCAL_TOKEN_KEY);
  }

  private async registerServiceWorker(): Promise<ServiceWorkerRegistration> {
    if (this.swRegistration) return this.swRegistration;

    // The SW reads the Firebase config from its own URL query string.
    const params = new URLSearchParams({
      apiKey: firebaseConfig.apiKey ?? '',
      authDomain: firebaseConfig.authDomain ?? '',
      projectId: firebaseConfig.projectId ?? '',
      storageBucket: firebaseConfig.storageBucket ?? '',
      messagingSenderId: firebaseConfig.messagingSenderId ?? '',
      appId: firebaseConfig.appId ?? ''
    });

    this.swRegistration = await navigator.serviceWorker.register(`${SW_PATH}?${params}`, {
      scope: '/'
    });
    return this.swRegistration;
  }

  /**
   * Prompts for permission (if needed), obtains an FCM token, and stores it
   * against the user. Returns the token, or throws with a readable reason.
   */
  async enrollCurrentDevice(userId: string, userName: string): Promise<string> {
    if (!(await isSupported())) {
      throw new Error('This browser does not support web push notifications.');
    }
    if (!isPushConfigured()) {
      throw new Error(
        'Push is not configured yet. Add VITE_FIREBASE_VAPID_KEY to your environment and restart the dev server.'
      );
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error(
        'Notification permission was not granted. Enable notifications for this site in your browser settings.'
      );
    }

    const registration = await this.registerServiceWorker();
    const token = await getToken(getMessaging(app), {
      vapidKey: vapidKey(),
      serviceWorkerRegistration: registration
    });

    if (!token) {
      throw new Error('Could not obtain a push token from Firebase.');
    }

    await setDoc(doc(db, DEVICES_COLLECTION, token), {
      token,
      userId,
      userName,
      label: describeCurrentDevice(),
      userAgent: navigator.userAgent,
      createdAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });

    localStorage.setItem(LOCAL_TOKEN_KEY, token);
    return token;
  }

  /** Removes a device so it stops receiving push. */
  async removeDevice(token: string): Promise<void> {
    await deleteDoc(doc(db, DEVICES_COLLECTION, token));

    if (this.getLocalToken() === token) {
      localStorage.removeItem(LOCAL_TOKEN_KEY);
      try {
        if (await isSupported()) await deleteToken(getMessaging(app));
      } catch {
        // The browser may have already discarded the token; the Firestore
        // record is gone either way, which is what controls delivery.
      }
    }
  }

  async getDevicesForUser(userId: string): Promise<PushDevice[]> {
    const q = query(collection(db, DEVICES_COLLECTION), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const localToken = this.getLocalToken();

    return snapshot.docs
      .map(d => {
        const data = d.data();
        return {
          token: d.id,
          userId: data.userId ?? '',
          userName: data.userName ?? '',
          label: data.label ?? 'Unknown device',
          userAgent: data.userAgent ?? '',
          createdAt: data.createdAt ?? '',
          isCurrentDevice: d.id === localToken
        } as PushDevice;
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /**
   * Shows notifications that arrive while the app is in the foreground, since
   * FCM does not display those automatically. Returns an unsubscribe function.
   */
  async listenInForeground(
    onNotification: (title: string, body: string) => void
  ): Promise<() => void> {
    if (!(await isSupported())) return () => {};
    return onMessage(getMessaging(app), payload => {
      const title = payload.notification?.title ?? payload.data?.title ?? 'Field Hub';
      const body = payload.notification?.body ?? payload.data?.body ?? '';
      onNotification(title, body);
    });
  }

  /** Fires a local test notification so the user can confirm the setup works. */
  async sendTestNotification(): Promise<void> {
    if (Notification.permission !== 'granted') {
      throw new Error('Enable notifications on this device first.');
    }
    const registration = await this.registerServiceWorker();
    await registration.showNotification('Field Hub test notification', {
      body: 'Push notifications are working on this device.',
      icon: '/top-left-logo.png'
    });
  }
}

export const pushNotificationService = new PushNotificationService();
