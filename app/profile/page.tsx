'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

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
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      if (p) { setProfile(p); setIsAnon(p.is_anonymous || false) }
      setLoading(false)
    })
  }, [])

  async function saveProfile() {
    setSaving(true)
    await supabase.from('profiles').update({
      is_anonymous: isAnon,
      updated_at: new Date().toISOString()
    }).eq('id', user.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>

  const displayName = profile?.is_anonymous ? `Neighbor${profile?.neighbor_number}` : user?.email
  const lives = profile?.lives_remaining || 1

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-semibold text-gray-900">My profile</h1>
          <p className="text-xs text-gray-400 mt-0.5">{displayName}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Identity display */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">Your identity</p>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-lg font-medium text-green-700">
              {isAnon ? '🕵️' : user?.email?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{displayName}</p>
              <p className="text-xs text-gray-400">{isAnon ? 'Ultra anonymous mode' : 'Standard mode'}</p>
            </div>
          </div>

          {/* Anonymous toggle */}
          <div className="flex items-center justify-between py-3 border-t border-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-700">Ultra anonymous mode</p>
              <p className="text-xs text-gray-400 mt-0.5">Show as Neighbor{profile?.neighbor_number} instead of your email</p>
            </div>
            <button onClick={() => setIsAnon(!isAnon)}
              className={`w-12 h-7 rounded-full transition-colors relative ${isAnon ? 'bg-green-500' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${isAnon ? 'translate-x-5' : 'translate-x-0.5'}`}/>
            </button>
          </div>
        </div>

        {/* Lives */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">❤️ Lives remaining</p>
          <div className="flex items-center gap-2 mb-2">
            {[...Array(3)].map((_, i) => (
              <span key={i} className={`text-2xl ${i < lives ? 'opacity-100' : 'opacity-20'}`}>❤️</span>
            ))}
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Each Life allows one free volunteer help request per year. Lives can be gifted by volunteers or managers when you need extra support.
          </p>
        </div>

        {/* Stats */}
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
            Level {profile?.access_level || 'C'} — Resident
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
