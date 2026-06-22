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
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
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

  const getStepIndex = (status: string) => {
    const map: Record<string, number> = { open: 1, pending: 2, strike: 3, escalated: 3, resolved: 4 }
    return map[status] || 1
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
                  <p className="text-center leading-tight" style={{fontSize:'9px', color: i <= stepIndex ? '#374151' : '#d1d5db'}}>{step}</p>
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
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/>
              </svg>
              Volunteer assistance requested
            </div>
          )}
        </div>

        {/* Strike warning */}
        {caseData.strike_count >= 2 && !isResolved && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            <p className="text-xs text-red-700 font-medium mb-1">⚠️ {caseData.strike_count} strikes on record</p>
            <p className="text-xs text-red-600">One more unresolved strike triggers automatic escalation to the judge panel.</p>
          </div>
        )}

        {/* Judge panel notice */}
        {isEscalated && (
          <div className="bg-purple-50 border border-purple-100 rounded-2xl px-4 py-3">
            <p className="text-xs text-purple-700 font-medium mb-1">⚖️ Judge panel active</p>
            <p className="text-xs text-purple-600">This case has been escalated. A randomly selected panel of 3 residents will review and issue a ruling.</p>
            <Link href="/judge" className="mt-2 inline-block text-xs text-purple-700 font-medium underline">View judge panel →</Link>
          </div>
        )}

        {/* Messenger actions */}
        {!isResolved && !isEscalated && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <p className="text-xs font-medium text-gray-500">Messenger actions</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => updateStatus('pending')} disabled={updating}
                className="py-3 rounded-xl text-xs font-medium border border-amber-200 bg-amber-50 text-amber-700 active:scale-95 transition-transform">
                Mark awaiting response
              </button>
              <button onClick={issueStrike} disabled={updating}
                className="py-3 rounded-xl text-xs font-medium border border-red-200 bg-red-50 text-red-700 active:scale-95 transition-transform">
                Issue strike
              </button>
              <button onClick={() => updateStatus('escalated')} disabled={updating}
                className="py-3 rounded-xl text-xs font-medium border border-purple-200 bg-purple-50 text-purple-700 active:scale-95 transition-transform">
                Escalate to judge
              </button>
              <button onClick={markResolved} disabled={updating}
                className="py-3 rounded-xl text-xs font-medium border border-green-200 bg-green-50 text-green-700 active:scale-95 transition-transform">
                ✓ Mark resolved
              </button>
            </div>
          </div>
        )}

        {isResolved && (
          <div className="bg-green-50 rounded-2xl px-4 py-4 text-center">
            <p className="text-green-700 font-medium text-sm">✓ Case resolved</p>
            <p className="text-xs text-green-600 mt-1">This record will be deleted automatically after 30 days.</p>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
