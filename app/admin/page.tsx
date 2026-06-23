'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function AdminPage() {
  const router = useRouter()
  const [cases, setCases] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('cases')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      loadData()
    })
  }, [])

  async function loadData() {
    const [casesRes, profilesRes] = await Promise.all([
      supabase.from('cases').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    ])
    setCases(casesRes.data || [])
    setProfiles(profilesRes.data || [])
    setLoading(false)
  }

  async function deleteCase(id: string) {
    await supabase.from('cases').delete().eq('id', id)
    loadData()
  }

  async function updateAccessLevel(userId: string, level: string) {
    await supabase.from('profiles').update({ access_level: level }).eq('id', userId)
    loadData()
  }

  async function grantLife(userId: string) {
    const profile = profiles.find(p => p.id === userId)
    if (!profile) return
    await supabase.from('profiles').update({
      lives_remaining: (profile.lives_remaining || 1) + 1
    }).eq('id', userId)
    loadData()
  }

  const flagged = profiles.filter(p => p.report_count >= 5)

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">⚙️ Admin panel</h1>
            <p className="text-xs text-gray-400">Level A — Master access</p>
          </div>
          <Link href="/dashboard" className="text-xs text-gray-400 px-3 py-1.5 rounded-lg border border-gray-200">← Dashboard</Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Total cases', value: cases.length, color: 'text-amber-600' },
            { label: 'Residents', value: profiles.length, color: 'text-blue-600' },
            { label: 'Flagged', value: flagged.length, color: 'text-red-600' },
            { label: 'Resolved', value: cases.filter(c => c.status === 'resolved').length, color: 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className={`text-xl font-semibold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Flagged users alert */}
        {flagged.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-4">
            <p className="text-xs font-medium text-red-700 mb-1">⚠️ Possible abuse detected</p>
            {flagged.map(p => (
              <p key={p.id} className="text-xs text-red-600">{p.is_anonymous ? `Neighbor${p.neighbor_number}` : p.email} — {p.report_count} reports</p>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 border-b border-gray-100 mb-4">
          {['cases', 'residents'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab ? 'border-green-500 text-green-700' : 'border-transparent text-gray-400'}`}>
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-8 text-sm text-gray-400">Loading...</div>
        ) : activeTab === 'cases' ? (
          <div className="space-y-2">
            {cases.map(c => (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{c.category}</p>
                    <p className="text-xs text-gray-400">{c.location} · {c.status} · {c.strike_count} strikes</p>
                    <p className="text-xs text-gray-300 mt-1">{new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">{c.priority_score || 5}% weight</span>
                    <button onClick={() => deleteCase(c.id)}
                      className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg">Delete</button>
                  </div>
                </div>
                {c.pr_timeline && (
                  <p className="text-xs text-blue-600 mt-2 bg-blue-50 px-2 py-1 rounded-lg">📅 {c.pr_timeline}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {profiles.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.email}</p>
                    <p className="text-xs text-gray-400">
                      {p.is_anonymous ? `Neighbor${p.neighbor_number} · ` : ''}{p.community_code} · Level {p.access_level} · {p.report_count} reports · ❤️ {p.lives_remaining}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-col items-end">
                    <select value={p.access_level} onChange={e => updateAccessLevel(p.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white">
                      <option value="C">C — Resident</option>
                      <option value="B1">B1 — Manager</option>
                      <option value="B2">B2 — Overseer</option>
                      <option value="A">A — Admin</option>
                    </select>
                    <button onClick={() => grantLife(p.id)}
                      className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg">+ Grant Life</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
