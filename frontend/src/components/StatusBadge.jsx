export default function StatusBadge({ status }) {
  const map = {
    draft:    { label: 'Draft',    bg: '#fef9c3', color: '#854d0e' },
    approved: { label: 'Approved', bg: '#dcfce7', color: '#166534' },
    rejected: { label: 'Rejected', bg: '#fee2e2', color: '#991b1b' },
    sent:     { label: 'Sent',     bg: '#dbeafe', color: '#1e40af' },
  }
  const s = map[status] || { label: status, bg: '#f3f4f6', color: '#374151' }
  return (
    <span style={{
      display: 'inline-block',
      background: s.bg,
      color: s.color,
      fontSize: 12,
      fontWeight: 600,
      padding: '2px 10px',
      borderRadius: 20,
    }}>
      {s.label}
    </span>
  )
}
