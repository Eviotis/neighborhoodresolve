'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isAnon, setIsAnon] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/'); return }
      setUser(data.user)
      let { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      if (!p) {
        const { data: maxData } = await supabase.from('profiles').select('neighbor_number').order('neighbor_number', { ascending: false }).limit(1)
        const nextNum = maxData && maxData.length > 0 ? (maxData[0].neighbor_number || 44) + 1 : 45
        await supabase.from('profiles').insert({
          id: data.user.id, email: data.user.email, neighbor_number: nextNum,
          community_code: 'ADMIN', access_level: 'C', lives_remaining: 1,
          report_count: 0, report_weight: 5.0, is_anonymous: false,
        })
        const { data: newP } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
        p = newP
      }
      if (p) { setProfile(p); setIsAnon(p.is_anonymous || false) }
      setLoading(false)
    })
  }, [])

  async function saveProfile() {
    setSaving(true)
    await supabase.from('profiles').update({ is_anonymous: isAnon, updated_at: new Date().toISOString() }).eq('id', user.id)
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (p) setProfile(p)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>

  const neighborNum = profile?.neighbor_number || 45
  const displayName = isAnon ? `Neighbor${neighborNum}` : (user?.email || '')
  const lives = profile?.lives_remaining || 0
  const stars = profile?.stars_received || 0
  const starsUntilLife = 15 - (stars % 15)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
              ← Home
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">My profile</h1>
          </div>
          <p className="text-xs text-gray-400">{displayName}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Identity */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">Your identity</p>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-lg font-medium text-green-700">
              {isAnon ? '🕵️' : (user?.email?.[0]?.toUpperCase() || '?')}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{displayName}</p>
              <p className="text-xs text-gray-400">{isAnon ? `Ultra anonymous · Neighbor${neighborNum}` : 'Standard mode'}</p>
            </div>
          </div>
          <div className="flex items-center justify-between py-3 border-t border-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-700">Ultra anonymous mode</p>
              <p className="text-xs text-gray-400 mt-0.5">Show as Neighbor{neighborNum} instead of your email</p>
            </div>
            <button onClick={() => setIsAnon(!isAnon)}
              className={`w-12 h-7 rounded-full transition-colors relative ${isAnon ? 'bg-green-500' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${isAnon ? 'translate-x-5' : 'translate-x-0.5'}`}/>
            </button>
          </div>
        </div>

        {/* Lives and Stars */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500">❤️ Lives & ⭐ Stars</p>
            <Link href="/give" className="text-xs font-medium px-3 py-1.5 rounded-xl text-white" style={{background:'#1D9E75'}}>
              Give back →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <div className="flex justify-center gap-0.5 mb-1">
                {[...Array(Math.min(lives, 5))].map((_, i) => <span key={i} className="text-lg">❤️</span>)}
                {lives === 0 && <span className="text-lg">🤍</span>}
                {lives > 5 && <span className="text-xs text-red-400 self-center">+{lives-5}</span>}
              </div>
              <p className="text-xs text-red-600 font-medium">{lives} Lives remaining</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-2xl mb-1">⭐</p>
              <p className="text-xs text-amber-600 font-medium">{stars} stars · {starsUntilLife} until bonus Life</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            We encourage only those truly in need to use their Life. If you have one and don't need it — gift it to a neighbor who does!
          </p>
        </div>

        {/* Activity */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">Your activity</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Reports submitted</p>
              <p className="text-xl font-semibold text-gray-800 mt-1">{profile?.report_count || 0}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Report weight</p>
              <p className="text-xl font-semibold text-gray-800 mt-1">{profile?.report_weight || 5}%</p>
            </div>
          </div>
        </div>

        {/* Access level */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Access level</p>
          <span className="inline-block px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium">
            Level {profile?.access_level || 'C'} — {
              profile?.access_level === 'A' ? 'Admin' :
              profile?.access_level === 'B1' ? 'Manager' :
              profile?.access_level === 'B2' ? 'Overseer' : 'Resident'
            }
          </span>
        </div>

        <button onClick={saveProfile} disabled={saving}
          className="w-full py-4 rounded-2xl text-white text-sm font-medium transition-all active:scale-95"
          style={{background: saved ? '#0F6E56' : saving ? '#9FE1CB' : '#1D9E75'}}>
          {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save profile'}
        </button>
      </div>
      <BottomNav />
    </div>
  )
}
