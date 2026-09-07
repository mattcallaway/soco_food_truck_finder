/**
 * SSRF Guard — Server-side URL validation for outbound requests.
 *
 * Enforces:
 *  - https/http scheme only (no file://, data://, ftp://, etc.)
 *  - No embedded credentials (user:pass@host)
 *  - Hostname resolves to a public, routable IP (not loopback, private, link-local, etc.)
 *  - Optional administrator-configurable allowed-domain list
 *  - Redirect target revalidation
 *  - Request timeout and response size limits
 */
import * as dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

// ── IP range checkers ─────────────────────────────────────────────────────────

/**
 * Returns true if the IPv4 address is in a private/reserved/loopback range.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p))) return false;
  const [a, b] = parts;

  return (
    a === 127 ||                              // loopback 127.0.0.0/8
    a === 10 ||                               // private 10.0.0.0/8
    (a === 172 && b >= 16 && b <= 31) ||      // private 172.16.0.0/12
    (a === 192 && b === 168) ||               // private 192.168.0.0/16
    (a === 169 && b === 254) ||               // link-local 169.254.0.0/16 (AWS metadata etc.)
    a === 0 ||                                // 0.0.0.0/8 reserved
    (a === 100 && b >= 64 && b <= 127) ||     // CGNAT 100.64.0.0/10
    (a === 192 && b === 0 && parts[2] === 2) || // TEST-NET-1
    (a === 198 && b >= 18 && b <= 19) ||      // benchmarking
    (a === 203 && b === 0 && parts[2] === 113) || // TEST-NET-3
    a >= 224 ||                               // multicast + reserved 224+
    ip === '255.255.255.255'                  // broadcast
  );
}

/**
 * Returns true if the IPv6 address is loopback, link-local, or ULA.
 */
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === '::1' ||                          // loopback
    lower.startsWith('fe80:') ||               // link-local
    lower.startsWith('fc') ||                  // ULA
    lower.startsWith('fd') ||                  // ULA
    lower.startsWith('::ffff:127.') ||         // IPv4-mapped loopback
    lower.startsWith('0:0:0:0:0:ffff:7f') ||   // IPv4-mapped loopback (full)
    lower === '::' ||                           // unspecified
    lower.startsWith('ff')                      // multicast
  );
}

// ── ALLOWED DOMAIN CONFIG ──────────────────────────────────────────────────────

/**
 * Default allowed domains (administrators can override via environment variable).
 * Domains are treated as suffix matches (sub-domains are allowed).
 * Set SSRF_ALLOWED_DOMAINS="example.com,otherdomain.org" to override.
 * Set SSRF_ALLOWED_DOMAINS="*" to allow any public domain (network checks still apply).
 */
function getAllowedDomains(): string[] | null {
  const env = process.env.SSRF_ALLOWED_DOMAINS;
  if (!env) return null; // null = not configured, network checks still apply
  if (env === '*') return null; // explicit wildcard
  return env.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
}

function isDomainAllowed(hostname: string, allowedDomains: string[] | null): boolean {
  if (!allowedDomains) return true; // no allowlist configured → rely on network checks
  const h = hostname.toLowerCase();
  return allowedDomains.some((allowed) => h === allowed || h.endsWith('.' + allowed));
}

// ── MAIN GUARD ────────────────────────────────────────────────────────────────

export interface SSRFGuardOptions {
  /** Maximum number of redirects to follow (default: 3) */
  maxRedirects?: number;
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
  /** Maximum response body size in bytes (default: 5 * 1024 * 1024 = 5 MB) */
  maxResponseBytes?: number;
}

export interface SSRFValidationResult {
  valid: boolean;
  error?: string;
  resolvedIp?: string;
}

/**
 * Validates a URL before an outbound server-side fetch.
 * Throws a descriptive error if the URL is not safe to fetch.
 */
export async function validateOutboundUrl(
  rawUrl: string
): Promise<SSRFValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, error: `Invalid URL: ${rawUrl}` };
  }

  // 1. Scheme check
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    return { valid: false, error: `Forbidden URL scheme: ${parsed.protocol}. Only http/https is permitted.` };
  }

  // 2. No embedded credentials
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URLs with embedded credentials (user:pass@host) are not permitted.' };
  }

  // 3. Allowed domain check
  const allowedDomains = getAllowedDomains();
  if (!isDomainAllowed(parsed.hostname, allowedDomains)) {
    return {
      valid: false,
      error: `Domain "${parsed.hostname}" is not in the administrator-configured allowed-domains list (SSRF_ALLOWED_DOMAINS).`,
    };
  }

  // 4. Hostname resolution + IP range check
  const hostname = parsed.hostname;

  // Reject bare IP addresses that are private without needing DNS
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    if (isPrivateIPv4(hostname)) {
      return { valid: false, error: `Direct access to private/loopback IP address "${hostname}" is not permitted.` };
    }
    return { valid: true, resolvedIp: hostname };
  }

  if (hostname.includes(':')) {
    // IPv6 literal
    const bare = hostname.replace(/^\[|\]$/g, '');
    if (isPrivateIPv6(bare)) {
      return { valid: false, error: `Direct access to private/loopback IPv6 address "${hostname}" is not permitted.` };
    }
    return { valid: true, resolvedIp: hostname };
  }

  // DNS resolution
  try {
    const { address, family } = await dnsLookup(hostname, { all: false });
    if (family === 4 && isPrivateIPv4(address)) {
      return {
        valid: false,
        error: `Hostname "${hostname}" resolves to private/reserved address "${address}" — blocked for SSRF protection.`,
        resolvedIp: address,
      };
    }
    if (family === 6 && isPrivateIPv6(address)) {
      return {
        valid: false,
        error: `Hostname "${hostname}" resolves to private/reserved IPv6 address "${address}" — blocked for SSRF protection.`,
        resolvedIp: address,
      };
    }
    return { valid: true, resolvedIp: address };
  } catch (err: any) {
    return { valid: false, error: `DNS resolution failed for "${hostname}": ${err.message}` };
  }
}

/**
 * Performs a guarded outbound fetch with SSRF protection, redirect revalidation,
 * timeout, and response size limits.
 */
export async function guardedFetch(
  url: string,
  fetchOptions?: RequestInit,
  options?: SSRFGuardOptions
): Promise<{ text: string; httpStatus: number; contentType: string; effectiveUrl: string }> {
  const maxRedirects = options?.maxRedirects ?? 3;
  const timeoutMs = options?.timeoutMs ?? 10_000;
  const maxResponseBytes = options?.maxResponseBytes ?? 5 * 1024 * 1024;

  let currentUrl = url;
  let redirectCount = 0;

  while (true) {
    // Validate current URL (including every redirect target)
    const validation = await validateOutboundUrl(currentUrl);
    if (!validation.valid) {
      throw new Error(`SSRF guard blocked: ${validation.error}`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        ...fetchOptions,
        redirect: 'manual', // Handle redirects manually to revalidate each hop
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    // Handle redirects manually
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`Redirect from "${currentUrl}" had no Location header`);

      if (redirectCount >= maxRedirects) {
        throw new Error(`Too many redirects (max ${maxRedirects}) following "${url}"`);
      }

      // Resolve relative redirects
      try {
        currentUrl = new URL(location, currentUrl).toString();
      } catch {
        throw new Error(`Invalid redirect location: ${location}`);
      }

      redirectCount++;
      continue;
    }

    // Non-redirect: consume body with size limit
    const contentType = response.headers.get('content-type') ?? 'text/html';

    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > maxResponseBytes) {
          await reader.cancel();
          throw new Error(
            `Response from "${currentUrl}" exceeded maximum allowed size (${maxResponseBytes} bytes)`
          );
        }
        chunks.push(value);
      }
    }

    const text = new TextDecoder().decode(
      chunks.reduce((acc, chunk) => {
        const merged = new Uint8Array(acc.byteLength + chunk.byteLength);
        merged.set(acc);
        merged.set(chunk, acc.byteLength);
        return merged;
      }, new Uint8Array(0))
    );

    return {
      text,
      httpStatus: response.status,
      contentType,
      effectiveUrl: currentUrl,
    };
  }
}
