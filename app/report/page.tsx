'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

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

async function sendNotification(to: string[], subject: string, html: string) {
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html }),
    })
  } catch (e) {
    console.log('Email notification failed:', e)
  }
}

export default function ReportPage() {
  const router = useRouter()
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [needVolunteer, setNeedVolunteer] = useState(false)
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [volunteerCount, setVolunteerCount] = useState(0)
  const [reportCount, setReportCount] = useState(0)
  const [throttled, setThrottled] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [volRes, profileRes] = await Promise.all([
        supabase.from('volunteers').select('id'),
        supabase.from('profiles').select('report_count').eq('id', user.id).single()
      ])
      setVolunteerCount((volRes.data || []).length)
      const count = profileRes.data?.report_count || 0
      setReportCount(count)
      setThrottled(count >= 5)
    }
    loadData()
  }, [])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 3)
    setPhotos(files)
    setPhotoPreviews(files.map(f => URL.createObjectURL(f)))
  }

  async function uploadPhotos(caseId: string): Promise<string[]> {
    const urls: string[] = []
    for (let i = 0; i < photos.length; i++) {
      const file = photos[i]
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${caseId}/${i}.${ext}`
      const { error } = await supabase.storage.from('case-photos').upload(path, file, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from('case-photos').getPublicUrl(path)
        urls.push(data.publicUrl)
      }
    }
    return urls
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: profile } = await supabase.from('profiles').select('report_count, report_weight').eq('id', user.id).single()
    const currentCount = profile?.report_count || 0

    if (currentCount >= 10) {
      setError('You have reached the maximum number of reports. Please contact your neighborhood manager.')
      setLoading(false)
      return
    }

    const newCount = currentCount + 1
    const weight = newCount > 5 ? 2.0 : newCount > 3 ? 3.0 : 5.0

    const { data: newCase, error: insertError } = await supabase.from('cases').insert({
      category, location, description,
      need_volunteer: needVolunteer,
      status: 'open',
      strike_count: 0,
      priority_score: weight,
      photo_urls: [],
      created_at: new Date().toISOString(),
    }).select().single()

    if (insertError || !newCase) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    if (photos.length > 0) {
      const photoUrls = await uploadPhotos(newCase.id)
      if (photoUrls.length > 0) {
        await supabase.from('cases').update({ photo_urls: photoUrls }).eq('id', newCase.id)
      }
    }

    await supabase.from('profiles').update({
      report_count: newCount,
      report_weight: weight,
      updated_at: new Date().toISOString()
    }).eq('id', user.id)

    // Notify ALL managers and ADMIN of every submission
    const { data: managers } = await supabase.from('profiles').select('email').in('access_level', ['A', 'B1', 'B2'])
    if (managers && managers.length > 0) {
      const emails = managers.map((m: any) => m.email).filter(Boolean)
      const caseUrl = `https://project-76shj.vercel.app/cases/${newCase.id}`
      await sendNotification(emails, `New case filed: ${category}`, `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
          <div style="background:#1D9E75;padding:20px;border-radius:12px 12px 0 0">
            <h1 style="color:white;margin:0;font-size:18px">New case filed</h1>
          </div>
          <div style="background:#f9f9f9;padding:20px;border-radius:0 0 12px 12px;border:1px solid #eee">
            <p style="margin:0 0 12px;color:#374151"><strong>Category:</strong> ${category}</p>
            <p style="margin:0 0 12px;color:#374151"><strong>Location:</strong> ${location}</p>
            <p style="margin:0 0 12px;color:#374151"><strong>Description:</strong> ${description}</p>
            <p style="margin:0 0 12px;color:#374151"><strong>Report #${newCount}</strong> from this resident · Weight: ${weight}%</p>
            <a href="${caseUrl}" style="background:#1D9E75;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">View case →</a>
            <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF">Reporter identity protected. Sent to all Messengers and Admins.</p>
          </div>
        </div>
      `)
    }

    // Abuse alert at threshold
    if (newCount >= 5) {
      const { data: admins } = await supabase.from('profiles').select('email').eq('access_level', 'A')
      if (admins && admins.length > 0) {
        await sendNotification(
          admins.map((a: any) => a.email).filter(Boolean),
          `⚠️ High report count alert`,
          `<p>A resident has submitted <strong>${newCount} reports</strong>. Please review for possible abuse. Their report weight has been reduced to ${weight}%.</p>`
        )
      }
    }

    setReportCount(newCount)
    if (newCount >= 5) setThrottled(true)
    setSubmitted(true)
    setLoading(false)
  }

  // Throttled view
  if (throttled && !submitted) return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>← Home</Link>
          <h1 className="text-lg font-semibold text-gray-900">Report an issue</h1>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-base font-semibold text-gray-900 mb-2">Report limit reached</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          You have submitted {reportCount} reports. To maintain fairness in the community, please contact your neighborhood manager to discuss any additional concerns.
        </p>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-4 text-left mb-6">
          <p className="text-xs text-amber-700 font-medium mb-1">What happens now?</p>
          <p className="text-xs text-amber-600 leading-relaxed">Your manager will review your previous reports and work with you on next steps. Your anonymity is fully protected throughout this process.</p>
        </div>
        <Link href="/dashboard" className="inline-block px-6 py-3 rounded-xl text-white text-sm font-medium" style={{background:'#1D9E75'}}>
          Back to dashboard
        </Link>
      </div>
      <BottomNav />
    </div>
  )

  if (submitted) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 pb-24">
      <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4">
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#1D9E75" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Report submitted</h2>
      <p className="text-sm text-gray-500 text-center mb-2 leading-relaxed">
        Your report has been sent anonymously to the Messenger on duty.
      </p>
      {reportCount >= 3 && (
        <p className="text-xs text-amber-600 bg-amber-50 px-4 py-2 rounded-xl text-center mb-4">
          You have submitted {reportCount} reports. After {5 - reportCount} more, you will need to contact your manager for additional reporting.
        </p>
      )}
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
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>← Home</Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Report an issue</h1>
            <p className="text-xs text-gray-400">Always anonymous</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3 mb-4 flex gap-3">
          <span className="text-green-600 text-lg">🔒</span>
          <p className="text-xs text-green-700 leading-relaxed">
            Your name and address are <strong>never</strong> attached to this report. Only the Messenger sees it — without any identifying information.
          </p>
        </div>

        {reportCount >= 3 && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mb-4">
            <p className="text-xs text-amber-700">⚠️ You have submitted {reportCount} reports. After {5 - reportCount} more you will need to contact your manager for additional reporting.</p>
          </div>
        )}

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
                rows={4} className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 resize-none" required/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Photos <span className="font-normal text-gray-400">(optional · up to 3 · before photos)</span>
              </label>
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-xs text-gray-400 hover:border-green-300 transition-colors">
                📷 Tap to add photos
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={handlePhotoChange} className="hidden"/>
              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {photoPreviews.map((p, i) => (
                    <img key={i} src={p} className="rounded-xl w-full h-20 object-cover" alt={`Preview ${i+1}`}/>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-700">Request volunteer help?</p>
                {volunteerCount === 0 ? (
                  <p className="text-xs text-amber-600 mt-0.5">No volunteers in pool yet — join the Volunteers tab to be first!</p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">Uses 1 Life · {volunteerCount} volunteer{volunteerCount !== 1 ? 's' : ''} available</p>
                )}
              </div>
              <button type="button" onClick={() => setNeedVolunteer(!needVolunteer)}
                disabled={volunteerCount === 0}
                className={`w-12 h-7 rounded-full transition-colors relative ${needVolunteer && volunteerCount > 0 ? 'bg-green-500' : 'bg-gray-200'} ${volunteerCount === 0 ? 'opacity-40' : ''}`}>
                <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${needVolunteer && volunteerCount > 0 ? 'translate-x-5' : 'translate-x-0.5'}`}/>
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}

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
