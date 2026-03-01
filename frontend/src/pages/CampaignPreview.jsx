import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCampaign } from '../api/client'
import AgentCard from '../components/AgentCard'
import StatusBadge from '../components/StatusBadge'

export default function CampaignPreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCampaign(id)
      .then((res) => setCampaign(res.data))
      .catch((err) => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <LoadingState />
  if (error) return <ErrorState error={error} />
  if (!campaign) return null

  const strategy = campaign.strategy_json || {}
  const email = campaign.email_json || {}
  const seg = campaign.segmentation_json || {}
  const compliance = campaign.compliance_json || {}

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-blue-600 text-sm font-medium mb-1">
            <button onClick={() => navigate('/')} className="hover:underline">Dashboard</button>
            <span>/</span>
            <span>Campaign #{id}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Campaign Preview</h1>
          <p className="text-gray-500 text-sm mt-1 max-w-2xl">{campaign.objective}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={campaign.status} />
          {campaign.status === 'draft' && (
            <button
              onClick={() => navigate(`/campaign/${id}/approve`)}
              className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2 rounded-xl transition"
            >
              Review & Approve
            </button>
          )}
          {campaign.status === 'approved' && (
            <button
              onClick={() => navigate(`/campaign/${id}/analytics`)}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition"
            >
              View Analytics
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Strategy Agent Output */}
        <AgentCard icon="🎯" title="Strategy Agent" status="done">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Campaign Goal" value={strategy.campaign_goal} />
            <Field label="Tone" value={strategy.tone} />
            <Field label="Target Persona" value={strategy.target_persona} fullWidth />
            <Field label="CTA Strategy" value={strategy.cta_strategy} fullWidth />
          </div>
          {strategy.reasoning && (
            <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Agent Reasoning</p>
              <p className="text-xs text-blue-800">{strategy.reasoning}</p>
            </div>
          )}
        </AgentCard>

        {/* Segmentation Agent Output */}
        <AgentCard icon="👥" title="Segmentation Agent" status="done">
          <div className="grid grid-cols-3 gap-4 text-sm mb-3">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-blue-700">{seg.selected_user_count ?? '—'}</p>
              <p className="text-xs text-blue-600 font-medium mt-1">Users Selected</p>
            </div>
            <div className="col-span-2">
              <Field label="Filters Applied" value={seg.filters_applied} />
            </div>
          </div>
          {seg.reasoning && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Segmentation Reasoning</p>
              <p className="text-xs text-blue-800">{seg.reasoning}</p>
            </div>
          )}
        </AgentCard>

        {/* Compliance Agent Output */}
        <AgentCard icon="🛡️" title="Compliance Agent" status={compliance.is_compliant ? 'done' : 'error'}>
          <div className="flex items-center gap-3 mb-3">
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${
              compliance.is_compliant
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {compliance.is_compliant ? '✓ COMPLIANT' : '✗ NON-COMPLIANT'}
            </span>
          </div>
          {compliance.issues_found?.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-red-600 mb-1">Issues Found:</p>
              <ul className="text-xs text-red-700 list-disc pl-4 space-y-0.5">
                {compliance.issues_found.map((issue, i) => <li key={i}>{issue}</li>)}
              </ul>
            </div>
          )}
          {compliance.issues_found?.length === 0 && (
            <p className="text-xs text-green-700">No compliance issues detected. Email meets all BFSI regulatory guidelines.</p>
          )}
        </AgentCard>
      </div>

      {/* Navigation */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/campaign/${id}/email`)}
          className="bg-white border border-gray-300 hover:border-blue-400 text-gray-700 hover:text-blue-700 text-sm font-medium px-5 py-2.5 rounded-xl transition"
        >
          View Email Content
        </button>
        {campaign.status === 'draft' && (
          <button
            onClick={() => navigate(`/campaign/${id}/approve`)}
            className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
          >
            Go to Approval Dashboard
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, fullWidth }) {
  return (
    <div className={fullWidth ? 'col-span-2' : ''}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-gray-800">{value || '—'}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-20 text-center">
      <div className="inline-flex items-center gap-3 text-gray-500">
        <svg className="animate-spin w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        <span className="text-lg font-medium">Loading campaign data...</span>
      </div>
    </div>
  )
}

function ErrorState({ error }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-20 text-center">
      <p className="text-red-600 font-semibold text-lg">Failed to load campaign</p>
      <p className="text-gray-500 text-sm mt-1">{error}</p>
    </div>
  )
}
