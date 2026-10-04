/** Placeholder shown while a page loads - feels faster than a lone spinner. */
export default function PageSkeleton({ rows = 5 }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="row g-3 mb-3">
        {[0, 1, 2].map((i) => (
          <div className="col-md-4" key={i}>
            <div className="card"><div className="card-body d-flex gap-3 align-items-center">
              <div className="p-skel" style={{ width: 46, height: 46, borderRadius: 14 }} />
              <div className="flex-grow-1">
                <div className="p-skel mb-2" style={{ height: 10, width: '55%' }} />
                <div className="p-skel" style={{ height: 22, width: '75%' }} />
              </div>
            </div></div>
          </div>
        ))}
      </div>
      <div className="card"><div className="card-body">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="p-skel mb-3" style={{ height: 16, width: `${95 - (i % 3) * 12}%` }} />
        ))}
      </div></div>
    </div>
  );
}
