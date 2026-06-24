'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

const categories = [
  { icon: '🌿', name: 'Landscaping' },
  { icon: '🔧', name: 'Plumbing' },
  { icon: '⚡', name: 'Electrical' },
  { icon: '❄️', name: 'HVAC' },
  { icon: '🎨', name: 'Painting' },
  { icon: '🪚', name: 'Carpentry' },
  { icon: '🔨', name: 'Master of Many Trades' },
  { icon: '🧹', name: 'Cleaning' },
  { icon: '💦', name: 'Pressure washing' },
  { icon: '🔌', name: 'Other' },
]

export default function ServicesPage() {
  const router = useRouter()
  const [contractors, setContractors] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedContractor, setSelectedContractor] = useState<any>(null)
  const [activeView, setActiveView] = useState<'list'|'detail'>('list')
  const [showRecommendForm, setShowRecommendForm] = useState(false)
  const [showRemovalForm, setShowRemovalForm] = useState(false)
  const [showRatingForm, setShowRatingForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [ratings, setRatings] = useState<any[]>([])

  const [recommend, setRecommend] = useState({
    business_name: '', owner_name: '', category: '', description: '',
    phone: '', email: '', website: ''
  })
  const [removal, setRemoval] = useState({ reason: '' })
  const [rating, setRating] = useState({ stars: 5, review: '', job_type: '' })

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      setProfile(p)
      loadContractors()
    })
  }, [])

  async function loadContractors() {
    const { data } = await supabase
      .from('contractors')
      .select('*')
      .eq('status', 'approved')
      .order('average_rating', { ascending: false })
    setContractors(data || [])
    setLoading(false)
  }

  async function openContractor(contractor: any) {
    setSelectedContractor(contractor)
    const { data } = await supabase
      .from('contractor_ratings')
      .select('*')
      .eq('contractor_id', contractor.id)
      .order('created_at', { ascending: false })
    setRatings(data || [])
    setActiveView('detail')
  }

  async function notifyManagers(subject: string, html: string) {
    try {
      const { data: managers } = await supabase.from('profiles').select('email').in('access_level', ['A','B1','B2','B3'])
      if (managers && managers.length > 0) {
        await fetch('/api/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: managers.map((m: any) => m.email).filter(Boolean), subject, html })
        })
      }
    } catch(e) {}
  }

  async function submitRecommendation(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await supabase.from('contractors').insert({
      business_name: recommend.business_name,
      owner_name: recommend.owner_name || null,
      category: recommend.category,
      description: recommend.description || null,
      phone: recommend.phone || null,
      email: recommend.email || null,
      website: recommend.website || null,
      community_code: profile?.community_code || 'ADMIN',
      status: 'pending',
      recommended_by: profile?.id,
    })
    await notifyManagers(
      `New contractor recommendation: ${recommend.business_name}`,
      `<div style="font-family:sans-serif">
        <h2 style="color:#1D9E75">New contractor recommendation</h2>
        <p><strong>Business:</strong> ${recommend.business_name}</p>
        <p><strong>Category:</strong> ${recommend.category}</p>
        <p><strong>Phone:</strong> ${recommend.phone || 'Not provided'}</p>
        <p><strong>Description:</strong> ${recommend.description || 'Not provided'}</p>
        <p><em>Please review and approve or reject in the admin panel.</em></p>
      </div>`
    )
    setShowRecommendForm(false)
    setRecommend({ business_name: '', owner_name: '', category: '', description: '', phone: '', email: '', website: '' })
    setSubmitting(false)
    alert('Thank you! Your recommendation has been sent to all managers for review.')
  }

  async function submitRemovalRequest(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await supabase.from('contractor_removal_requests').insert({
      contractor_id: selectedContractor.id,
      requested_by: profile?.id,
      reason: removal.reason,
      status: 'pending',
    })
    await notifyManagers(
      `⚠️ Contractor removal request: ${selectedContractor.business_name}`,
      `<div style="font-family:sans-serif">
        <h2 style="color:#E24B4A">Contractor removal request</h2>
        <p><strong>Contractor:</strong> ${selectedContractor.business_name}</p>
        <p><strong>Category:</strong> ${selectedContractor.category}</p>
        <p><strong>Reason:</strong> ${removal.reason}</p>
        <p><em>Requester identity is protected. All managers must review. Majority vote needed for removal.</em></p>
      </div>`
    )
    setShowRemovalForm(false)
    setRemoval({ reason: '' })
    setSubmitting(false)
    alert('Removal request sent anonymously to all managers.')
  }

  async function submitRating(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await supabase.from('contractor_ratings').insert({
      contractor_id: selectedContractor.id,
      rater_id: profile?.id,
      stars: rating.stars,
      review: rating.review || null,
      job_type: rating.job_type || null,
    })
    // Update average rating
    const { data: allRatings } = await supabase.from('contractor_ratings').select('stars').eq('contractor_id', selectedContractor.id)
    if (allRatings && allRatings.length > 0) {
      const avg = allRatings.reduce((sum: number, r: any) => sum + r.stars, 0) / allRatings.length
      await supabase.from('contractors').update({
        average_rating: Math.round(avg * 10) / 10,
        total_ratings: allRatings.length
      }).eq('id', selectedContractor.id)
    }
    const { data } = await supabase.from('contractor_ratings').select('*').eq('contractor_id', selectedContractor.id).order('created_at', { ascending: false })
    setRatings(data || [])
    setShowRatingForm(false)
    setRating({ stars: 5, review: '', job_type: '' })
    setSubmitting(false)
    loadContractors()
  }

  const isMGR = profile && ['A','B1','B2','B3'].includes(String(profile.access_level))
  const filtered = selectedCategory === 'All' ? contractors : contractors.filter(c => c.category === selectedCategory)

  const StarDisplay = ({ count }: { count: number }) => (
    <span className="text-amber-400">{'⭐'.repeat(Math.round(count))}{'☆'.repeat(5 - Math.round(count))}</span>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeView === 'detail' ? (
              <button onClick={() => { setActiveView('list'); setSelectedContractor(null) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
                ← Services
              </button>
            ) : (
              <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
                ← Home
              </Link>
            )}
            <h1 className="text-lg font-semibold text-gray-900">
              {activeView === 'detail' && selectedContractor ? String(selectedContractor.business_name) : 'Services'}
            </h1>
          </div>
          {activeView === 'list' && (
            <button onClick={() => setShowRecommendForm(!showRecommendForm)}
              className="text-xs font-medium text-white px-3 py-1.5 rounded-xl" style={{background:'#1D9E75'}}>
              + Recommend
            </button>
          )}
        </div>
        {activeView === 'detail' && selectedContractor && (
          <div className="max-w-lg mx-auto mt-1 flex items-center gap-2">
            <StarDisplay count={selectedContractor.average_rating || 0}/>
            <span className="text-xs text-gray-400">{selectedContractor.average_rating || 0} · {selectedContractor.total_ratings || 0} review{selectedContractor.total_ratings !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {activeView === 'list' ? (
          <>
            {/* Recommendation form */}
            {showRecommendForm && (
              <form onSubmit={submitRecommendation} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">Recommend a contractor</p>
                <p className="text-xs text-gray-400">Your recommendation goes to all managers for approval before listing.</p>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Category</label>
                  <select value={recommend.category} onChange={e => setRecommend({...recommend, category: e.target.value})} required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-green-500">
                    <option value="">Select category…</option>
                    {categories.map(c => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
                <input type="text" value={recommend.business_name} onChange={e => setRecommend({...recommend, business_name: e.target.value})}
                  placeholder="Business name" required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
                <input type="text" value={recommend.owner_name} onChange={e => setRecommend({...recommend, owner_name: e.target.value})}
                  placeholder="Owner/contact name (optional)"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
                <input type="tel" value={recommend.phone} onChange={e => setRecommend({...recommend, phone: e.target.value})}
                  placeholder="Phone number"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
                <textarea value={recommend.description} onChange={e => setRecommend({...recommend, description: e.target.value})}
                  placeholder="Why do you recommend them? Quality of work, reliability, pricing..." rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 resize-none"/>
                <div className="bg-amber-50 rounded-xl px-3 py-2">
                  <p className="text-xs text-amber-700">⚠️ Conflict of interest: Managers and their family members cannot recommend their own businesses.</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowRecommendForm(false)} className="flex-1 py-3 rounded-xl text-xs border border-gray-200 text-gray-500">Cancel</button>
                  <button type="submit" disabled={submitting} className="flex-1 py-3 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
                    {submitting ? 'Sending...' : 'Submit recommendation'}
                  </button>
                </div>
              </form>
            )}

            {/* Category filter */}
            <div className="overflow-x-auto">
              <div className="flex gap-2 w-max">
                <button onClick={() => setSelectedCategory('All')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${selectedCategory === 'All' ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                  style={selectedCategory === 'All' ? {background:'#1D9E75'} : {}}>
                  All
                </button>
                {categories.map(c => (
                  <button key={c.name} onClick={() => setSelectedCategory(c.name)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${selectedCategory === c.name ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                    style={selectedCategory === c.name ? {background:'#1D9E75'} : {}}>
                    {c.icon} {c.name}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-sm text-gray-400">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 px-4 py-12 text-center">
                <p className="text-3xl mb-3">🔧</p>
                <p className="text-sm font-medium text-gray-700">No contractors listed yet</p>
                <p className="text-xs text-gray-400 mt-1">Know a good one? Click "Recommend" above!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(c => (
                  <button key={String(c.id)} onClick={() => openContractor(c)}
                    className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left active:bg-gray-50">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-lg flex-shrink-0">
                        {categories.find(cat => cat.name === c.category)?.icon || '🔧'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{String(c.business_name)}</p>
                        <p className="text-xs text-gray-400">{String(c.category)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <StarDisplay count={c.average_rating || 0}/>
                          <span className="text-xs text-gray-400">{c.average_rating || 0} ({c.total_ratings || 0})</span>
                        </div>
                      </div>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#d1d5db" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : selectedContractor && (
          <>
            {/* Contractor details */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-2xl">
                  {categories.find(c => c.name === selectedContractor.category)?.icon || '🔧'}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{String(selectedContractor.business_name)}</p>
                  <p className="text-xs text-gray-400">{String(selectedContractor.category)}</p>
                  {selectedContractor.owner_name && <p className="text-xs text-gray-400">Contact: {String(selectedContractor.owner_name)}</p>}
                </div>
              </div>
              {selectedContractor.description && (
                <p className="text-xs text-gray-600 leading-relaxed">{String(selectedContractor.description)}</p>
              )}
              <div className="space-y-2">
                {selectedContractor.phone && (
                  <a href={`tel:${selectedContractor.phone}`}
                    className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-2.5 rounded-xl">
                    📞 {String(selectedContractor.phone)}
                  </a>
                )}
                {selectedContractor.email && (
                  <a href={`mailto:${selectedContractor.email}`}
                    className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 px-3 py-2.5 rounded-xl">
                    ✉️ {String(selectedContractor.email)}
                  </a>
                )}
                {selectedContractor.website && (
                  <a href={String(selectedContractor.website)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-purple-700 bg-purple-50 px-3 py-2.5 rounded-xl">
                    🌐 Visit website
                  </a>
                )}
              </div>
            </div>

            {/* Rate this contractor */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-gray-500">⭐ Reviews ({ratings.length})</p>
                <button onClick={() => setShowRatingForm(!showRatingForm)}
                  className="text-xs font-medium text-white px-3 py-1.5 rounded-xl" style={{background:'#EF9F27'}}>
                  Rate contractor
                </button>
              </div>

              {showRatingForm && (
                <form onSubmit={submitRating} className="space-y-3 mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Your rating</label>
                    <div className="flex gap-2">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} type="button" onClick={() => setRating({...rating, stars: n})}
                          className={`flex-1 py-2 rounded-xl text-sm transition-all ${rating.stars >= n ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-400'}`}>
                          ⭐
                        </button>
                      ))}
                    </div>
                  </div>
                  <input type="text" value={rating.job_type} onChange={e => setRating({...rating, job_type: e.target.value})}
                    placeholder="Type of job done (e.g. lawn mowing)"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-amber-400"/>
                  <textarea value={rating.review} onChange={e => setRating({...rating, review: e.target.value})}
                    placeholder="Your review (optional)" rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 resize-none"/>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowRatingForm(false)} className="flex-1 py-2 rounded-xl text-xs border border-gray-200 text-gray-500">Cancel</button>
                    <button type="submit" disabled={submitting} className="flex-1 py-2 rounded-xl text-xs font-medium text-white" style={{background:'#EF9F27'}}>
                      {submitting ? 'Saving...' : 'Submit review'}
                    </button>
                  </div>
                </form>
              )}

              {ratings.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No reviews yet — be the first!</p>
              ) : ratings.map((r: any) => (
                <div key={String(r.id)} className="border-b border-gray-50 last:border-0 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <StarDisplay count={r.stars}/>
                    {r.job_type && <span className="text-xs text-gray-400">· {String(r.job_type)}</span>}
                  </div>
                  {r.review && <p className="text-xs text-gray-600 leading-relaxed">{String(r.review)}</p>}
                  <p className="text-xs text-gray-300 mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>

            {/* Request removal */}
            {!showRemovalForm ? (
              <button onClick={() => setShowRemovalForm(true)}
                className="w-full py-3 rounded-2xl text-xs font-medium bg-red-50 text-red-500 border border-red-100">
                🚩 Request removal of this contractor
              </button>
            ) : (
              <form onSubmit={submitRemovalRequest} className="bg-white rounded-2xl border border-red-100 p-4 space-y-3">
                <p className="text-sm font-medium text-red-700">Request contractor removal</p>
                <p className="text-xs text-gray-400">Your request is sent anonymously to all managers. A majority vote is required for removal.</p>
                <textarea value={removal.reason} onChange={e => setRemoval({reason: e.target.value})}
                  placeholder="Reason for removal (poor work, conflict of interest, unprofessional behavior...)" rows={3} required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-400 resize-none"/>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowRemovalForm(false)} className="flex-1 py-3 rounded-xl text-xs border border-gray-200 text-gray-500">Cancel</button>
                  <button type="submit" disabled={submitting} className="flex-1 py-3 rounded-xl text-xs font-medium bg-red-500 text-white">
                    {submitting ? 'Sending...' : 'Submit anonymously'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
