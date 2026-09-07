/**
 * Firebase Admin SDK initialization — server-side only.
 * Never import this in client components.
 */
import { getApps, getApp, initializeApp, App, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

function hasAdminConfig(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

/**
 * Initialize Firebase Admin only once (handles multiple hot-reloads in dev).
 */
function initAdmin(): App | null {
  if (!hasAdminConfig()) return null;

  if (getApps().length > 0) return getApp();

  // Prefer explicit service account env vars; fall back to GOOGLE_APPLICATION_CREDENTIALS
  if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON);
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  if (
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY &&
    process.env.FIREBASE_ADMIN_PROJECT_ID
  ) {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        // Replace escaped newlines from .env string literals
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }

  // Fall back to Application Default Credentials (works in GCP/Cloud Run)
  return initializeApp({
    credential: applicationDefault(),
    projectId:
      process.env.FIREBASE_ADMIN_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export const adminApp: App | null = initAdmin();
export const adminAuth: Auth | null = adminApp ? getAuth(adminApp) : null;

export function hasAdminSdk(): boolean {
  return adminAuth !== null;
}
