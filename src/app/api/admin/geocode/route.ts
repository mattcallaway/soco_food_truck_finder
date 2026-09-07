import { NextRequest, NextResponse } from 'next/server';
import { APP_CONFIG } from '@/config/app-config';
import { requireAdmin } from '@/lib/api/require-admin';
import { validateOutboundUrl } from '@/lib/api/ssrf-guard';
import crypto from 'crypto';

// In-process cache — keyed by address string; ephemeral per cold-start
const geocodeCache: Record<string, { lat: number; lng: number; displayName: string }> = {};

export async function POST(request: NextRequest) {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { address, city } = body;

    if (!address || !city) {
      return NextResponse.json({ error: 'Address and city are required' }, { status: 400 });
    }

    const queryKey = `${address}, ${city}, CA`.toLowerCase();

    if (geocodeCache[queryKey]) {
      return NextResponse.json({ success: true, cached: true, ...geocodeCache[queryKey] });
    }

    const geocodeUrl = `${APP_CONFIG.geocodingApiUrl}?q=${encodeURIComponent(queryKey)}&format=json&limit=1`;

    // SSRF-guard the geocoding provider URL too
    const ssrfCheck = await validateOutboundUrl(geocodeUrl);
    if (!ssrfCheck.valid) {
      return NextResponse.json(
        { error: `Geocoding provider URL blocked by SSRF guard: ${ssrfCheck.error}` },
        { status: 400 }
      );
    }

    const res = await fetch(geocodeUrl, {
      headers: {
        'User-Agent': 'SoCo-Food-Truck-Finder-Geocoder/1.0 (+https://example.com/contact)',
      },
    });

    if (!res.ok) {
      throw new Error(`Geocoder API responded with HTTP ${res.status}`);
    }

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ success: false, error: 'Address could not be resolved to coordinates.' });
    }

    const first = data[0];
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    const displayName = first.display_name;
    const result = { lat, lng, displayName };

    geocodeCache[queryKey] = result;

    return NextResponse.json({ success: true, cached: false, ...result });
  } catch (err: any) {
    console.error('Geocoding server error:', err);
    return NextResponse.json({ error: err.message || 'Failed to geocode address' }, { status: 500 });
  }
}
