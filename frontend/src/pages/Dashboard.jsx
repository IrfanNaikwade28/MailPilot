import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listCampaigns } from '../api/client'
import StatusBadge from '../components/StatusBadge'

const S = {
  page: { maxWidth: 1000, margin: '0 auto', padding: '32px 24px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  title: { fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 },
  statBox: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 16px', textAlign: 'center' },
  statNum: { fontSize: 26, fontWeight: 700, margin: 0 },
  statLabel: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  table: { width: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, borderCollapse: 'collapse', overflow: 'hidden' },
  th: { padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#6b7280', textAlign: 'left', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', letterSpacing: '0.05em' },
  td: { padding: '12px 16px', fontSize: 14, color: '#374151', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  trHover: { cursor: 'pointer' },
  btn: { background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 14, fontWeight: 600 },
  btnSm: { background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 5, padding: '5px 10px', fontSize: 12, fontWeight: 500, marginLeft: 4 },
  btnSmPrimary: { background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 5, padding: '5px 10px', fontSize: 12, fontWeight: 500, marginLeft: 4 },
  empty: { textAlign: 'center', padding: '60px 24px', color: '#6b7280' },
}

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    listCampaigns()
      .then((res) => setCampaigns(res.data))
      .finally(() => setLoading(false))
  }, [])

  const counts = {
    total: campaigns.length,
    draft: campaigns.filter(c => c.status === 'draft').length,
    approved: campaigns.filter(c => c.status === 'approved').length,
    sent: campaigns.filter(c => c.status === 'sent').length,
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Campaigns</h1>
          <p style={S.subtitle}>BFSI email marketing campaigns managed by the AI pipeline.</p>
        </div>
        <button style={S.btn} onClick={() => navigate('/create')}>
          New Campaign
        </button>
      </div>

      <div style={S.stats}>
        {[
          { label: 'Total', value: counts.total, color: '#111827' },
          { label: 'Draft', value: counts.draft, color: '#92400e' },
          { label: 'Approved', value: counts.approved, color: '#166534' },
          { label: 'Sent', value: counts.sent, color: '#1e40af' },
        ].map((s) => (
          <div key={s.label} style={S.statBox}>
            <p style={{ ...S.statNum, color: s.color }}>{s.value}</p>
            <p style={S.statLabel}>{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>Loading...</div>
      ) : campaigns.length === 0 ? (
        <div style={{ ...S.table, ...S.empty }}>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No campaigns yet</p>
          <p style={{ fontSize: 14, marginBottom: 20 }}>Create your first campaign using the AI pipeline.</p>
          <button style={S.btn} onClick={() => navigate('/create')}>Create Campaign</button>
        </div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>#</th>
              <th style={S.th}>Objective</th>
              <th style={S.th}>Subject</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Date</th>
              <th style={S.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr
                key={c.id}
                style={S.trHover}
                onClick={() => navigate(`/campaign/${c.id}/preview`)}
                onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <td style={{ ...S.td, color: '#9ca3af', width: 40 }}>{c.id}</td>
                <td style={{ ...S.td, maxWidth: 280 }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.objective}
                  </span>
                </td>
                <td style={{ ...S.td, maxWidth: 200, color: '#6b7280' }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.email_json?.subject_line || '—'}
                  </span>
                </td>
                <td style={S.td}><StatusBadge status={c.status} /></td>
                <td style={{ ...S.td, whiteSpace: 'nowrap', color: '#6b7280' }}>
                  {c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '—'}
                </td>
                <td style={S.td} onClick={e => e.stopPropagation()}>
                  <button style={S.btnSm} onClick={() => navigate(`/campaign/${c.id}/preview`)}>Preview</button>
                  {c.status === 'draft' && (
                    <button style={S.btnSmPrimary} onClick={() => navigate(`/campaign/${c.id}/approve`)}>Approve</button>
                  )}
                  {(c.status === 'approved' || c.status === 'sent') && (
                    <button style={S.btnSm} onClick={() => navigate(`/campaign/${c.id}/analytics`)}>Analytics</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
