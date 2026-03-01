import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCampaignAnalytics, sendCampaign } from '../api/client'
import StatusBadge from '../components/StatusBadge'

function GaugeBar({ label, value, max = 1, color = 'bg-blue-500' }) {
  const pct = Math.min(Math.round((value / max) * 100), 100)
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-bold text-gray-900">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <div className={`${color} h-2.5 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Analytics() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [sendMsg, setSendMsg] = useState(null)

  const fetchAnalytics = () => {
    setLoading(true)
    getCampaignAnalytics(id)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAnalytics() }, [id])

  const handleSend = async () => {
    setSending(true)
    setError(null)
    try {
      const res = await sendCampaign(id)
      setSendMsg(res.data.message)
      fetchAnalytics()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) return <Spinner />
  if (error && !data) return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <p className="text-red-600 font-semibold">{error}</p>
    </div>
  )

  const campaign = data?.campaign || {}
  const perf = data?.performance
  const insights = data?.learning_insights

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-blue-600 text-sm font-medium mb-1">
        <button onClick={() => navigate('/')} className="hover:underline">Dashboard</button>
        <span>/</span>
        <button onClick={() => navigate(`/campaign/${id}/preview`)} className="hover:underline">Campaign #{id}</button>
        <span>/</span>
        <span>Analytics</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaign Analytics</h1>
          <p className="text-gray-500 text-sm mt-1 max-w-xl">{campaign.objective}</p>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      {sendMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-4">
          {sendMsg}
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">
          {error}
        </div>
      )}

      {/* Send Button */}
      {campaign.status === 'approved' && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold text-blue-800 text-sm">Campaign is approved and ready to send</p>
            <p className="text-blue-700 text-xs mt-0.5">Simulate sending emails to all {campaign.segmentation_json?.selected_user_count ?? '—'} selected recipients.</p>
          </div>
          <button
            onClick={handleSend}
            disabled={sending}
            className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition disabled:opacity-60 flex items-center gap-2"
          >
            {sending ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Sending...
              </>
            ) : 'Send Campaign'}
          </button>
        </div>
      )}

      {/* Performance Metrics */}
      {perf ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard value={perf.emails_sent} label="Emails Sent" color="text-blue-700" bg="bg-blue-50" />
            <StatCard value={perf.emails_opened} label="Emails Opened" color="text-green-700" bg="bg-green-50" />
            <StatCard value={perf.emails_clicked} label="Clicked CTA" color="text-purple-700" bg="bg-purple-50" />
            <StatCard value={`${((perf.sentiment_score || 0) * 100).toFixed(0)}%`} label="Sentiment Score" color="text-amber-700" bg="bg-amber-50" />
          </div>

          {/* Rate Bars */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Performance Rates</h3>
            <GaugeBar label="Open Rate" value={perf.open_rate || 0} color="bg-green-500" />
            <GaugeBar label="Click Rate" value={perf.click_rate || 0} color="bg-blue-500" />
            <GaugeBar label="Sentiment Score" value={perf.sentiment_score || 0} color="bg-amber-400" />
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center mb-6">
          <p className="text-4xl mb-2">📊</p>
          <p className="text-gray-600 font-medium">No performance data yet</p>
          <p className="text-gray-400 text-sm mt-1">Performance metrics will appear after the campaign is sent.</p>
        </div>
      )}

      {/* AI Learning Loop Insights */}
      {insights && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🧠</span>
            <h2 className="font-semibold text-gray-800">AI Learning Loop Insights</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              insights.engagement_level === 'high'
                ? 'bg-green-100 text-green-700'
                : 'bg-orange-100 text-orange-700'
            }`}>
              {insights.engagement_level === 'high' ? 'High Engagement' : 'Low Engagement'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-4">{insights.open_rate_vs_threshold}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InsightCard icon="🎨" title="Tone Recommendation" value={insights.tone_recommendation} />
            <InsightCard icon="👥" title="Persona Recommendation" value={insights.persona_recommendation} />
            <InsightCard icon="🔗" title="CTA Assessment" value={insights.click_through_assessment} />
          </div>
        </div>
      )}

      {/* Campaign Summary */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Campaign Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <InfoCell label="Goal" value={campaign.strategy_json?.campaign_goal} />
          <InfoCell label="Tone" value={campaign.strategy_json?.tone} />
          <InfoCell label="Subject" value={campaign.email_json?.subject_line} />
          <InfoCell label="CTA" value={campaign.email_json?.cta_text} />
        </div>
        {campaign.approved_by && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
            Approved by <strong className="text-gray-600">{campaign.approved_by}</strong>
            {campaign.approval_timestamp && ` on ${new Date(campaign.approval_timestamp).toLocaleString('en-IN')}`}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ value, label, color, bg }) {
  return (
    <div className={`${bg} rounded-xl p-4 text-center`}>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 font-medium mt-1">{label}</p>
    </div>
  )
}

function InsightCard({ icon, title, value }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
      <p className="text-lg mb-1">{icon}</p>
      <p className="text-xs font-semibold text-gray-600 mb-1">{title}</p>
      <p className="text-xs text-gray-700">{value}</p>
    </div>
  )
}

function InfoCell({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-700 capitalize">{value || '—'}</p>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-32">
      <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
    </div>
  )
}
