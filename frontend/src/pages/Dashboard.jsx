import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listCampaignsWithStats } from '../api/client'
import StatusBadge from '../components/StatusBadge'

const S = {
  page: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  title: { fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },

  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 28 },
  statBox: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 12px', textAlign: 'center' },
  statNum: { fontSize: 22, fontWeight: 700, margin: 0 },
  statLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2, lineHeight: 1.3 },

  scoreBox: {
    background: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)',
    border: 'none',
    borderRadius: 8,
    padding: '14px 12px',
    textAlign: 'center',
    gridColumn: 'span 2',
  },
  scoreNum: { fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 },
  scoreLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  table: { width: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, borderCollapse: 'collapse', overflow: 'hidden' },
  th: { padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#6b7280', textAlign: 'left', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', letterSpacing: '0.05em' },
  td: { padding: '11px 12px', fontSize: 13, color: '#374151', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  trHover: { cursor: 'pointer' },
  btn: { background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnSm: { background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 5, padding: '5px 9px', fontSize: 12, fontWeight: 500, marginLeft: 4, cursor: 'pointer' },
  btnSmPrimary: { background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 5, padding: '5px 9px', fontSize: 12, fontWeight: 500, marginLeft: 4, cursor: 'pointer' },
  empty: { textAlign: 'center', padding: '60px 24px', color: '#6b7280' },

  pill: (color, bg) => ({
    display: 'inline-block',
    background: bg,
    color: color,
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 12,
    fontWeight: 600,
  }),
}

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    listCampaignsWithStats()
      .then((res) => setCampaigns(res.data))
      .finally(() => setLoading(false))
  }, [])

  const counts = {
    total: campaigns.length,
    draft: campaigns.filter(c => c.status === 'draft').length,
    approved: campaigns.filter(c => c.status === 'approved').length,
    sent: campaigns.filter(c => c.status === 'sent').length,
  }

  const totalOpened = campaigns.reduce((s, c) => s + (c.perf?.emails_opened ?? 0), 0)
  const totalClicked = campaigns.reduce((s, c) => s + (c.perf?.emails_clicked ?? 0), 0)
  const totalScore = totalOpened + totalClicked

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Campaigns</h1>
          <p style={S.subtitle}>Email marketing campaigns managed by the AI pipeline — FrostHack XPECTO 2026.</p>
        </div>
        <button style={S.btn} onClick={() => navigate('/create')}>
          New Campaign
        </button>
      </div>

      {/* Stat cards */}
      <div style={S.statsRow}>
        {/* Hackathon score — spans 2 columns */}
        <div style={S.scoreBox}>
          <p style={S.scoreNum}>{totalScore.toLocaleString()}</p>
          <p style={S.scoreLabel}>EO + EC Score</p>
        </div>

        <div style={S.statBox}>
          <p style={{ ...S.statNum, color: '#15803d' }}>{totalOpened}</p>
          <p style={S.statLabel}>Total Opens (EO=Y)</p>
        </div>
        <div style={S.statBox}>
          <p style={{ ...S.statNum, color: '#7c3aed' }}>{totalClicked}</p>
          <p style={S.statLabel}>Total Clicks (EC=Y)</p>
        </div>
        <div style={S.statBox}>
          <p style={{ ...S.statNum, color: '#111827' }}>{counts.total}</p>
          <p style={S.statLabel}>Campaigns</p>
        </div>
        <div style={S.statBox}>
          <p style={{ ...S.statNum, color: '#1e40af' }}>{counts.sent}</p>
          <p style={S.statLabel}>Sent</p>
        </div>
        <div style={S.statBox}>
          <p style={{ ...S.statNum, color: '#166534' }}>1,000</p>
          <p style={S.statLabel}>Cohort Coverage</p>
        </div>
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
              <th style={{ ...S.th, textAlign: 'center' }}>Opens</th>
              <th style={{ ...S.th, textAlign: 'center' }}>Clicks</th>
              <th style={{ ...S.th, textAlign: 'center' }}>EO+EC</th>
              <th style={S.th}>Date</th>
              <th style={S.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const opens = c.perf?.emails_opened ?? null
              const clicks = c.perf?.emails_clicked ?? null
              const score = opens !== null && clicks !== null ? opens + clicks : null
              return (
                <tr
                  key={c.id}
                  style={S.trHover}
                  onClick={() => navigate(`/campaign/${c.id}/preview`)}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ ...S.td, color: '#9ca3af', width: 36 }}>{c.id}</td>
                  <td style={{ ...S.td, maxWidth: 240 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.objective}
                    </span>
                  </td>
                  <td style={{ ...S.td, maxWidth: 180, color: '#6b7280' }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.email_json?.subject_line || '—'}
                    </span>
                  </td>
                  <td style={S.td}><StatusBadge status={c.status} /></td>
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    {opens !== null
                      ? <span style={S.pill('#15803d', '#dcfce7')}>{opens}</span>
                      : <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    {clicks !== null
                      ? <span style={S.pill('#6b21a8', '#f3e8ff')}>{clicks}</span>
                      : <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    {score !== null
                      ? <span style={{ fontWeight: 700, color: '#1d4ed8' }}>{score}</span>
                      : <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
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
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
