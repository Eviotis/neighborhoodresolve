'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

export default function RolesPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<any[]>([])
  const [volunteers, setVolunteers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [drawResult, setDrawResult] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      loadData()
    })
  }, [])

  async function loadData() {
    const [rolesRes, volRes] = await Promise.all([
      supabase.from('roles').select('*').eq('active', true).order('created_at', { ascending: false }),
      supabase.from('volunteers').select('*').neq('role_interest', 'volunteer_only'),
    ])
    setRoles(rolesRes.data || [])
    setVolunteers(volRes.data || [])
    setLoading(false)
  }

  async function runDrawing() {
    setRunning(true)
    if (volunteers.length === 0) {
      setDrawResult('No volunteers available for role drawing yet.')
      setRunning(false)
      return
    }

    // Deactivate old roles
    await supabase.from('roles').update({ active: false }).eq('active', true)

    const shuffled = [...volunteers].sort(() => Math.random() - 0.5)
    const messenger1 = shuffled[0]
    const messenger2 = shuffled[1] || null
    const verifier = shuffled[2] || null

    const termStart = new Date().toISOString()
    const termEnd = new Date(Date.now() + 180 * 86400000).toISOString()

    const inserts = [
      { role: 'Messenger 1', volunteer_id: messenger1.id, address_number: messenger1.address_number, term_start: termStart, term_end: termEnd, active: true },
      ...(messenger2 ? [{ role: 'Messenger 2', volunteer_id: messenger2.id, address_number: messenger2.address_number, term_start: termStart, term_end: termEnd, active: true }] : []),
      ...(verifier ? [{ role: 'Verifier 1', volunteer_id: verifier.id, address_number: verifier.address_number, term_start: termStart, term_end: termEnd, active: true }] : []),
    ]

    await supabase.from('roles').insert(inserts)
    setDrawResult(`Drawing complete! New roles assigned until ${new Date(termEnd).toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'})}.`)
    loadData()
    setRunning(false)
  }

  const roleColor: Record<string, string> = {
    'Messenger 1': 'bg-green-50 text-green-700',
    'Messenger 2': 'bg-blue-50 text-blue-700',
    'Verifier 1':  'bg-amber-50 text-amber-700',
  }

  const roleDesc: Record<string, string> = {
    'Messenger 1': 'Receives all reports · strips identity · notifies residents · issues strikes',
    'Messenger 2': 'Backup — activated if Messenger 1 has conflict of interest or unavailable',
    'Verifier 1':  'Verifies complaint legitimacy on request — opinion only, Messenger decides',
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
              ← Home
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">Roles & selection</h1>
          </div>
          <p className="text-xs text-gray-400">Random drawing · no voting · no politics</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* How it works */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">How selection works</p>
          <div className="space-y-2 text-xs text-gray-600 leading-relaxed">
            <p>• Residents volunteer via the Volunteers tab and select a role interest</p>
            <p>• Admin runs a random drawing — no campaigns, no favoritism</p>
            <p>• Positions run for <strong>6 months</strong>, then a new drawing is held</p>
            <p>• Same person can re-enter for the next term</p>
            <p>• Messengers cannot report personal complaints during their own term</p>
            <p>• B2/B3 overseers have a <strong>4-hour window</strong> to object to any B1 action</p>
          </div>
        </div>

        {/* Current role holders */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">Current role holders</h2>
            {roles.length > 0 && (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                {roles.length} active
              </span>
            )}
          </div>
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Loading...</div>
          ) : roles.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">No roles assigned yet</p>
              <p className="text-xs text-gray-300 mt-1">Run the drawing below to assign roles</p>
            </div>
          ) : roles.map(r => (
            <div key={r.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                  H{r.address_number}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800">{r.role}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${roleColor[r.role] || 'bg-gray-50 text-gray-500'}`}>Active</span>
                  </div>
                  <p className="text-xs text-gray-400">House {r.address_number} · until {new Date(r.term_end).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 ml-13 pl-13" style={{paddingLeft:'52px'}}>{roleDesc[r.role]}</p>
            </div>
          ))}
        </div>

        {/* Volunteer pool status */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Role drawing pool</p>
          {volunteers.length === 0 ? (
            <p className="text-xs text-gray-400">No volunteers have expressed interest in roles yet. Volunteers can opt in from the Volunteers tab.</p>
          ) : (
            <p className="text-xs text-gray-600"><strong>{volunteers.length}</strong> volunteer{volunteers.length !== 1 ? 's' : ''} eligible for role drawing</p>
          )}
        </div>

        {/* Judge panel link */}
        <Link href="/judge" className="flex items-center gap-3 bg-purple-50 border border-purple-100 rounded-2xl px-4 py-3">
          <span className="text-xl">⚖️</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-purple-800">Judge panel</p>
            <p className="text-xs text-purple-600">For cases with 3+ strikes — randomly selected panel</p>
          </div>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#7C3AED" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </Link>

        {/* Run drawing */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-medium text-gray-700 mb-1">Run selection drawing</p>
          <p className="text-xs text-gray-400 mb-4">Randomly assigns Messenger 1, Messenger 2, and Verifier from the eligible volunteer pool. Previous roles are deactivated.</p>
          {drawResult && (
            <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-xl mb-3">{drawResult}</p>
          )}
          <button onClick={runDrawing} disabled={running || volunteers.length === 0}
            className={`w-full py-3 rounded-xl text-sm font-medium text-white transition-all active:scale-95 ${volunteers.length === 0 ? 'opacity-40' : ''}`}
            style={{background: running ? '#9FE1CB' : '#1D9E75'}}>
            {running ? 'Running drawing...' : '🎲 Run random drawing'}
          </button>
          {volunteers.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-2">Need volunteers interested in roles first</p>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
