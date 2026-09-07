/**
 * Server-side middleware that verifies a Firebase ID token from the Authorization header
 * and asserts the `admin` custom claim.
 *
 * Returns the verified admin UID (string) on success.
 * Returns a NextResponse with 401 or 403 on failure.
 *
 * Usage in any /api/admin/* route:
 *
 *   const result = await requireAdmin(request);
 *   if (result instanceof NextResponse) return result;
 *   const adminUid = result; // verified admin UID
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, hasAdminSdk } from '@/lib/firebase/admin-config';

/**
 * In development/demo mode (no Admin SDK configured), check for the demo-admin
 * header that the client sends when running without Firebase credentials.
 * This path is NEVER active when NODE_ENV === 'production'.
 */
function checkDemoMode(request: NextRequest): string | null {
  if (process.env.NODE_ENV === 'production') return null;
  if (process.env.NEXT_PUBLIC_DATA_MODE !== 'demo' && process.env.DATA_MODE !== 'demo') {
    // Only allow demo bypass if app is explicitly in demo mode
    const hasFirebase =
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (hasFirebase) return null;
  }
  const demoHeader = request.headers.get('x-demo-admin');
  if (demoHeader === 'true') return 'demo-admin-uid';
  return null;
}

export async function requireAdmin(
  request: NextRequest
): Promise<string | NextResponse> {
  // ── Demo mode bypass (development + no Firebase creds) ──────────────────────
  if (!hasAdminSdk()) {
    const demoUid = checkDemoMode(request);
    if (demoUid) return demoUid;

    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Server configuration error: Firebase Admin SDK not initialized' },
        { status: 503 }
      );
    }
    // Dev mode without Firebase — require explicit demo header
    return NextResponse.json(
      { error: 'Unauthorized: Firebase Admin SDK not configured. Pass x-demo-admin: true in dev mode.' },
      { status: 401 }
    );
  }

  // ── Production: verify Bearer token ─────────────────────────────────────────
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized: Missing or malformed Authorization header' },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized: Empty token' }, { status: 401 });
  }

  try {
    const decoded = await adminAuth!.verifyIdToken(token, /* checkRevoked */ true);

    // Custom claim is the ONLY authoritative admin signal
    if (!decoded.admin) {
      return NextResponse.json(
        {
          error:
            'Forbidden: This account does not have the admin custom claim. ' +
            'Contact a Firebase project owner to grant administrator access.',
        },
        { status: 403 }
      );
    }

    return decoded.uid;
  } catch (err: any) {
    const code: string = err?.code ?? '';
    if (code === 'auth/id-token-revoked' || code === 'auth/user-disabled') {
      return NextResponse.json(
        { error: 'Unauthorized: Token has been revoked or account disabled' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or expired authentication token' },
      { status: 401 }
    );
  }
}
