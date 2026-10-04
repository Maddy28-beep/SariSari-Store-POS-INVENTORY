import { useState } from 'react';

const STORAGE_KEY = 'sari-page-size';

function savedSize(fallback) {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY));
    return n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Client-side pagination for a list already in memory (the catalog is cached on the
 * device, so this also works offline). Goes back to page 1 whenever the list changes size,
 * e.g. after a search or filter.
 */
export function usePagination(items, initialSize = 25) {
  const [size, setSizeState] = useState(() => savedSize(initialSize));
  const [state, setState] = useState({ page: 1, len: items.length });

  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = state.len === items.length ? Math.min(state.page, pages) : 1;

  const setPage = (p) => setState({ page: Math.min(Math.max(1, p), pages), len: items.length });
  const setSize = (n) => {
    setSizeState(n);
    setState({ page: 1, len: items.length });
    try { localStorage.setItem(STORAGE_KEY, String(n)); } catch { /* private mode */ }
  };

  const from = (page - 1) * size;
  return {
    pageItems: items.slice(from, from + size),
    page, pages, size, total: items.length, from, setPage, setSize,
  };
}
