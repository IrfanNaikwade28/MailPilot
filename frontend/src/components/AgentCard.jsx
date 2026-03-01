export default function AgentCard({ icon, title, status, children }) {
  const statusColor = {
    running: 'border-l-yellow-400',
    done:    'border-l-green-400',
    error:   'border-l-red-400',
    idle:    'border-l-gray-300',
  }[status || 'idle']

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${statusColor} shadow-sm p-5`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="font-semibold text-gray-800 text-sm">{title}</p>
          {status && (
            <p className={`text-xs font-medium capitalize ${
              status === 'done' ? 'text-green-600' :
              status === 'running' ? 'text-yellow-600' :
              status === 'error' ? 'text-red-600' : 'text-gray-400'
            }`}>
              {status === 'running' ? 'Processing...' : status === 'done' ? 'Complete' : status}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}
