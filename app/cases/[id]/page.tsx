'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

const steps = ['Reported', 'Messenger notified', 'Resident notified', 'Verifier engaged', 'Resolved']

export default function CaseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [caseData, setCaseData] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [prTimeline, setPrTimeline] = useState('')
  const [showTimelineForm, setShowTimelineForm] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      setProfile(p)
      loadCase()
    })
  }, [])

  async function loadCase() {
    const { data } = await supabase.from('cases').select('*').eq('id', params.id).single()
    setCaseData(data)
    setLoading(false)
  }

  async function updateStatus(status: string) {
    setUpdating(true)
    await supabase.from('cases').update({ status, updated_at: new Date().toISOString() }).eq('id', params.id)
    await loadCase()
    setUpdating(false)
  }

  async function issueStrike() {
    setUpdating(true)
    const newCount = (caseData.strike_count || 0) + 1
    const newStatus = newCount >= 3 ? 'escalated' : 'strike'
    await supabase.from('cases').update({
      strike_count: newCount,
      status: newStatus,
      updated_at: new Date().toISOString()
    }).eq('id', params.id)
    await loadCase()
    setUpdating(false)
  }

  async function markResolved() {
    setUpdating(true)
    await supabase.from('cases').update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', params.id)
    await loadCase()
    setUpdating(false)
  }

  async function submitTimeline() {
    if (!prTimeline.trim()) return
    setUpdating(true)
    await supabase.from('cases').update({
      pr_timeline: prTimeline,
      status: 'pending',
      updated_at: new Date().toISOString()
    }).eq('id', params.id)
    setShowTimelineForm(false)
    await loadCase()
    setUpdating(false)
  }

  async function togglePRHelp() {
    setUpdating(true)
    await supabase.from('cases').update({
      pr_needs_help: !caseData.pr_needs_help,
      updated_at: new Date().toISOString()
    }).eq('id', params.id)
    await loadCase()
    setUpdating(false)
  }

  const getStepIndex = (status: string) => {
    const map: Record<string, number> = { open: 1, pending: 2, strike: 3, escalated: 3, resolved: 5 }
    return map[status] || 1
  }

  const isMessenger = profile?.access_level === 'B1' || profile?.access_level === 'B2' || profile?.access_level === 'B3' || profile?.access_level === 'A'
  const isMGR = profile?.access_level === 'B1' || profile?.access_level === 'B2' || profile?.access_level === 'A'
  const isAdmin = profile?.access_level === 'A'

  const getExpiryDate = (resolvedAt: string) => {
    const d = new Date(resolvedAt)
    d.setDate(d.getDate() + 30)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>
  if (!caseData) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Case not found</div>

  const stepIndex = getStepIndex(caseData.status)
  const daysSince = Math.floor((Date.now() - new Date(caseData.created_at).getTime()) / 86400000) + 1
  const isEscalated = caseData.status === 'escalated'
  const isResolved = caseData.status === 'resolved'

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/cases" className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </Link>
          <div>
            <h1 className="text-base font-semibold text-gray-900">{caseData.category}</h1>
            <p className="text-xs text-gray-400">{caseData.location} · Day {daysSince}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Status badge */}
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
          isResolved ? 'bg-green-50 text-green-700' :
          isEscalated ? 'bg-purple-50 text-purple-700' :
          caseData.status === 'strike' ? 'bg-red-50 text-red-700' :
          'bg-amber-50 text-amber-700'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current"/>
          {isResolved ? 'Resolved' : isEscalated ? 'Escalated to judge panel' : caseData.status === 'strike' ? `${caseData.strike_count} strike${caseData.strike_count !== 1 ? 's' : ''} issued` : 'In progress'}
        </div>

        {/* Progress steps */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-4">Resolution progress</p>
          <div className="relative">
            <div className="absolute top-4 left-4 right-4 h-px bg-gray-100"/>
            <div className="flex justify-between relative">
              {steps.map((step, i) => (
                <div key={step} className="flex flex-col items-center gap-1.5" style={{width: '20%'}}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 border-2 ${
                    i < stepIndex ? 'bg-green-500 border-green-500' :
                    i === stepIndex ? 'bg-white border-green-500' :
                    'bg-white border-gray-200'
                  }`}>
                    {i < stepIndex ? (
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                    ) : (
                      <span className={`text-xs font-medium ${i === stepIndex ? 'text-green-600' : 'text-gray-300'}`}>{i+1}</span>
                    )}
                  </div>
                  <p className="text-center leading-tight" style={{fontSize:'9px', color: i < stepIndex ? '#374151' : '#d1d5db'}}>{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Description</p>
          <p className="text-sm text-gray-700 leading-relaxed">{caseData.description}</p>
          {caseData.need_volunteer && (
            <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-xl">
              🤝 Volunteer assistance requested
            </div>
          )}

          {/* Photos */}
          {caseData.photo_urls && Array.isArray(caseData.photo_urls) && caseData.photo_urls.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-400 mb-2">Before photos</p>
              <div className="grid grid-cols-3 gap-2">
                {caseData.photo_urls.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} className="rounded-xl w-full h-20 object-cover border border-gray-100" alt={`Photo ${i+1}`}
                      onError={(e) => { (e.target as HTMLImageElement).style.display='none' }}/>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PR Timeline */}
        {caseData.pr_timeline && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
            <p className="text-xs font-medium text-blue-700 mb-1">📅 Resident's resolution timeline</p>
            <p className="text-sm text-blue-800">{caseData.pr_timeline}</p>
          </div>
        )}

        {/* PR needs help */}
        {caseData.pr_needs_help && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
            <p className="text-xs font-medium text-amber-700">🙏 Resident has indicated they need help and welcome volunteer assistance</p>
          </div>
        )}

        {/* PR response form */}
        {!isResolved && !showTimelineForm && (
          <button onClick={() => setShowTimelineForm(true)}
            className="w-full py-3 rounded-2xl text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700">
            📅 I am the resident — submit my resolution timeline
          </button>
        )}

        {showTimelineForm && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <p className="text-xs font-medium text-gray-700">Your resolution timeline</p>
            <textarea value={prTimeline} onChange={e => setPrTimeline(e.target.value)}
              placeholder="e.g. I will fix this by Saturday."
              rows={3} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 resize-none"/>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={caseData.pr_needs_help || false} onChange={togglePRHelp} className="accent-green-600"/>
              I have an emergency and welcome volunteer help
            </label>
            <div className="flex gap-2">
              <button onClick={() => setShowTimelineForm(false)} className="flex-1 py-2.5 rounded-xl text-xs border border-gray-200 text-gray-500">Cancel</button>
              <button onClick={submitTimeline} disabled={updating}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
                Submit timeline
              </button>
            </div>
          </div>
        )}

        {/* Strike warning */}
        {caseData.strike_count >= 2 && !isResolved && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            <p className="text-xs text-red-700 font-medium">⚠️ {caseData.strike_count} strikes on record</p>
            <p className="text-xs text-red-600 mt-1">One more unresolved strike triggers automatic escalation to the judge panel.</p>
          </div>
        )}

        {/* Judge panel notice */}
        {isEscalated && (
          <div className="bg-purple-50 border border-purple-100 rounded-2xl px-4 py-3">
            <p className="text-xs text-purple-700 font-medium">⚖️ Judge panel active</p>
            <Link href="/judge" className="mt-1 inline-block text-xs text-purple-700 font-medium underline">View judge panel →</Link>
          </div>
        )}

        {/* Messenger actions — credential controlled */}
        {!isResolved && !isEscalated && isMessenger && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <p className="text-xs font-medium text-gray-500">Messenger actions</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => updateStatus('pending')} disabled={updating}
                className="py-3 rounded-xl text-xs font-medium border border-amber-200 bg-amber-50 text-amber-700 active:scale-95 transition-transform">
                Mark awaiting response
              </button>
              {isMGR && (
                <button onClick={issueStrike} disabled={updating}
                  className="py-3 rounded-xl text-xs font-medium border border-red-200 bg-red-50 text-red-700 active:scale-95 transition-transform">
                  Issue strike
                </button>
              )}
              {isAdmin && (
                <button onClick={() => updateStatus('escalated')} disabled={updating}
                  className="py-3 rounded-xl text-xs font-medium border border-purple-200 bg-purple-50 text-purple-700 active:scale-95 transition-transform">
                  Escalate to judge
                </button>
              )}
              <button onClick={markResolved} disabled={updating}
                className="py-3 rounded-xl text-xs font-medium border border-green-200 bg-green-50 text-green-700 active:scale-95 transition-transform">
                ✓ Mark resolved
              </button>
            </div>
          </div>
        )}

        {/* Resolved state */}
        {isResolved && (
          <div className="bg-green-50 rounded-2xl px-4 py-4 text-center space-y-3">
            <p className="text-green-700 font-medium text-sm">✓ Case resolved</p>
            {caseData.resolved_at && (
              <p className="text-xs text-green-600">
                Auto-deleted on {getExpiryDate(caseData.resolved_at)} · {isMGR ? 'MGR/Admin can delete early' : 'Contact your manager to delete early'}
              </p>
            )}
            <Link href="/cases"
              className="inline-block px-5 py-2.5 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
              See other open cases
            </Link>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
