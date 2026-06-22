'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

export default function RolesPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [drawResult, setDrawResult] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      loadRoles()
    })
  }, [])

  async function loadRoles() {
    const { data } = await supabase.from('roles').select('*').order('created_at', { ascending: false })
    setRoles(data || [])
    setLoading(false)
  }

  async function runDrawing() {
    setRunning(true)
    // Get volunteers interested in roles
    const { data: pool } = await supabase
      .from('volunteers')
      .select('*')
      .neq('role_interest', 'volunteer_only')
    if (!pool || pool.length === 0) {
      setDrawResult('No volunteers available for role drawing yet.')
      setRunning(false)
      return
    }
    // Random selection
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const messenger1 = shuffled[0]
    const messenger2 = shuffled[1] || null
    const verifier = shuffled[2] || null

    const termStart = new Date().toISOString()
    const termEnd = new Date(Date.now() + 180 * 86400000).toISOString() // 6 months

    await supabase.from('roles').insert([
      { role: 'Messenger 1', volunteer_id: messenger1.id, address_number: messenger1.address_number, term_start: termStart, term_end: termEnd, active: true },
      ...(messenger2 ? [{ role: 'Messenger 2', volunteer_id: messenger2.id, address_number: messenger2.address_number, term_start: termStart, term_end: termEnd, active: true }] : []),
      ...(verifier ? [{ role: 'Verifier 1', volunteer_id: verifier.id, address_number: verifier.address_number, term_start: termStart, term_end: termEnd, active: true }] : []),
    ])

    setDrawResult(`Drawing complete! New roles assigned for the next 6 months.`)
    loadRoles()
    setRunning(false)
  }

  const roleColor: Record<string, string> = {
    'Messenger 1': 'bg-green-50 text-green-700',
    'Messenger 2': 'bg-blue-50 text-blue-700',
    'Verifier 1':  'bg-amber-50 text-amber-700',
    'Judge':       'bg-purple-50 text-purple-700',
  }

  const activeRoles = roles.filter(r => r.active)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-semibold text-gray-900">Roles &amp; selection</h1>
          <p className="text-xs text-gray-400 mt-0.5">Random drawing · no voting · no politics</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* How it works */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">How selection works</p>
          <div className="space-y-2 text-xs text-gray-600 leading-relaxed">
            <p>• Residents volunteer by joining the pool and selecting a role interest</p>
            <p>• Admin runs a random drawing — no campaigns, no favoritism</p>
            <p>• Positions run for <strong>6 months</strong>, then a new drawing is held</p>
            <p>• Same person can re-enter for the next term</p>
            <p>• Messengers cannot report personal complaints during their term</p>
          </div>
        </div>

        {/* Current roles */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h2 className="text-sm font-medium text-gray-700">Current role holders</h2>
          </div>
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Loading...</div>
          ) : activeRoles.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">No roles assigned yet</p>
              <p className="text-xs text-gray-300 mt-1">Run the drawing below to assign roles</p>
            </div>
          ) : activeRoles.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                H{r.address_number}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{r.role}</p>
                <p className="text-xs text-gray-400">
                  House {r.address_number} · until {new Date(r.term_end).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-lg font-medium ${roleColor[r.role] || 'bg-gray-50 text-gray-500'}`}>
                Active
              </span>
            </div>
          ))}
        </div>

        {/* Judge panel link */}
        <Link href="/judge" className="flex items-center gap-3 bg-purple-50 border border-purple-100 rounded-2xl px-4 py-3">
          <span className="text-xl">⚖️</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-purple-800">Judge panel</p>
            <p className="text-xs text-purple-600">For cases with 3+ strikes that need formal ruling</p>
          </div>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#7C3AED" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </Link>

        {/* Run drawing */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-medium text-gray-700 mb-1">Run selection drawing</p>
          <p className="text-xs text-gray-400 mb-4">Randomly assigns Messenger 1, Messenger 2, and Verifier from the volunteer pool.</p>
          {drawResult && (
            <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-xl mb-3">{drawResult}</p>
          )}
          <button onClick={runDrawing} disabled={running}
            className="w-full py-3 rounded-xl text-sm font-medium text-white transition-all active:scale-95"
            style={{background: running ? '#9FE1CB' : '#1D9E75'}}>
            {running ? 'Running drawing...' : '🎲 Run random drawing'}
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
