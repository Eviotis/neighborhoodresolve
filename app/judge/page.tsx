'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

export default function JudgePage() {
  const router = useRouter()
  const [escalatedCases, setEscalatedCases] = useState<any[]>([])
  const [resolvedCases, setResolvedCases] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [ruling, setRuling] = useState<Record<string, string>>({})
  const [rulingNote, setRulingNote] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string|null>(null)
  const [submitted, setSubmitted] = useState<string[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      setProfile(p)
      loadCases()
    })
  }, [])

  async function loadCases() {
    const [escalated, resolved] = await Promise.all([
      supabase.from('cases').select('*').eq('status', 'escalated').order('created_at'),
      supabase.from('cases').select('*').eq('status', 'resolved').not('judge_ruling', 'is', null).order('resolved_at', { ascending: false }).limit(5),
    ])
    setEscalatedCases(escalated.data || [])
    setResolvedCases(resolved.data || [])
    setLoading(false)
  }

  async function submitRuling(caseId: string) {
    if (!ruling[caseId]) return
    setSubmitting(caseId)
    
    const isResolved = ruling[caseId] === 'resolved_by_judge'
    
    await supabase.from('cases').update({
      judge_ruling: ruling[caseId],
      judge_ruling_note: rulingNote[caseId] || null,
      status: isResolved ? 'resolved' : 'escalated',
      resolved_at: isResolved ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', caseId)

    // Notify ADMIN and MGR of ruling
    const { data: managers } = await supabase.from('profiles').select('email').in('access_level', ['A', 'B1'])
    if (managers && managers.length > 0) {
      const emails = managers.map((m: any) => m.email).filter(Boolean)
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emails,
          subject: `Judge panel ruling issued`,
          html: `<p>A judge panel ruling has been issued for a case.</p><p><strong>Ruling:</strong> ${ruling[caseId]}</p>${rulingNote[caseId] ? `<p><strong>Notes:</strong> ${rulingNote[caseId]}</p>` : ''}`
        })
      }).catch(() => {})
    }

    setSubmitted(prev => [...prev, caseId])
    setSubmitting(null)
    loadCases()
  }

  const rulingOptions = [
    { value: 'formal_warning', label: 'Issue formal community warning', icon: '📋', desc: 'A formal written warning is issued to the resident on record' },
    { value: 'dispatch_volunteer', label: 'Dispatch volunteer assistance', icon: '🤝', desc: 'A volunteer is sent to help resolve the physical issue' },
    { value: 'human_moderator', label: 'Escalate to human moderator', icon: '👤', desc: 'A community moderator (ADMIN/MGR) will personally intervene' },
    { value: 'extension_granted', label: 'Grant resident more time', icon: '⏰', desc: 'The resident is given additional time to resolve the issue' },
    { value: 'resolved_by_judge', label: 'Mark resolved by panel', icon: '✅', desc: 'The panel determines the issue has been sufficiently addressed' },
  ]

  const isMGR = profile && ['A','B1','B2','B3'].includes(profile.access_level)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
              ← Home
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">⚖️ Judge panel</h1>
          </div>
          <p className="text-xs text-gray-400">Escalation tier · 3+ strikes · randomly selected panel</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* How it works */}
        <div className="bg-purple-50 border border-purple-100 rounded-2xl px-4 py-3">
          <p className="text-xs text-purple-800 font-medium mb-1">How the judge panel works</p>
          <div className="space-y-1 text-xs text-purple-700 leading-relaxed">
            <p>• Cases with 3+ unresolved strikes are automatically escalated here</p>
            <p>• A panel of 3 randomly selected residents reviews each case</p>
            <p>• Panel issues a ruling — no HOA lawyers, no legal fees</p>
            <p>• B2 overseers have a 4-hour window to object to any ruling</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm text-gray-400">Loading...</div>
        ) : escalatedCases.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-12 text-center">
            <p className="text-2xl mb-3">✅</p>
            <p className="text-sm font-medium text-gray-700">No cases need judging</p>
            <p className="text-xs text-gray-400 mt-1">All issues are being resolved through the normal process</p>
          </div>
        ) : escalatedCases.map(c => {
          const daysSince = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000) + 1
          const isSubmitted = submitted.includes(c.id)
          return (
            <div key={c.id} className="bg-white rounded-2xl border-2 border-purple-200 overflow-hidden">
              <div className="bg-purple-50 px-4 py-3 border-b border-purple-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-800">{c.category}</p>
                    <p className="text-xs text-purple-500">{c.location} · {c.strike_count} strikes · Day {daysSince}</p>
                  </div>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg font-medium">
                    {c.strike_count} strikes
                  </span>
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-gray-600 leading-relaxed mb-3">{c.description}</p>

                {c.pr_timeline && (
                  <div className="bg-blue-50 rounded-xl px-3 py-2 mb-3">
                    <p className="text-xs text-blue-700 font-medium mb-0.5">Resident's timeline</p>
                    <p className="text-xs text-blue-600">{c.pr_timeline}</p>
                  </div>
                )}

                {isSubmitted ? (
                  <div className="bg-green-50 rounded-xl px-3 py-3 text-xs text-green-700 text-center">
                    ✓ Ruling submitted — ADMIN and Messenger notified
                  </div>
                ) : isMGR ? (
                  <>
                    <p className="text-xs font-medium text-gray-500 mb-2">Panel ruling</p>
                    <div className="space-y-2 mb-3">
                      {rulingOptions.map(opt => (
                        <label key={opt.value}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            ruling[c.id] === opt.value ? 'border-purple-300 bg-purple-50' : 'border-gray-100 bg-gray-50'}`}>
                          <input type="radio" name={`ruling-${c.id}`} value={opt.value}
                            onChange={() => setRuling(prev => ({...prev, [c.id]: opt.value}))}
                            className="accent-purple-600 mt-0.5"/>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{opt.icon}</span>
                              <span className="text-xs font-medium text-gray-700">{opt.label}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs text-gray-500 mb-1.5">Panel notes (optional)</label>
                      <textarea
                        value={rulingNote[c.id] || ''}
                        onChange={e => setRulingNote(prev => ({...prev, [c.id]: e.target.value}))}
                        placeholder="Add context or instructions for this ruling..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-purple-400 resize-none"/>
                    </div>
                    <button
                      onClick={() => submitRuling(c.id)}
                      disabled={!ruling[c.id] || submitting === c.id}
                      className={`w-full py-3 rounded-xl text-xs font-medium text-white transition-all active:scale-95 ${!ruling[c.id] ? 'opacity-40' : ''}`}
                      style={{background:'#534AB7'}}>
                      {submitting === c.id ? 'Submitting...' : 'Submit panel ruling'}
                    </button>
                  </>
                ) : (
                  <div className="bg-gray-50 rounded-xl px-3 py-3 text-xs text-gray-500 text-center">
                    Only Messengers and Managers can issue rulings
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Recent rulings */}
        {resolvedCases.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-medium text-gray-500 mb-3">Recent panel rulings</p>
            <div className="space-y-3">
              {resolvedCases.map(c => (
                <div key={c.id} className="border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                  <p className="text-xs font-medium text-gray-700">{c.category} · {c.location}</p>
                  <p className="text-xs text-purple-600 mt-0.5">
                    {rulingOptions.find(r => r.value === c.judge_ruling)?.icon} {rulingOptions.find(r => r.value === c.judge_ruling)?.label || c.judge_ruling}
                  </p>
                  {c.judge_ruling_note && <p className="text-xs text-gray-400 mt-0.5">{c.judge_ruling_note}</p>}
                  <p className="text-xs text-gray-300 mt-0.5">{c.resolved_at ? new Date(c.resolved_at).toLocaleDateString() : ''}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
