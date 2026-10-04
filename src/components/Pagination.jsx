import { useRef } from 'react';

const SIZES = [10, 25, 50, 100];

/** Page numbers to show: first, last, and a window around the current page. */
function windowed(page, pages) {
  const set = new Set([1, pages, page - 1, page, page + 1]);
  const list = [...set].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const out = [];
  list.forEach((p, i) => {
    if (i > 0 && p - list[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

export default function Pagination({ pager, noun = 'items' }) {
  const { page, pages, size, total, from, setSize } = pager;
  const pagerRef = useRef(null);

  // Changing page brings the top of the list back into view (long pages on phones).
  const setPage = (p) => {
    pager.setPage(p);
    pagerRef.current?.closest('.card, .report-sheet')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  if (total <= SIZES[0]) return null;

  const shownTo = Math.min(from + size, total);

  return (
    <div className="pager d-print-none" ref={pagerRef}>
      <div className="pager-info">
        Showing <strong>{from + 1}–{shownTo}</strong> of <strong>{total}</strong> {noun}
      </div>

      <div className="pager-controls">
        <label className="pager-size">
          <span className="d-none d-sm-inline">Rows</span>
          <select className="form-select form-select-sm" value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Rows per page">
            {SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        <nav className="pager-nav" aria-label="Pages">
          <button type="button" className="pager-btn" disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
            <i className="bi bi-chevron-left"></i>
          </button>

          {/* Phones: just “2 / 6”; wider screens get numbered pages */}
          <span className="pager-compact">{page} / {pages}</span>
          {windowed(page, pages).map((p, i) => (
            p === 'gap'
              ? <span key={`g${i}`} className="pager-gap">…</span>
              : (
                <button key={p} type="button" className={`pager-btn pager-num ${p === page ? 'active' : ''}`} onClick={() => setPage(p)} aria-current={p === page ? 'page' : undefined}>
                  {p}
                </button>
              )
          ))}

          <button type="button" className="pager-btn" disabled={page === pages} onClick={() => setPage(page + 1)} aria-label="Next page">
            <i className="bi bi-chevron-right"></i>
          </button>
        </nav>
      </div>
    </div>
  );
}
