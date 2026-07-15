import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * Server-side Firebase Admin SDK singleton.
 *
 * Requires the FIREBASE_SERVICE_ACCOUNT env var to contain the full service
 * account JSON (from Firebase Console > Project settings > Service accounts).
 * This runs only inside Vercel serverless functions - never in the browser.
 */

let cachedDb: Firestore | null = null;

function parseServiceAccount(): Record<string, any> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT env var is not set. Add the service account JSON in your Vercel project settings.'
    );
  }
  try {
    const parsed = JSON.parse(raw);
    // Vercel/CI often stores the private key with escaped newlines; normalize them.
    if (parsed.private_key && typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch (err) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON: ' + (err as Error).message);
  }
}

export function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];
  const serviceAccount = parseServiceAccount();
  return initializeApp({ credential: cert(serviceAccount as any) });
}

export function getDb(): Firestore {
  if (cachedDb) return cachedDb;
  cachedDb = getFirestore(getAdminApp());
  return cachedDb;
}
