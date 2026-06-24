'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState({ open: 0, resolved: 0, strikes: 0, volunteers: 0 })
  const [recentCases, setRecentCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      setUser(data.user)
      loadData()
    })
  }, [])

  async function loadData() {
    const [casesRes, volunteersRes] = await Promise.all([
      supabase.from('cases').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('volunteers').select('*'),
    ])
    const cases = casesRes.data || []
    const volunteers = volunteersRes.data || []
    setStats({
      open: cases.filter(c => c.status !== 'resolved').length,
      resolved: cases.filter(c => c.status === 'resolved').length,
      strikes: cases.filter(c => c.strike_count > 0).length,
      volunteers: volunteers.length
    })
    setRecentCases(cases.slice(0, 5))
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const statusColor: Record<string, string> = {
    open: 'bg-blue-50 text-blue-700',
    pending: 'bg-amber-50 text-amber-700',
    strike: 'bg-red-50 text-red-700',
    resolved: 'bg-green-50 text-green-700',
    escalated: 'bg-purple-50 text-purple-700',
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="flex justify-between items-center max-w-lg mx-auto">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">NeighborhoodResolve</h1>
            <p className="text-xs text-gray-400">{user?.email}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin" className="text-xs text-gray-400 px-3 py-1.5 rounded-lg border border-gray-200">Admin</Link>
            <button onClick={signOut} className="text-xs text-gray-400 px-3 py-1.5 rounded-lg border border-gray-200">Sign out</button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Open cases', value: stats.open, color: 'text-amber-600' },
            { label: 'Resolved (all)', value: stats.resolved, color: 'text-green-600' },
            { label: 'Active strikes', value: stats.strikes, color: 'text-red-600' },
            { label: 'Volunteers', value: stats.volunteers, color: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-2xl font-semibold ${s.color}`}>{loading ? '—' : s.value}</p>
            </div>
          ))}
        </div>

        <Link href="/report"
          className="flex items-center gap-3 bg-green-600 text-white px-4 py-4 rounded-2xl active:scale-95 transition-transform">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
          </div>
          <div>
            <p className="font-medium text-sm">Report an issue</p>
            <p className="text-xs text-green-100">Always anonymous</p>
          </div>
          <svg className="ml-auto" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </Link>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h2 className="text-sm font-medium text-gray-700">Recent cases</h2>
          </div>
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Loading...</div>
          ) : recentCases.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">No cases yet</p>
            </div>
          ) : recentCases.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`}
              className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 active:bg-gray-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{c.category}</p>
                <p className="text-xs text-gray-400">{c.location} · Day {Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000) + 1}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-lg font-medium ${statusColor[c.status] || 'bg-gray-50 text-gray-500'}`}>
                {c.status}
              </span>
            </Link>
          ))}
        </div>

        <div className="bg-green-50 rounded-2xl px-4 py-3">
          <p className="text-xs text-green-700 leading-relaxed">
            🔒 All reports are anonymous. No resident identity is ever stored or shared. Cases are deleted after resolution.
          </p>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
