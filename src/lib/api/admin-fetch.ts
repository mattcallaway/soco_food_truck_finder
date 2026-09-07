/**
 * Client-side fetch wrapper for admin API routes.
 *
 * Automatically attaches the Firebase ID token as a Bearer Authorization header.
 * In development/demo mode (no Firebase auth), attaches the demo-admin header instead.
 *
 * Usage:
 *   import { adminFetch } from '@/lib/api/admin-fetch';
 *   const res = await adminFetch('/api/admin/sources/fetch', {
 *     method: 'POST',
 *     body: JSON.stringify({ sourceId }),
 *   });
 */
import { auth } from '@/lib/firebase/config';

export async function adminFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const user = auth?.currentUser;

  if (user) {
    // Firebase Auth active — get fresh ID token
    try {
      const token = await user.getIdToken(/* forceRefresh */ false);
      headers['Authorization'] = `Bearer ${token}`;
    } catch (err) {
      console.error('[adminFetch] Failed to get ID token:', err);
      throw new Error('Failed to obtain authentication token. Please sign in again.');
    }
  } else {
    // No Firebase auth configured (demo / development mode)
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Not authenticated. Firebase Auth is required in production.');
    }
    // Send the demo-admin header — server will accept only in dev+demo mode
    headers['x-demo-admin'] = 'true';
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
