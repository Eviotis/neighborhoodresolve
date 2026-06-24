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
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{success: boolean, msg: string} | null>(null)
  const [myGifts, setMyGifts] = useState<any[]>([])
  const [starAddress, setStarAddress] = useState('')
  const [starCount, setStarCount] = useState(1)
  const [starMessage, setStarMessage] = useState('')
  const [starSubmitting, setStarSubmitting] = useState(false)
  const [starResult, setStarResult] = useState('')
  const [activeTab, setActiveTab] = useState<'gift'|'stars'>('gift')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      setProfile(p)
      const { data: gifts } = await supabase.from('life_gifts').select('*').eq('giver_id', data.user.id).order('created_at', { ascending: false })
      setMyGifts(gifts || [])
      setLoading(false)
    })
  }, [])

  async function giftLife(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)

    if ((profile?.lives_remaining || 0) <= 0) {
      setResult({ success: false, msg: 'You have no Lives to gift. You can donate to the community pool once you earn more.' })
      setSubmitting(false)
      return
    }

    // Find recipient by address
    const { data: recipient } = await supabase.from('profiles').select('*').ilike('address', `%${address.trim()}%`).single()

    if (!recipient) {
      setResult({ success: false, msg: 'No resident found at that address. Please check and try again.' })
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
      setResult({ success: false, msg: `This resident already has ${recipientLives} Lives. Would you like to donate to the community pool instead? Contact your manager.` })
      setSubmitting(false)
      return
    }

    // Deduct from giver, add to recipient
    await Promise.all([
      supabase.from('profiles').update({ lives_remaining: (profile.lives_remaining || 1) - 1 }).eq('id', profile.id),
      supabase.from('profiles').update({ lives_remaining: recipientLives + 1 }).eq('id', recipient.id),
      supabase.from('life_gifts').insert({
        giver_id: profile.id,
        recipient_address: address,
        recipient_id: recipient.id,
        status: 'delivered',
        message: message || null,
      })
    ])

    setResult({ success: true, msg: `❤️ Life gifted successfully! The resident at ${address} now has ${recipientLives + 1} Lives.` })
    setProfile({ ...profile, lives_remaining: (profile.lives_remaining || 1) - 1 })
    setAddress('')
    setMessage('')
    setSubmitting(false)

    // Refresh gifts
    const { data: gifts } = await supabase.from('life_gifts').select('*').eq('giver_id', profile.id).order('created_at', { ascending: false })
    setMyGifts(gifts || [])
  }

  async function giveStars(e: React.FormEvent) {
    e.preventDefault()
    setStarSubmitting(true)
    setStarResult('')

    const { data: recipient } = await supabase.from('profiles').select('*').ilike('address', `%${starAddress.trim()}%`).single()

    if (!recipient) {
      setStarResult('No resident found at that address.')
      setStarSubmitting(false)
      return
    }

    const newStars = (recipient.stars_received || 0) + starCount
    const newLives = Math.floor(newStars / 15)
    const previousLives = Math.floor((recipient.stars_received || 0) / 15)
    const bonusLife = newLives > previousLives

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
      ? `⭐ ${starCount} star${starCount > 1 ? 's' : ''} given! This resident has reached ${newStars} stars and earned a bonus Life!`
      : `⭐ ${starCount} star${starCount > 1 ? 's' : ''} given! They now have ${newStars} total stars. (${15 - (newStars % 15)} more until a bonus Life)`
    )
    setStarAddress('')
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
        {/* Your stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
            <p className="text-xs text-gray-400">Your Lives</p>
            <p className="text-2xl">{'❤️'.repeat(Math.min(profile?.lives_remaining || 0, 5))}{(profile?.lives_remaining || 0) === 0 ? '🤍' : ''}</p>
            <p className="text-xs text-gray-500 font-medium">{profile?.lives_remaining || 0} remaining</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
            <p className="text-xs text-gray-400">Stars received</p>
            <p className="text-2xl">⭐</p>
            <p className="text-xs text-gray-500 font-medium">{profile?.stars_received || 0} · {15 - ((profile?.stars_received || 0) % 15)} until bonus Life</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button onClick={() => setActiveTab('gift')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'gift' ? 'border-green-500 text-green-700' : 'border-transparent text-gray-400'}`}>
            ❤️ Gift a Life
          </button>
          <button onClick={() => setActiveTab('stars')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'stars' ? 'border-green-500 text-green-700' : 'border-transparent text-gray-400'}`}>
            ⭐ Give stars
          </button>
        </div>

        {activeTab === 'gift' ? (
          <>
            <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3">
              <p className="text-xs text-green-700 leading-relaxed">
                💚 You have <strong>{profile?.lives_remaining || 0} Lives</strong> available to gift. Gift one to a neighbor who needs volunteer help but has used theirs. No expectations — pure community spirit.
              </p>
            </div>

            <form onSubmit={giftLife} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Recipient's house number or address</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="e.g. 142 or 142 Oak Drive" required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
                <p className="text-xs text-gray-400 mt-1">Their identity remains private — system matches by address only</p>
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
                {submitting ? 'Gifting...' : '❤️ Gift a Life'}
              </button>
            </form>

            {myGifts.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-medium text-gray-500 mb-3">Your recent gifts</p>
                <div className="space-y-2">
                  {myGifts.slice(0, 5).map(g => (
                    <div key={g.id} className="flex items-center gap-2 text-xs text-gray-500">
                      <span>❤️</span>
                      <span>{g.recipient_address} · {new Date(g.created_at).toLocaleDateString()}</span>
                      <span className={`ml-auto px-2 py-0.5 rounded-lg ${g.status === 'delivered' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>{g.status}</span>
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
                ⭐ Give stars to volunteers, helpers, or any neighbor who made a difference. Every 15 stars earns them a bonus Life automatically!
              </p>
            </div>

            <form onSubmit={giveStars} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Recipient's house number or address</label>
                <input type="text" value={starAddress} onChange={e => setStarAddress(e.target.value)}
                  placeholder="e.g. 142 or 142 Oak Drive" required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Number of stars to give</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => setStarCount(n)}
                      className={`flex-1 py-2 rounded-xl text-sm transition-all ${starCount === n ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {'⭐'.repeat(n)}
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
