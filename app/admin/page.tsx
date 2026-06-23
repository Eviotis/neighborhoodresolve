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
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      loadData()
    })
  }, [])

  async function loadData() {
    try {
      const casesRes = await supabase.from('cases').select('*').order('created_at', { ascending: false })
      const profilesRes = await supabase.from('profiles').select('*')
      setCases(casesRes.data || [])
      setProfiles(profilesRes.data || [])
    } catch(e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function deleteCase(id: string) {
    await supabase.from('cases').delete().eq('id', id)
    loadData()
  }

  async function grantLife(userId: string) {
    const profile = profiles.find(p => p.id === userId)
    if (!profile) return
    await supabase.from('profiles').update({ lives_remaining: (profile.lives_remaining || 0) + 1 }).eq('id', userId)
    loadData()
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Admin panel</h1>
            <p className="text-xs text-gray-400">Level A — Master access</p>
          </div>
          <Link href="/dashboard" className="text-xs text-gray-400 px-3 py-1.5 rounded-lg border border-gray-200">Back</Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {error && <p className="text-xs text-red-600 bg-red-50 px-4 py-3 rounded-xl mb-4">{error}</p>}

        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
            <p className="text-xs text-gray-400">Cases</p>
            <p className="text-xl font-semibold text-amber-600">{loading ? '—' : cases.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
            <p className="text-xs text-gray-400">Residents</p>
            <p className="text-xl font-semibold text-blue-600">{loading ? '—' : profiles.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
            <p className="text-xs text-gray-400">Resolved</p>
            <p className="text-xl font-semibold text-green-600">{loading ? '—' : cases.filter(c => c.status === 'resolved').length}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
            <p className="text-xs text-gray-400">Strikes</p>
            <p className="text-xl font-semibold text-red-600">{loading ? '—' : cases.filter(c => c.strike_count > 0).length}</p>
          </div>
        </div>

        <div className="flex border-b border-gray-100 mb-4">
          <button onClick={() => setActiveTab('cases')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'cases' ? 'border-green-500 text-green-700' : 'border-transparent text-gray-400'}`}>
            Cases ({cases.length})
          </button>
          <button onClick={() => setActiveTab('residents')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'residents' ? 'border-green-500 text-green-700' : 'border-transparent text-gray-400'}`}>
            Residents ({profiles.length})
          </button>
        </div>

        {loading ? (
          <p className="text-center text-sm text-gray-400 py-8">Loading...</p>
        ) : activeTab === 'cases' ? (
          <div className="space-y-2">
            {cases.length === 0 && <p className="text-center text-sm text-gray-400 py-8">No cases</p>}
            {cases.map(c => (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.category}</p>
                    <p className="text-xs text-gray-400">{c.location} · {c.status}</p>
                  </div>
                  <button onClick={() => deleteCase(c.id)} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg">Delete</button>
                </div>
                {c.pr_timeline && <p className="text-xs text-blue-600 mt-2 bg-blue-50 px-2 py-1 rounded-lg">{c.pr_timeline}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {profiles.length === 0 && <p className="text-center text-sm text-gray-400 py-8">No residents found</p>}
            {profiles.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{String(p.email || 'No email')}</p>
                    <p className="text-xs text-gray-400">Level {String(p.access_level || 'C')} · Lives: {String(p.lives_remaining || 0)} · Reports: {String(p.report_count || 0)}</p>
                    <p className="text-xs text-gray-300">{p.is_anonymous ? 'Neighbor' + String(p.neighbor_number || '') : 'Standard'} · {String(p.community_code || '')}</p>
                  </div>
                  <button onClick={() => grantLife(p.id)} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg">+Life</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
