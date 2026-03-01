export default function StatusBadge({ status }) {
  const map = {
    draft:    'bg-yellow-100 text-yellow-800 border-yellow-300',
    approved: 'bg-green-100 text-green-800 border-green-300',
    rejected: 'bg-red-100 text-red-800 border-red-300',
    sent:     'bg-blue-100 text-blue-800 border-blue-300',
  }
  const cls = map[status] || 'bg-gray-100 text-gray-700 border-gray-300'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls} capitalize`}>
      {status}
    </span>
  )
}
