export default function Navbar() {
  return (
    <nav className="bg-blue-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-400 rounded-lg flex items-center justify-center font-bold text-blue-900 text-lg">
            M
          </div>
          <div>
            <p className="font-bold text-lg leading-none">BFSI CampaignAI</p>
            <p className="text-blue-300 text-xs">Multi-Agent Email Marketing System</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs bg-blue-800 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 bg-green-400 rounded-full inline-block animate-pulse"></span>
          <span className="text-blue-200">Powered by LLaMA3-70B via Groq</span>
        </div>
      </div>
    </nav>
  )
}
