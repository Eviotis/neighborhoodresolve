'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

export default function VolunteersPage() {
  const router = useRouter()
  const [volunteers, setVolunteers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({ skills: '', address_number: '', compensation: 'free', role_interest: 'volunteer_only' })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      loadVolunteers()
    })
  }, [])

  async function loadVolunteers() {
    const { data } = await supabase.from('volunteers').select('*').order('created_at', { ascending: false })
    setVolunteers(data || [])
    setLoading(false)
  }

  async function joinPool(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('volunteers').insert({
      user_id: user?.id,
      skills: form.skills,
      address_number: form.address_number,
      compensation: form.compensation,
      role_interest: form.role_interest,
      status: 'available',
      free_visits_used: 0,
      created_at: new Date().toISOString(),
    })
    setSuccess(true)
    setShowForm(false)
    loadVolunteers()
    setSubmitting(false)
  }

  const initials = (id: string) => id.slice(0, 2).toUpperCase()
  const avatarColors = ['bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-amber-100 text-amber-700', 'bg-green-100 text-green-700']

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Volunteer pool</h1>
            <p className="text-xs text-gray-400 mt-0.5">Neighbors helping neighbors · first visit free</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="text-xs font-medium text-white px-3 py-2 rounded-xl" style={{background:'#1D9E75'}}>
            + Join pool
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* First-free rule explanation */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
          <p className="text-xs text-blue-800 font-medium mb-1">How volunteer requests work</p>
          <p className="text-xs text-blue-700 leading-relaxed">
            Each household receives <strong>one free volunteer visit per issue per year</strong>. After that, a small contribution or skill trade is encouraged. Volunteers respond only to requests that match their skills — no pressure to accept every request.
          </p>
        </div>

        {/* Join form */}
        {showForm && (
          <form onSubmit={joinPool} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
            <p className="text-sm font-medium text-gray-700">Join the volunteer pool</p>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">House number only</label>
              <input type="text" value={form.address_number} onChange={e => setForm({...form, address_number: e.target.value})}
                placeholder="e.g. 142" required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Skills you can offer</label>
              <input type="text" value={form.skills} onChange={e => setForm({...form, skills: e.target.value})}
                placeholder="e.g. Lawn care, painting, general repairs" required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Compensation preference</label>
              <select value={form.compensation} onChange={e => setForm({...form, compensation: e.target.value})}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-green-500">
                <option value="free">I'll help for free</option>
                <option value="materials">Material costs only</option>
                <option value="small_fee">Open to small compensation</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Also interested in a role?</label>
              <select value={form.role_interest} onChange={e => setForm({...form, role_interest: e.target.value})}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-green-500">
                <option value="volunteer_only">Volunteer help only</option>
                <option value="messenger">Yes — enter me for Messenger drawing</option>
                <option value="verifier">Yes — enter me for Verifier drawing</option>
                <option value="any">Yes — any role</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl text-xs font-medium border border-gray-200 text-gray-500">Cancel</button>
              <button type="submit" disabled={submitting}
                className="flex-1 py-3 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
                {submitting ? 'Joining...' : 'Join pool'}
              </button>
            </div>
          </form>
        )}

        {success && (
          <div className="bg-green-50 rounded-2xl px-4 py-3 text-xs text-green-700">
            ✓ You've been added to the volunteer pool! The Messenger will contact you when a matching request comes in.
          </div>
        )}

        {/* Volunteer list */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h2 className="text-sm font-medium text-gray-700">{volunteers.length} volunteers in pool</h2>
          </div>
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Loading...</div>
          ) : volunteers.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">No volunteers yet</p>
              <p className="text-xs text-gray-300 mt-1">Be the first to join the pool</p>
            </div>
          ) : volunteers.map((v, i) => (
            <div key={v.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${avatarColors[i % avatarColors.length]}`}>
                {v.address_number ? `H${v.address_number}` : '??'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">House {v.address_number}</p>
                <p className="text-xs text-gray-400 truncate">{v.skills}</p>
                <p className="text-xs text-gray-300">{v.compensation === 'free' ? 'Free help' : v.compensation === 'materials' ? 'Materials only' : 'Small fee'}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                v.status === 'available' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                {v.status === 'available' ? 'Available' : 'On assignment'}
              </span>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
