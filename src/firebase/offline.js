import { useSyncExternalStore } from 'react';
import {
  getDoc, getDocs, getDocFromCache, getDocsFromCache,
} from 'firebase/firestore';

const READ_TIMEOUT_MS = 4000;
const COMMIT_TIMEOUT_MS = 2000;

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

/**
 * Reads that never hang when the internet is down: use the server when it answers
 * quickly, otherwise fall back to the copy stored on this device.
 */
export async function getDocsSafe(q) {
  if (!navigator.onLine) return getDocsFromCache(q);
  try {
    return await Promise.race([getDocs(q), timeout(READ_TIMEOUT_MS)]);
  } catch (err) {
    if (err?.code === 'permission-denied') throw err;
    return getDocsFromCache(q);
  }
}

export async function getDocSafe(ref) {
  if (!navigator.onLine) return getDocFromCache(ref);
  try {
    return await Promise.race([getDoc(ref), timeout(READ_TIMEOUT_MS)]);
  } catch (err) {
    if (err?.code === 'permission-denied') throw err;
    return getDocFromCache(ref);
  }
}

// ---- sync status (how many writes are still waiting for the server) ----
let pending = 0;
let online = typeof navigator === 'undefined' ? true : navigator.onLine;
let snapshot = { pending, online };
const listeners = new Set();

function emit() {
  snapshot = { pending, online };
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { online = true; emit(); });
  window.addEventListener('offline', () => { online = false; emit(); });
}

export function useSyncStatus() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => snapshot,
  );
}

/**
 * Wait for a Firestore write without blocking the cashier on the network.
 * Firestore applies the write locally at once and only resolves the promise when the
 * server confirms — offline that never happens until reconnect. So: if the server
 * rejects it quickly (e.g. security rules) we throw; if it is just slow/offline we
 * return and let it sync in the background.
 */
export async function settleFast(writePromise) {
  pending += 1;
  emit();
  const done = writePromise.then(
    () => { pending -= 1; emit(); },
    (err) => { pending -= 1; emit(); throw err; },
  );
  const result = await Promise.race([
    done.then(() => 'done'),
    timeout(COMMIT_TIMEOUT_MS).catch(() => 'queued'),
  ]);
  if (result === 'queued') done.catch((err) => console.error('Queued write was rejected by the server:', err));
}

export const commitFast = (batch) => settleFast(batch.commit());
