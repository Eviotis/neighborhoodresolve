'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats] = useState({ events: 0, volunteers: 0, services: 0, activity: 0 })
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      setUser(data.user)
      supabase.from('profiles').select('*').eq('id', data.user.id).single().then(({ data: p }) => setProfile(p))
      loadData()
    })
  }, [])

  async function loadData() {
    const [casesRes, volunteersRes, eventsRes, servicesRes] = await Promise.all([
      supabase.from('cases').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('volunteers').select('*'),
      supabase.from('events').select('*'),
      supabase.from('contractors').select('*'),
    ])
    const cases = casesRes.data || []
    const volunteers = volunteersRes.data || []
    const events = eventsRes.data || []
    const services = servicesRes.data || []
    setStats({
      events: events.length,
      volunteers: volunteers.length,
      services: services.length,
      activity: cases.filter(c => c.status !== 'resolved').length,
    })
    setRecentActivity(cases.slice(0, 5))
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  function goBack() {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/dashboard')
    }
  }

  const statusColor: Record<string, string> = {
    open: 'bg-blue-50 text-blue-700',
    pending: 'bg-amber-50 text-amber-700',
    strike: 'bg-red-50 text-red-700',
    resolved: 'bg-green-50 text-green-700',
    escalated: 'bg-purple-50 text-purple-700',
  }

  const statusLabel: Record<string, string> = {
    open: 'open',
    pending: 'pending',
    strike: 'concern',
    resolved: 'resolved',
    escalated: 'escalated',
  }

  const isAdmin = profile && profile.access_level === 'A'
  const isMGR = profile && ['A','B1','B2','B3'].includes(profile.access_level)

  const modules = [
    { href: '/events', icon: '🎉', label: 'Events' },
    { href: '/volunteers', icon: '🤝', label: 'Volunteers' },
    { href: '/services', icon: '🔧', label: 'Services' },
    { href: '/give', icon: '💛', label: 'Need Help' },
    { href: '/services', icon: '⭐', label: 'Recommendations' },
    { href: '/cases', icon: '💬', label: 'Community Concerns' },
    { href: '/events', icon: '🏷️', label: 'Yard Sales' },
    { href: '/roles', icon: '🗳️', label: 'Community Polls' },
    { href: '/roles', icon: '🎲', label: 'Roles' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="flex justify-between items-center max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="text-xs text-gray-400 px-2 py-1.5 rounded-lg border border-gray-200 active:bg-gray-50">
              ← Back
            </button>
            <div>
              <h1 className="text-base font-semibold text-gray-900">NeighborhoodResolve</h1>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Link href="/admin" className="text-xs text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200">⚙️ Admin</Link>
            )}
            <button onClick={signOut} className="text-xs text-gray-400 px-3 py-1.5 rounded-lg border border-gray-200">Sign out</button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Events', value: stats.events, color: 'text-green-600' },
            { label: 'Volunteers', value: stats.volunteers, color: 'text-blue-600' },
            { label: 'Services', value: stats.services, color: 'text-amber-600' },
            { label: 'Active', value: stats.activity, color: 'text-gray-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
              <p className={`text-xl font-semibold ${s.color}`}>{loading ? '—' : s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Welcome message */}
        <div className="bg-green-50 rounded-2xl px-4 py-3">
          <p className="text-sm font-medium text-green-800">Welcome to your neighborhood hub.</p>
          <p className="text-xs text-green-600 mt-1 leading-relaxed">Connect, support one another, and resolve concerns before they become conflicts.</p>
        </div>

        {/* Module grid */}
        <div className="grid grid-cols-3 gap-2">
          {modules.map(m => (
            <Link key={m.label} href={m.href}
              className="flex flex-col items-center gap-1.5 bg-white border border-gray-100 rounded-2xl py-4 px-2 text-center active:bg-gray-50">
              <span className="text-2xl">{m.icon}</span>
              <span className="text-xs font-medium text-gray-600 leading-tight">{m.label}</span>
            </Link>
          ))}
        </div>

        {/* Recent Community Activity */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center">
            <h2 className="text-sm font-medium text-gray-700">Recent Community Activity</h2>
            <Link href="/cases" className="text-xs text-green-600">View all</Link>
          </div>
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Loading...</div>
          ) : recentActivity.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">No activity yet</p>
              <p className="text-xs text-gray-300 mt-1">Your community is getting started.</p>
            </div>
          ) : recentActivity.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`}
              className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 active:bg-gray-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{c.category}</p>
                <p className="text-xs text-gray-400">{c.location} · Day {Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000) + 1}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-lg font-medium ${statusColor[c.status] || 'bg-gray-50 text-gray-500'}`}>
                {statusLabel[c.status] || c.status}
              </span>
            </Link>
          ))}
        </div>

        {/* Safe community note */}
        <div className="bg-gray-50 rounded-2xl px-4 py-3">
          <p className="text-xs text-gray-400 leading-relaxed text-center">
            🔒 All concerns are anonymous. No resident identity is ever stored or shared.
          </p>
        </div>

      </div>
      <BottomNav />
    </div>
  )
}
