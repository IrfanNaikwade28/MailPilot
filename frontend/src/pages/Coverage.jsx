import { useState, useEffect } from 'react'
import { getCoverageStats, getUncoveredIds, listCampaignsWithStats } from '../api/client'

const S = {
  page: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px' },
  header: { marginBottom: 28 },
  title: { fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  statsRow: { display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' },
  statCard: { flex: '1 1 150px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '18px 22px' },
  statLabel: { fontSize: 12, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' },
  statValue: { fontSize: 30, fontWeight: 700, color: '#111827', marginTop: 4 },
  statSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  scoreCard: {
    flex: '1 1 150px',
    borderRadius: 10,
    padding: '18px 22px',
    background: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)',
  },
  scoreLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' },
  scoreValue: { fontSize: 30, fontWeight: 700, color: '#fff', marginTop: 4 },
  scoreSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  progressWrap: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '20px 24px', marginBottom: 28 },
  progressLabel: { display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#374151' },
  progressBar: { height: 14, background: '#e5e7eb', borderRadius: 7, overflow: 'hidden' },
  progressFill: (pct) => ({
    height: '100%',
    width: `${pct}%`,
    background: pct === 100 ? '#16a34a' : pct > 50 ? '#2563eb' : '#f59e0b',
    borderRadius: 7,
    transition: 'width 0.5s ease',
  }),
  section: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '20px 24px', marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 14 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 600, fontSize: 12 },
  thR: { textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 600, fontSize: 12 },
  td: { padding: '9px 10px', borderBottom: '1px solid #f3f4f6', color: '#374151' },
  tdR: { padding: '9px 10px', borderBottom: '1px solid #f3f4f6', color: '#374151', textAlign: 'right' },
  badge: (n) => ({
    display: 'inline-block',
    background: n > 0 ? '#eff6ff' : '#f0fdf4',
    color: n > 0 ? '#1d4ed8' : '#16a34a',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 12,
    fontWeight: 600,
  }),
  pill: (color, bg) => ({
    display: 'inline-block',
    background: bg,
    color: color,
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 12,
    fontWeight: 600,
  }),
  uncoveredBox: { maxHeight: 240, overflowY: 'auto', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: 12, fontSize: 12, color: '#374151', lineHeight: 1.8, wordBreak: 'break-all' },
  refreshBtn: { padding: '8px 16px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  error: { color: '#dc2626', fontSize: 13, marginTop: 8 },
  empty: { color: '#6b7280', fontSize: 13, fontStyle: 'italic' },
}

export default function Coverage() {
  const [stats, setStats] = useState(null)
  const [uncovered, setUncovered] = useState(null)
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [sRes, uRes, cRes] = await Promise.all([
        getCoverageStats(),
        getUncoveredIds(),
        listCampaignsWithStats(),
      ])
      setStats(sRes.data)
      setUncovered(uRes.data)
      setCampaigns(cRes.data)
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Failed to load coverage data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const pct = stats ? Math.round((stats.covered_count / (stats.total_cohort_size || 1)) * 100) : 0

  // Only sent campaigns with coverage data
  const sentCampaigns = campaigns.filter(c => c.status === 'sent')

  // Aggregate totals from perf
  const totalOpened = sentCampaigns.reduce((s, c) => s + (c.perf?.emails_opened ?? 0), 0)
  const totalClicked = sentCampaigns.reduce((s, c) => s + (c.perf?.emails_clicked ?? 0), 0)

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Cohort Coverage</h1>
        <p style={S.subtitle}>Track which customers have been targeted and campaign-level EO/EC contribution.</p>
      </div>

      {error && <div style={S.error}>{error}</div>}

      {loading ? (
        <div style={S.empty}>Loading coverage data...</div>
      ) : stats ? (
        <>
          {/* Stat cards */}
          <div style={S.statsRow}>
            <div style={S.statCard}>
              <div style={S.statLabel}>Total Cohort</div>
              <div style={S.statValue}>{stats.total_cohort_size.toLocaleString()}</div>
              <div style={S.statSub}>customers in evaluation window</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>Covered</div>
              <div style={{ ...S.statValue, color: '#16a34a' }}>{stats.covered_count.toLocaleString()}</div>
              <div style={S.statSub}>customers targeted at least once</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>Uncovered</div>
              <div style={{ ...S.statValue, color: stats.uncovered_count > 0 ? '#f59e0b' : '#16a34a' }}>
                {stats.uncovered_count.toLocaleString()}
              </div>
              <div style={S.statSub}>customers not yet targeted</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>Coverage</div>
              <div style={{ ...S.statValue, color: pct === 100 ? '#16a34a' : '#1d4ed8' }}>{pct}%</div>
              <div style={S.statSub}>of cohort covered</div>
            </div>
            <div style={{ ...S.statCard, background: '#f0fdf4' }}>
              <div style={{ ...S.statLabel, color: '#166534' }}>Opens (EO=Y)</div>
              <div style={{ ...S.statValue, color: '#15803d' }}>{totalOpened}</div>
              <div style={S.statSub}>across all sent campaigns</div>
            </div>
            <div style={{ ...S.statCard, background: '#faf5ff' }}>
              <div style={{ ...S.statLabel, color: '#6b21a8' }}>Clicks (EC=Y)</div>
              <div style={{ ...S.statValue, color: '#7c3aed' }}>{totalClicked}</div>
              <div style={S.statSub}>across all sent campaigns</div>
            </div>
            <div style={S.scoreCard}>
              <div style={S.scoreLabel}>EO + EC Score</div>
              <div style={S.scoreValue}>{(totalOpened + totalClicked).toLocaleString()}</div>
              <div style={S.scoreSub}>hackathon raw score</div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={S.progressWrap}>
            <div style={S.progressLabel}>
              <span>Coverage Progress</span>
              <span>{stats.covered_count} / {stats.total_cohort_size}</span>
            </div>
            <div style={S.progressBar}>
              <div style={S.progressFill(pct)} />
            </div>
          </div>

          {/* Per-campaign table */}
          <div style={S.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={S.sectionTitle}>Campaign Breakdown</div>
              <button style={S.refreshBtn} onClick={load}>Refresh</button>
            </div>
            {sentCampaigns.length > 0 ? (
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>ID</th>
                    <th style={S.th}>Objective</th>
                    <th style={{ ...S.th, textAlign: 'center' }}>Recipients</th>
                    <th style={{ ...S.th, textAlign: 'center' }}>Opens (EO=Y)</th>
                    <th style={{ ...S.th, textAlign: 'center' }}>Clicks (EC=Y)</th>
                    <th style={{ ...S.th, textAlign: 'center' }}>EO+EC</th>
                    <th style={{ ...S.th, textAlign: 'center' }}>Open Rate</th>
                    <th style={{ ...S.th, textAlign: 'center' }}>Click Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {sentCampaigns.map((c) => {
                    const perf = c.perf
                    const score = perf ? perf.emails_opened + perf.emails_clicked : null
                    return (
                      <tr key={c.id}>
                        <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12, color: '#9ca3af' }}>#{c.id}</td>
                        <td style={{ ...S.td, maxWidth: 280 }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.objective}
                          </span>
                        </td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          {perf
                            ? <span style={S.badge(0)}>{perf.emails_sent.toLocaleString()}</span>
                            : '—'}
                        </td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          {perf
                            ? <span style={S.pill('#15803d', '#dcfce7')}>{perf.emails_opened}</span>
                            : '—'}
                        </td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          {perf
                            ? <span style={S.pill('#6b21a8', '#f3e8ff')}>{perf.emails_clicked}</span>
                            : '—'}
                        </td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          {score !== null
                            ? <span style={{ fontWeight: 700, color: '#1d4ed8' }}>{score}</span>
                            : '—'}
                        </td>
                        <td style={{ ...S.td, textAlign: 'center', color: '#6b7280' }}>
                          {perf ? `${(perf.open_rate * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ ...S.td, textAlign: 'center', color: '#6b7280' }}>
                          {perf ? `${(perf.click_rate * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div style={S.empty}>No campaigns have been sent yet.</div>
            )}
          </div>

          {/* Uncovered IDs */}
          {uncovered && uncovered.length > 0 && (
            <div style={S.section}>
              <div style={S.sectionTitle}>Uncovered Customer IDs ({uncovered.length})</div>
              <div style={S.uncoveredBox}>
                {uncovered.join(', ')}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
