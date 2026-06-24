'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

export default function GiftLifePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [address, setAddress] = useState('')
  const [volunteerCode, setVolunteerCode] = useState('')
  const [recipientMode, setRecipientMode] = useState<'address'|'volunteer'>('address')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{success: boolean, msg: string} | null>(null)
  const [myGifts, setMyGifts] = useState<any[]>([])
  const [starAddress, setStarAddress] = useState('')
  const [starVolCode, setStarVolCode] = useState('')
  const [starRecipientMode, setStarRecipientMode] = useState<'address'|'volunteer'>('address')
  const [starCount, setStarCount] = useState(1)
  const [starMessage, setStarMessage] = useState('')
  const [starSubmitting, setStarSubmitting] = useState(false)
  const [starResult, setStarResult] = useState('')
  const [activeTab, setActiveTab] = useState<'gift'|'stars'>('gift')
  const [volunteers, setVolunteers] = useState<any[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/'); return }
      const [profileRes, giftsRes, volRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', data.user.id).single(),
        supabase.from('life_gifts').select('*').eq('giver_id', data.user.id).order('created_at', { ascending: false }),
        supabase.from('volunteers').select('*, profiles(neighbor_number, address)').order('created_at')
      ])
      setProfile(profileRes.data)
      setMyGifts(giftsRes.data || [])
      setVolunteers(volRes.data || [])
      setLoading(false)
    })
  }, [])

  async function findRecipient(addr: string, volCode: string, mode: string) {
    if (mode === 'volunteer' && volCode) {
      const volNum = parseInt(volCode.replace(/\D/g, ''))
      const { data } = await supabase.from('profiles').select('*').eq('neighbor_number', volNum).single()
      return data
    }
    const { data } = await supabase.from('profiles').select('*').ilike('address', `%${addr.trim()}%`).single()
    return data
  }

  async function giftLife(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)

    if ((profile?.lives_remaining || 0) <= 0) {
      setResult({ success: false, msg: 'You have no Lives to gift. Earn more through stars or ask your manager.' })
      setSubmitting(false)
      return
    }

    const recipient = await findRecipient(address, volunteerCode, recipientMode)

    if (!recipient) {
      setResult({ success: false, msg: 'No resident found. Please check the address or volunteer number and try again.' })
      setSubmitting(false)
      return
    }

    if (recipient.id === profile.id) {
      setResult({ success: false, msg: 'You cannot gift a Life to yourself.' })
      setSubmitting(false)
      return
    }

    const recipientLives = recipient.lives_remaining || 0

    if (recipientLives >= 3) {
      setResult({ success: false, msg: `This neighbor already has ${recipientLives} Lives. Consider donating to the community pool — contact your manager.` })
      setSubmitting(false)
      return
    }

    await Promise.all([
      supabase.from('profiles').update({ lives_remaining: (profile.lives_remaining || 1) - 1 }).eq('id', profile.id),
      supabase.from('profiles').update({ lives_remaining: recipientLives + 1 }).eq('id', recipient.id),
      supabase.from('life_gifts').insert({
        giver_id: profile.id,
        recipient_address: recipientMode === 'volunteer' ? `Neighbor${recipient.neighbor_number}` : address,
        recipient_id: recipient.id,
        status: 'delivered',
        message: message || null,
      })
    ])

    setResult({ success: true, msg: `❤️ Life gifted! This neighbor now has ${recipientLives + 1} Lives. What goes around comes around!` })
    setProfile({ ...profile, lives_remaining: (profile.lives_remaining || 1) - 1 })
    setAddress('')
    setVolunteerCode('')
    setMessage('')

    const { data: gifts } = await supabase.from('life_gifts').select('*').eq('giver_id', profile.id).order('created_at', { ascending: false })
    setMyGifts(gifts || [])
    setSubmitting(false)
  }

  async function giveStars(e: React.FormEvent) {
    e.preventDefault()
    setStarSubmitting(true)
    setStarResult('')

    const recipient = await findRecipient(starAddress, starVolCode, starRecipientMode)

    if (!recipient) {
      setStarResult('No resident found. Please check the address or volunteer number.')
      setStarSubmitting(false)
      return
    }

    const newStars = (recipient.stars_received || 0) + starCount
    const bonusLife = Math.floor(newStars / 15) > Math.floor((recipient.stars_received || 0) / 15)

    await Promise.all([
      supabase.from('profiles').update({
        stars_received: newStars,
        lives_remaining: bonusLife ? (recipient.lives_remaining || 0) + 1 : recipient.lives_remaining,
      }).eq('id', recipient.id),
      supabase.from('profiles').update({ stars_given: (profile?.stars_given || 0) + starCount }).eq('id', profile.id),
      supabase.from('star_ratings').insert({
        giver_id: profile.id,
        recipient_id: recipient.id,
        stars: starCount,
        message: starMessage || null,
      })
    ])

    setStarResult(bonusLife
      ? `⭐ ${starCount} star${starCount > 1 ? 's' : ''} sent! 🎉 They've reached ${newStars} stars and earned a bonus Life!`
      : `⭐ ${starCount} star${starCount > 1 ? 's' : ''} sent! They now have ${newStars} total. (${15 - (newStars % 15)} more until a bonus Life)`
    )
    setStarAddress('')
    setStarVolCode('')
    setStarMessage('')
    setStarCount(1)
    setStarSubmitting(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Link href="/profile" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>← Profile</Link>
            <h1 className="text-lg font-semibold text-gray-900">Give back</h1>
          </div>
          <p className="text-xs text-gray-400">Gift a Life or give stars to a neighbor</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Your Lives</p>
            <div className="flex justify-center gap-0.5 mb-1">
              {[...Array(Math.min(profile?.lives_remaining || 0, 9))].map((_, i) => <span key={i} className="text-lg">❤️</span>)}
              {(profile?.lives_remaining || 0) === 0 && <span className="text-lg">🤍</span>}
            </div>
            <p className="text-xs text-gray-500 font-medium">{profile?.lives_remaining || 0} remaining</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Stars received</p>
            <p className="text-2xl mb-1">⭐</p>
            <p className="text-xs text-gray-500 font-medium">{profile?.stars_received || 0} total · {15 - ((profile?.stars_received || 0) % 15)} until bonus Life</p>
          </div>
        </div>

        {/* Tabs — visually distinct */}
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('gift')}
            className={`flex-1 py-3 rounded-xl text-xs font-medium transition-all ${activeTab === 'gift' ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500'}`}
            style={activeTab === 'gift' ? {background:'#1D9E75'} : {}}>
            ❤️ Gift a Life
          </button>
          <button onClick={() => setActiveTab('stars')}
            className={`flex-1 py-3 rounded-xl text-xs font-medium transition-all ${activeTab === 'stars' ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500'}`}
            style={activeTab === 'stars' ? {background:'#EF9F27'} : {}}>
            ⭐ Give stars
          </button>
        </div>

        {activeTab === 'gift' ? (
          <>
            <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3">
              <p className="text-xs text-green-700 leading-relaxed">
                💚 You have <strong>{profile?.lives_remaining || 0} Lives</strong> to gift. Know a neighbor or volunteer who needs help? Send them a Life — no strings attached.
              </p>
              <p className="text-xs text-red-600 mt-1.5 font-medium">⚠️ Gifting a Life is irreversible — please verify the address before confirming.</p>
            </div>

            <form onSubmit={giftLife} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
              {/* Recipient mode toggle */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Find recipient by</label>
                <div className="flex gap-2 mb-3">
                  <button type="button" onClick={() => setRecipientMode('address')}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${recipientMode === 'address' ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                    style={recipientMode === 'address' ? {background:'#1D9E75'} : {}}>
                    🏠 Street address
                  </button>
                  <button type="button" onClick={() => setRecipientMode('volunteer')}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${recipientMode === 'volunteer' ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                    style={recipientMode === 'volunteer' ? {background:'#1D9E75'} : {}}>
                    🤝 Volunteer #
                  </button>
                </div>
                {recipientMode === 'address' ? (
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                    placeholder="Street address only (e.g. 142 Oak Drive)" required={recipientMode === 'address'}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
                ) : (
                  <div>
                    <input type="text" value={volunteerCode} onChange={e => setVolunteerCode(e.target.value)}
                      placeholder="Volunteer Neighbor# (e.g. Neighbor47 or 47)" required={recipientMode === 'volunteer'}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
                    {volunteers.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-gray-400">Active volunteers:</p>
                        {volunteers.slice(0,5).map((v: any) => (
                          <button key={v.id} type="button"
                            onClick={() => setVolunteerCode(String(v.profiles?.neighbor_number || ''))}
                            className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg mr-1 mb-1">
                            Neighbor{v.profiles?.neighbor_number} — {v.skills}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Message (optional · anonymous)</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="e.g. Hang in there neighbor — we're all in this together!"
                  rows={2} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 resize-none"/>
              </div>
              {result && (
                <p className={`text-xs px-3 py-2 rounded-xl ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{result.msg}</p>
              )}
              <button type="submit" disabled={submitting || (profile?.lives_remaining || 0) <= 0}
                className={`w-full py-3 rounded-xl text-xs font-medium text-white ${(profile?.lives_remaining || 0) <= 0 ? 'opacity-40' : ''}`}
                style={{background:'#1D9E75'}}>
                {submitting ? 'Gifting...' : '❤️ Confirm and gift a Life'}
              </button>
              {(profile?.lives_remaining || 0) <= 0 && (
                <p className="text-xs text-gray-400 text-center">No Lives to gift — earn more through stars or ask your manager</p>
              )}
            </form>

            {myGifts.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-medium text-gray-500 mb-3">Your recent gifts</p>
                <div className="space-y-2">
                  {myGifts.slice(0, 5).map(g => (
                    <div key={g.id} className="flex items-center gap-2 text-xs text-gray-500">
                      <span>❤️</span>
                      <span className="flex-1">{g.recipient_address} · {new Date(g.created_at).toLocaleDateString()}</span>
                      <span className="px-2 py-0.5 rounded-lg bg-green-50 text-green-600">{g.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
              <p className="text-xs text-amber-700 leading-relaxed">
                ⭐ Give stars to volunteers or any neighbor who made a difference. Every <strong>15 stars = 1 bonus Life</strong> awarded automatically!
              </p>
              <p className="text-xs text-amber-600 mt-1.5">💡 Volunteers are especially worthy recipients — they give their time for free!</p>
            </div>

            <form onSubmit={giveStars} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Find recipient by</label>
                <div className="flex gap-2 mb-3">
                  <button type="button" onClick={() => setStarRecipientMode('address')}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${starRecipientMode === 'address' ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                    style={starRecipientMode === 'address' ? {background:'#EF9F27'} : {}}>
                    🏠 Street address
                  </button>
                  <button type="button" onClick={() => setStarRecipientMode('volunteer')}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${starRecipientMode === 'volunteer' ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                    style={starRecipientMode === 'volunteer' ? {background:'#EF9F27'} : {}}>
                    🤝 Volunteer #
                  </button>
                </div>
                {starRecipientMode === 'address' ? (
                  <input type="text" value={starAddress} onChange={e => setStarAddress(e.target.value)}
                    placeholder="Street address only (e.g. 142 Oak Drive)" required={starRecipientMode === 'address'}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
                ) : (
                  <div>
                    <input type="text" value={starVolCode} onChange={e => setStarVolCode(e.target.value)}
                      placeholder="Volunteer Neighbor# (e.g. Neighbor47 or 47)" required={starRecipientMode === 'volunteer'}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
                    {volunteers.length > 0 && (
                      <div className="mt-2">
                        {volunteers.slice(0,5).map((v: any) => (
                          <button key={v.id} type="button"
                            onClick={() => setStarVolCode(String(v.profiles?.neighbor_number || ''))}
                            className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-lg mr-1 mb-1">
                            Neighbor{v.profiles?.neighbor_number} — {v.skills}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Stars to give</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => setStarCount(n)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${starCount === n ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
                      style={starCount === n ? {background:'#EF9F27'} : {}}>
                      {n}⭐
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Message (optional)</label>
                <textarea value={starMessage} onChange={e => setStarMessage(e.target.value)}
                  placeholder="e.g. Thank you for helping with the yard — you made a real difference!"
                  rows={2} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 resize-none"/>
              </div>
              {starResult && <p className="text-xs bg-amber-50 text-amber-700 px-3 py-2 rounded-xl">{starResult}</p>}
              <button type="submit" disabled={starSubmitting}
                className="w-full py-3 rounded-xl text-xs font-medium text-white"
                style={{background:'#EF9F27'}}>
                {starSubmitting ? 'Sending...' : `⭐ Give ${starCount} star${starCount > 1 ? 's' : ''}`}
              </button>
            </form>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
