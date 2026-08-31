export default function StatCard({ icon, label, value, sublabel, variant, action }) {
  return (
    <div className={`card stat-card h-100 ${variant || ''}`}>
      <div className="card-body d-flex align-items-start justify-content-between gap-3">
        <div className="d-flex align-items-start gap-3">
          <span className="stat-icon flex-shrink-0"><i className={`bi ${icon}`}></i></span>
          <div>
            <div className="text-secondary small text-uppercase fw-semibold">{label}</div>
            <div className="fs-3 fw-bold lh-sm">{value}</div>
            {sublabel && <div className="text-secondary small">{sublabel}</div>}
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}
