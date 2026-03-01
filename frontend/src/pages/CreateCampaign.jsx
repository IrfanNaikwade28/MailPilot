import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createCampaign, seedUsers } from '../api/client'

const EXAMPLE_OBJECTIVES = [
  'Promote our new home loan product targeting salaried professionals in Maharashtra with competitive interest rates',
  'Launch a term insurance awareness campaign for working professionals aged 25-40 across metro cities in India',
  'Drive credit card applications among high-income IT professionals in Bangalore and Hyderabad',
  'Promote our mutual fund SIP plans targeting first-time investors with monthly income above ₹50,000',
]

export default function CreateCampaign() {
  const [objective, setObjective] = useState('')
  const [loading, setLoading] = useState(false)
  const [seedLoading, setSeedLoading] = useState(false)
  const [error, setError] = useState(null)
  const [seedMsg, setSeedMsg] = useState(null)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!objective.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await createCampaign(objective.trim())
      navigate(`/campaign/${res.data.campaign_id}/preview`)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleSeed = async () => {
    setSeedLoading(true)
    setSeedMsg(null)
    try {
      const res = await seedUsers()
      setSeedMsg(res.data.message)
    } catch (err) {
      setSeedMsg('Error: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSeedLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-blue-600 text-sm font-medium mb-2">
          <span>Dashboard</span>
          <span>/</span>
          <span>New Campaign</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Create Email Campaign</h1>
        <p className="text-gray-500 mt-1">
          Describe your campaign objective in plain English. Our multi-agent AI will plan, write, and validate the campaign for you.
        </p>
      </div>

      {/* Seed Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-amber-800">First time? Seed demo users</p>
          <p className="text-xs text-amber-700 mt-0.5">Load 30 sample Indian BFSI users into the database for segmentation testing.</p>
          {seedMsg && <p className="text-xs mt-1 text-green-700 font-medium">{seedMsg}</p>}
        </div>
        <button
          onClick={handleSeed}
          disabled={seedLoading}
          className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-60"
        >
          {seedLoading ? 'Seeding...' : 'Seed Users'}
        </button>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Campaign Objective
          <span className="text-red-500 ml-1">*</span>
        </label>
        <textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          rows={5}
          placeholder="e.g. Promote our new home loan product targeting salaried professionals in Maharashtra..."
          className="w-full border border-gray-300 rounded-xl p-4 text-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none transition"
        />
        <p className="text-xs text-gray-400 mt-1">{objective.length} characters — minimum 10 required</p>

        {/* Example Prompts */}
        <div className="mt-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Example objectives</p>
          <div className="grid gap-2">
            {EXAMPLE_OBJECTIVES.map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setObjective(ex)}
                className="text-left text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-3 py-2 transition"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || objective.trim().length < 10}
          className="mt-6 w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 px-6 rounded-xl text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Running AI Agents (this takes ~30–60s)...
            </>
          ) : (
            'Launch Multi-Agent Pipeline'
          )}
        </button>
      </form>

      {/* Agent Flow Diagram */}
      <div className="mt-8 bg-gray-50 rounded-2xl border border-gray-200 p-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Agent Pipeline</p>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { icon: '🎯', label: 'Strategy Agent' },
            { icon: '✍️', label: 'Content Agent' },
            { icon: '🛡️', label: 'Compliance Agent' },
            { icon: '👥', label: 'Segmentation Agent' },
            { icon: '👤', label: 'Human Approval' },
          ].map((step, i, arr) => (
            <div key={i} className="flex items-center gap-2">
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-center shadow-xs">
                <p className="text-lg">{step.icon}</p>
                <p className="text-xs text-gray-600 font-medium">{step.label}</p>
              </div>
              {i < arr.length - 1 && <span className="text-gray-400 font-bold">→</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
