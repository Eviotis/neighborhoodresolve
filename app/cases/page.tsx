'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

const statusConfig: Record<string, {label: string, color: string}> = {
  open:      { label: 'Open',             color: 'bg-blue-50 text-blue-700' },
  pending:   { label: 'Awaiting response',color: 'bg-amber-50 text-amber-700' },
  strike:    { label: 'Strike issued',    color: 'bg-red-50 text-red-700' },
  resolved:  { label: 'Resolved',         color: 'bg-green-50 text-green-700' },
  escalated: { label: 'Judge panel',      color: 'bg-purple-50 text-purple-700' },
}

const filters = ['All', 'Open', 'Pending', 'Strike', 'Resolved', 'Escalated']

export default function CasesPage() {
  const router = useRouter()
  const [cases, setCases] = useState<any[]>([])
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      loadCases()
    })
  }, [])

  async function loadCases() {
    const { data } = await supabase.from('cases').select('*').order('created_at', { ascending: false })
    setCases(data || [])
    setLoading(false)
  }

  const filtered = filter === 'All' ? cases : cases.filter(c => c.status === filter.toLowerCase())
  const daysSince = (date: string) => Math.floor((Date.now() - new Date(date).getTime()) / 86400000) + 1

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-semibold text-gray-900">Active cases</h1>
          <p className="text-xs text-gray-400 mt-0.5">Identities protected throughout</p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 overflow-x-auto">
        <div className="flex gap-2 max-w-lg mx-auto w-max">
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                filter === f ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="text-center py-12 text-sm text-gray-400">Loading cases...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">No cases found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(c => (
              <Link key={c.id} href={`/cases/${c.id}`}
                className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-gray-100 active:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.category}</p>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{c.location}</p>
                  <p className="text-xs text-gray-300 mt-0.5">Day {daysSince(c.created_at)} · {c.strike_count || 0} strike{c.strike_count !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-lg font-medium ${statusConfig[c.status]?.color || 'bg-gray-50 text-gray-500'}`}>
                    {statusConfig[c.status]?.label || c.status}
                  </span>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#d1d5db" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
