'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [community, setCommunity] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isAnon, setIsAnon] = useState(false)
  const [showHelpForm, setShowHelpForm] = useState(false)
  const [helpRequest, setHelpRequest] = useState({ description: '', category: 'general', urgency: 'normal' })
  const [helpSubmitting, setHelpSubmitting] = useState(false)
  const [helpSent, setHelpSent] = useState(false)
  const [editCommunity, setEditCommunity] = useState(false)
  const [communitySearch, setCommunitySearch] = useState('')
  const [communityMatches, setCommunityMatches] = useState<any[]>([])
  const [selectedCommunity, setSelectedCommunity] = useState<any>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

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
      if (p) {
        setProfile(p)
        setIsAnon(p.is_anonymous || false)
        if (p.community_id) {
          const { data: com } = await supabase.from('communities').select('*').eq('id', p.community_id).single()
          if (com) setCommunity(com)
        }
      }
      setLoading(false)
    })
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function searchCommunities(val: string) {
    setCommunitySearch(val)
    setSelectedCommunity(null)
    if (val.length < 2) { setCommunityMatches([]); setShowDropdown(false); return }
    const { data } = await supabase.from('communities').select('*').ilike('name', `%${val}%`).limit(6)
    setCommunityMatches(data || [])
    setShowDropdown(true)
  }

  function selectCommunity(c: any) {
    setSelectedCommunity(c)
    setCommunitySearch(c.name)
    setShowDropdown(false)
  }

  async function saveCommunity() {
    if (!user || !communitySearch.trim()) return
    setSaving(true)
    let communityId = selectedCommunity?.id || null
    if (!communityId) {
      const slug = communitySearch.toUpperCase().replace(/\s+/g, '_')
      const { data: existing } = await supabase.from('communities').select('id').eq('slug', slug).single()
      if (existing) {
        communityId = existing.id
      } else {
        const { data: newCom } = await supabase.from('communities')
          .insert({ name: communitySearch, slug, created_by: user.id, member_count: 1 })
          .select().single()
        communityId = newCom?.id || null
      }
    }
    await supabase.from('profiles').update({ community_id: communityId, community_code: communitySearch.toUpperCase().replace(/\s+/g, '_') }).eq('id', user.id)
    if (selectedCommunity) setCommunity(selectedCommunity)
    setEditCommunity(false)
    setSaving(false)
  }

  async function saveProfile() {
    setSaving(true)
    await supabase.from('profiles').update({ is_anonymous: isAnon, updated_at: new Date().toISOString() }).eq('id', user.id)
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (p) setProfile(p)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  async function submitHelpRequest(e: React.FormEvent) {
    e.preventDefault()
    setHelpSubmitting(true)
    await supabase.from('help_requests').insert({
      requester_id: profile?.id,
      description: helpRequest.description,
      category: helpRequest.category,
      urgency: helpRequest.urgency,
      status: 'pending_review',
      use_life: true,
    })
    const { data: managers } = await supabase.from('profiles').select('email').in('access_level', ['A','B1','B2','B3'])
    if (managers && managers.length > 0) {
      await fetch('/api/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: managers.map((m: any) => m.email).filter(Boolean),
          subject: `🆘 Help request from resident — ${helpRequest.urgency} urgency`,
          html: `<div style="font-family:sans-serif;max-width:500px">
            <h2 style="color:#1D9E75">Resident Help Request</h2>
            <p><strong>Category:</strong> ${helpRequest.category}</p>
            <p><strong>Urgency:</strong> ${helpRequest.urgency}</p>
            <p><strong>Description:</strong> ${helpRequest.description}</p>
            <p><em>Requester identity is protected. Please review and release to volunteer pool if appropriate.</em></p>
            <a href="https://project-76shj.vercel.app/admin" style="background:#1D9E75;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px">Review in Admin Panel →</a>
          </div>`
        })
      }).catch(() => {})
    }
    setHelpSent(true)
    setShowHelpForm(false)
    setHelpRequest({ description: '', category: 'general', urgency: 'normal' })
    setHelpSubmitting(false)
  }

  function goBack() {
    if (window.history.length > 1) router.back()
    else router.push('/dashboard')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>

  const neighborNum = profile?.neighbor_number || 45
  const displayName = isAnon ? `Neighbor${neighborNum}` : (user?.email || '')
  const lives = profile?.lives_remaining || 0
  const stars = profile?.stars_received || 0
  const starsUntilLife = 15 - (stars % 15)
  const isAdmin = profile?.access_level === 'A'
  const isMGR = ['A','B1','B2','B3'].includes(profile?.access_level || '')

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={goBack} className="text-xs text-gray-400 px-3 py-1.5 rounded-lg border border-gray-200">← Back</button>
            <h1 className="text-lg font-semibold text-gray-900">My Profile</h1>
          </div>
          {(isAdmin || isMGR) && (
            <Link href="/admin" className="text-xs font-medium px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600">⚙️ Admin</Link>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1 max-w-lg mx-auto px-4">{displayName}</p>
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

        {/* Community */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500">🏘️ My Community</p>
            <button onClick={() => { setEditCommunity(!editCommunity); setCommunitySearch(community?.name || '') }}
              className="text-xs text-green-600 font-medium">
              {editCommunity ? 'Cancel' : 'Change'}
            </button>
          </div>
          {!editCommunity ? (
            community ? (
              <div>
                <p className="text-sm font-medium text-gray-800">{community.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{community.city}{community.state ? `, ${community.state}` : ''}{community.zip_code ? ` ${community.zip_code}` : ''}</p>
                <p className="text-xs text-gray-400">{community.member_count} member{community.member_count !== 1 ? 's' : ''}</p>
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-400 mb-2">No community assigned yet.</p>
                <button onClick={() => setEditCommunity(true)} className="text-xs text-green-600 font-medium">+ Add my neighborhood</button>
              </div>
            )
          ) : (
            <div ref={searchRef} className="relative">
              <input
                type="text"
                value={communitySearch}
                onChange={e => searchCommunities(e.target.value)}
                placeholder="Search your neighborhood..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"
                autoComplete="off"
              />
              {showDropdown && communityMatches.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl mt-1 shadow-lg overflow-hidden">
                  {communityMatches.map(c => (
                    <button key={c.id} type="button" onClick={() => selectCommunity(c)}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-green-50 border-b border-gray-50 last:border-0">
                      <p className="font-medium text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.city}, {c.state} · {c.member_count} member{c.member_count !== 1 ? 's' : ''}</p>
                    </button>
                  ))}
                  <button type="button" onClick={() => { setShowDropdown(false); setSelectedCommunity(null) }}
                    className="w-full text-left px-4 py-3 text-sm text-green-600 bg-green-50">
                    + Create "{communitySearch}" as new community
                  </button>
                </div>
              )}
              {selectedCommunity && (
                <p className="text-xs text-green-600 mt-1">✓ Selected: {selectedCommunity.name}</p>
              )}
              <button onClick={saveCommunity} disabled={saving || !communitySearch.trim()}
                className="mt-2 w-full py-2.5 rounded-xl text-white text-xs font-medium"
                style={{background: '#1D9E75'}}>
                {saving ? 'Saving...' : 'Save community'}
              </button>
            </div>
          )}
        </div>

        {/* Lives and Stars */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500">❤️ Lives & ⭐ Stars</p>
            <Link href="/give" className="text-xs font-medium px-3 py-1.5 rounded-xl text-white" style={{background:'#1D9E75'}}>Give back →</Link>
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
          <p className="text-xs text-gray-400 leading-relaxed">We encourage only those truly in need to use their Life. If you have one and don't need it — gift it to a neighbor who does!</p>
        </div>

        {/* Request Help */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500">🆘 Need help?</p>
          </div>
          {helpSent ? (
            <div className="bg-green-50 rounded-xl px-3 py-3 text-xs text-green-700">
              ✓ Help request sent to your community managers. They will review and connect you with a volunteer if appropriate. Your identity is protected.
            </div>
          ) : !showHelpForm ? (
            <div>
              <p className="text-xs text-gray-400 mb-3 leading-relaxed">If you need help with something around your home and have a Life available, you can proactively request volunteer assistance.</p>
              <button onClick={() => setShowHelpForm(true)} className="w-full py-3 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>🆘 Request volunteer help</button>
            </div>
          ) : (
            <form onSubmit={submitHelpRequest} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">What do you need help with?</label>
                <select value={helpRequest.category} onChange={e => setHelpRequest({...helpRequest, category: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-green-500">
                  <option value="general">General help</option>
                  <option value="lawn">Lawn & yard</option>
                  <option value="moving">Moving / heavy lifting</option>
                  <option value="repairs">Minor repairs</option>
                  <option value="groceries">Groceries / errands</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Urgency</label>
                <div className="flex gap-2">
                  {[{v:'low',l:'Low'},{v:'normal',l:'Normal'},{v:'urgent',l:'Urgent'}].map(u => (
                    <button key={u.v} type="button" onClick={() => setHelpRequest({...helpRequest, urgency: u.v})}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${helpRequest.urgency === u.v ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                      style={helpRequest.urgency === u.v ? {background:'#1D9E75'} : {}}>
                      {u.l}
                    </button>
                  ))}
                </div>
              </div>
              <textarea value={helpRequest.description} onChange={e => setHelpRequest({...helpRequest, description: e.target.value})}
                placeholder="Describe what you need help with. Be as specific as possible." rows={3} required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 resize-none"/>
              <div className="bg-amber-50 rounded-xl px-3 py-2 text-xs text-amber-700">
                ⚠️ This will use 1 Life if approved. You have {lives} Life{lives !== 1 ? 's' : ''} remaining.
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowHelpForm(false)} className="flex-1 py-3 rounded-xl text-xs border border-gray-200 text-gray-500">Cancel</button>
                <button type="submit" disabled={helpSubmitting || lives <= 0}
                  className={`flex-1 py-3 rounded-xl text-xs font-medium text-white ${lives <= 0 ? 'opacity-40' : ''}`}
                  style={{background:'#1D9E75'}}>
                  {helpSubmitting ? 'Sending...' : 'Send request'}
                </button>
              </div>
              {lives <= 0 && <p className="text-xs text-red-500 text-center">You have no Lives remaining. Ask a neighbor to gift you one!</p>}
            </form>
          )}
        </div>

        {/* Activity */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">Your activity</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Concerns submitted</p>
              <p className="text-xl font-semibold text-gray-800 mt-1">{profile?.report_count || 0}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Report weight</p>
              <p className="text-xl font-semibold text-gray-800 mt-1">{profile?.report_weight || 5}%</p>
            </div>
          </div>
        </div>

        {/* Preferences link */}
        <Link href="/onboarding" className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-4 active:bg-gray-50">
          <div>
            <p className="text-sm font-medium text-gray-700">My preferences & skills</p>
            <p className="text-xs text-gray-400 mt-0.5">Update your community interests and skills</p>
          </div>
          <span className="text-gray-300 text-lg">›</span>
        </Link>

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
