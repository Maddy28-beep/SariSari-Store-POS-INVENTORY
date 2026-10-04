import { useEffect, useRef, useState } from 'react';

/** Counts numeric values up on first show (e.g. "₱1,250.00"), leaves other text as is. */
function useCountUp(value) {
  const text = String(value);
  const match = text.match(/^(\D*)(-?[\d,]*\.?\d+)(.*)$/);
  const [shown, setShown] = useState(text);
  const frame = useRef();

  useEffect(() => {
    if (!match || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(text);
      return;
    }
    const [, prefix, numStr, suffix] = match;
    const target = Number(numStr.replace(/,/g, ''));
    const decimals = (numStr.split('.')[1] || '').length;
    const start = performance.now();
    const duration = 650;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const current = (target * eased).toFixed(decimals);
      setShown(`${prefix}${Number(current).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return shown;
}

export default function StatCard({ icon, label, value, sublabel, variant, action }) {
  const shown = useCountUp(value);
  return (
    <div className={`card stat-card h-100 ${variant || ''}`}>
      <div className="card-body d-flex align-items-center justify-content-between gap-3">
        <div className="d-flex align-items-center gap-3 min-w-0">
          <span className="stat-icon flex-shrink-0"><i className={`bi ${icon}`}></i></span>
          <div className="min-w-0">
            <div className="text-secondary small text-uppercase fw-semibold">{label}</div>
            {sublabel && <div className="text-secondary small">{sublabel}</div>}
          </div>
        </div>
        <div className="stat-value text-end flex-shrink-0">
          <div className="fs-3 fw-bold lh-sm">{shown}</div>
          {action && <div className="mt-1">{action}</div>}
        </div>
      </div>
    </div>
  );
}
