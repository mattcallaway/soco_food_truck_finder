const LOCAL_STORAGE_KEY = 'soco_anonymous_favorites';

export function getLocalFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read favorites from localStorage:', e);
    return [];
  }
}

export function saveLocalFavorites(vendorIds: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(vendorIds));
    window.dispatchEvent(new Event('favorites-updated'));
  } catch (e) {
    console.error('Failed to save favorites to localStorage:', e);
  }
}

export function toggleLocalFavorite(vendorId: string): string[] {
  const current = getLocalFavorites();
  const exists = current.includes(vendorId);
  let updated: string[];
  if (exists) {
    updated = current.filter((id) => id !== vendorId);
  } else {
    updated = [...current, vendorId];
  }
  saveLocalFavorites(updated);
  return updated;
}

export function isLocalFavorite(vendorId: string): boolean {
  const current = getLocalFavorites();
  return current.includes(vendorId);
}

/**
 * Merges local browser favorites with user account favorites upon sign-in.
 */
export async function mergeFavoritesOnSignIn(
  userId: string,
  accountFavoriteIds: string[]
): Promise<string[]> {
  const local = getLocalFavorites();
  const merged = Array.from(new Set([...accountFavoriteIds, ...local]));
  saveLocalFavorites(merged);
  return merged;
}
