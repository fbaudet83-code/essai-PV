// Checks a build version file served from /version.json
// If it changes, we clear caches (when possible) and force a reload.

export type AppVersionInfo = {
  name?: string;
  version?: string;
  buildId?: string;
  builtAt?: string;
};

const LS_KEY = 'richardson_build_id';

async function safeClearCaches() {
  try {
    // Clear Cache Storage if present
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // Ignore
  }
}

export async function checkForNewVersionOnce(): Promise<boolean> {
  try {
    // no-store ensures the browser asks the server each time
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return false;
    const info = (await res.json()) as AppVersionInfo;
    const buildId = info.buildId || '';
    if (!buildId) return false;

    const saved = localStorage.getItem(LS_KEY);
    if (!saved) {
      localStorage.setItem(LS_KEY, buildId);
      return false;
    }

    if (saved !== buildId) {
      localStorage.setItem(LS_KEY, buildId);
      await safeClearCaches();
      // Reload to pick up the new index.html + new hashed assets
      window.location.reload();
      return true;
    }
  } catch {
    // Ignore
  }
  return false;
}

export function startVersionPolling(opts?: { intervalMs?: number }) {
  const intervalMs = opts?.intervalMs ?? 60_000; // 1 min

  // Run once on load
  void checkForNewVersionOnce();

  // Then poll
  return window.setInterval(() => {
    void checkForNewVersionOnce();
  }, intervalMs);
}
