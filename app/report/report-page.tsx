'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

const categories = [
  'Lawn & landscaping',
  'Noise complaint',
  'Property upkeep / appearance',
  'Parking violation',
  'Trash / debris',
  'Fence or structure',
  'Pest or infestation',
  'Other',
]

export default function ReportPage() {
  const router = useRouter()
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [needVolunteer, setNeedVolunteer] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    // Check 1-per-month rule
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString())

    if ((count || 0) >= 1) {
      setError('You have already submitted a report this month. One report per household per month keeps the system fair.')
      setLoading(false)
      return
    }

    // Submit — reporter identity stripped from the visible record
    const { error: insertError } = await supabase.from('cases').insert({
      category,
      location,
      description,
      need_volunteer: needVolunteer,
      status: 'open',
      strike_count: 0,
      created_at: new Date().toISOString(),
    })

    if (insertError) {
      setError('Something went wrong. Please try again.')
    } else {
      setSubmitted(true)
    }
    setLoading(false)
  }

  if (submitted) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 pb-24">
      <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4">
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#1D9E75" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Report submitted</h2>
      <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
        Your report has been sent anonymously to the Messenger on duty. Your identity will never be revealed.
      </p>
      <button onClick={() => router.push('/dashboard')}
        className="px-6 py-3 rounded-xl text-white text-sm font-medium" style={{background:'#1D9E75'}}>
        Back to dashboard
      </button>
      <BottomNav />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-semibold text-gray-900">Report an issue</h1>
          <p className="text-xs text-gray-400 mt-0.5">Completely anonymous · 1 per household per month</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Anonymity banner */}
        <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3 mb-4 flex gap-3">
          <span className="text-green-600 text-lg">🔒</span>
          <p className="text-xs text-green-700 leading-relaxed">
            Your name and address are <strong>never</strong> attached to this report. Only the Messenger sees it — without any identifying information.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Issue category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-green-500" required>
                <option value="">Select a category…</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location <span className="font-normal text-gray-400">(street or block — not your address)</span>
              </label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                placeholder="e.g. 200 block of Oak Drive"
                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500" required/>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Describe the issue</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Be specific and factual. No personal attacks or names."
                rows={4}
                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 resize-none" required/>
            </div>

            {/* Volunteer toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-700">Request volunteer help?</p>
                <p className="text-xs text-gray-400 mt-0.5">First visit is free · one per year per household</p>
              </div>
              <button type="button" onClick={() => setNeedVolunteer(!needVolunteer)}
                className={`w-12 h-7 rounded-full transition-colors relative ${needVolunteer ? 'bg-green-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${needVolunteer ? 'translate-x-5' : 'translate-x-0.5'}`}/>
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}

          <p className="text-xs text-gray-400 text-center">
            Limit: 1 report per household per month. Repeated issues for the same address are flagged automatically.
          </p>

          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-2xl text-white text-sm font-medium transition-all active:scale-95"
            style={{background: loading ? '#9FE1CB' : '#1D9E75'}}>
            {loading ? 'Submitting...' : 'Submit anonymously'}
          </button>
        </form>
      </div>
      <BottomNav />
    </div>
  )
}
