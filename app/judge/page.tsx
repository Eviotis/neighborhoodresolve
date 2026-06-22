'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

export default function JudgePage() {
  const router = useRouter()
  const [escalatedCases, setEscalatedCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ruling, setRuling] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string|null>(null)
  const [submitted, setSubmitted] = useState<string[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      loadCases()
    })
  }, [])

  async function loadCases() {
    const { data } = await supabase.from('cases').select('*').eq('status', 'escalated').order('created_at')
    setEscalatedCases(data || [])
    setLoading(false)
  }

  async function submitRuling(caseId: string) {
    if (!ruling[caseId]) return
    setSubmitting(caseId)
    await supabase.from('cases').update({
      judge_ruling: ruling[caseId],
      status: ruling[caseId] === 'resolved_by_judge' ? 'resolved' : 'escalated',
      updated_at: new Date().toISOString(),
    }).eq('id', caseId)
    setSubmitted(prev => [...prev, caseId])
    setSubmitting(null)
    loadCases()
  }

  const rulingOptions = [
    { value: 'formal_warning', label: 'Issue formal community warning', icon: '📋' },
    { value: 'dispatch_volunteer', label: 'Dispatch volunteer assistance', icon: '🤝' },
    { value: 'human_moderator', label: 'Escalate to human moderator', icon: '👤' },
    { value: 'resolved_by_judge', label: 'Mark resolved by panel', icon: '✅' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-semibold text-gray-900">⚖️ Judge panel</h1>
          <p className="text-xs text-gray-400 mt-0.5">Escalation tier · 3+ strikes · randomly selected panel</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Explanation */}
        <div className="bg-purple-50 border border-purple-100 rounded-2xl px-4 py-3">
          <p className="text-xs text-purple-800 font-medium mb-1">How the judge panel works</p>
          <p className="text-xs text-purple-700 leading-relaxed">
            Cases with 3 or more unresolved strikes are escalated here. A panel of 3 randomly selected residents reviews the case and issues a ruling. Panel members are drawn from the volunteer pool.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm text-gray-400">Loading escalated cases...</div>
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
                <div className="flex items-center gap-2">
                  <span className="text-purple-700 font-medium text-sm">{c.category}</span>
                  <span className="text-xs text-purple-500">· {c.strike_count} strikes · Day {daysSince}</span>
                </div>
                <p className="text-xs text-purple-600 mt-0.5">{c.location}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-gray-600 leading-relaxed mb-4">{c.description}</p>

                {isSubmitted ? (
                  <div className="bg-green-50 rounded-xl px-3 py-3 text-xs text-green-700 text-center">
                    ✓ Ruling submitted for this case
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-medium text-gray-500 mb-2">Panel ruling</p>
                    <div className="space-y-2 mb-4">
                      {rulingOptions.map(opt => (
                        <label key={opt.value}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            ruling[c.id] === opt.value
                              ? 'border-purple-300 bg-purple-50'
                              : 'border-gray-100 bg-gray-50'
                          }`}>
                          <input type="radio" name={`ruling-${c.id}`} value={opt.value}
                            onChange={() => setRuling(prev => ({...prev, [c.id]: opt.value}))}
                            className="accent-purple-600"/>
                          <span className="text-base">{opt.icon}</span>
                          <span className="text-xs text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={() => submitRuling(c.id)}
                      disabled={!ruling[c.id] || submitting === c.id}
                      className={`w-full py-3 rounded-xl text-xs font-medium text-white transition-all active:scale-95 ${
                        ruling[c.id] ? '' : 'opacity-40'
                      }`}
                      style={{background:'#534AB7'}}>
                      {submitting === c.id ? 'Submitting...' : 'Submit panel ruling'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}

        {/* Past rulings */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">About this panel</p>
          <div className="space-y-2 text-xs text-gray-600 leading-relaxed">
            <p>• Panel members are randomly selected from the volunteer pool</p>
            <p>• All 3 members must cast a vote before a ruling is finalized</p>
            <p>• Rulings are binding within the community agreement</p>
            <p>• This process replaces costly HOA legal proceedings</p>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
