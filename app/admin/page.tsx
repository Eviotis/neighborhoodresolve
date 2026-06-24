'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function AdminPage() {
  const router = useRouter()
  const [cases, setCases] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [contractors, setContractors] = useState<any[]>([])
  const [removalRequests, setRemovalRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('cases')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      loadData()
    })
  }, [])

  async function loadData() {
    const [casesRes, profilesRes, contractorsRes, removalRes] = await Promise.all([
      supabase.from('cases').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
      supabase.from('contractors').select('*').order('created_at', { ascending: false }),
      supabase.from('contractor_removal_requests').select('*, contractors(business_name, category)').eq('status', 'pending'),
    ])
    setCases(casesRes.data || [])
    setProfiles(profilesRes.data || [])
    setContractors(contractorsRes.data || [])
    setRemovalRequests(removalRes.data || [])
    setLoading(false)
  }

  async function deleteCase(id: string) {
    await supabase.from('cases').delete().eq('id', id)
    loadData()
  }

  async function grantLife(userId: string) {
    const profile = profiles.find(p => p.id === userId)
    if (!profile) return
    await supabase.from('profiles').update({ lives_remaining: (profile.lives_remaining || 0) + 1 }).eq('id', userId)
    loadData()
  }

  async function approveUser(userId: string) {
    await supabase.from('profiles').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', userId)
    loadData()
  }

  async function rejectUser(userId: string) {
    await supabase.from('profiles').update({ status: 'rejected' }).eq('id', userId)
    loadData()
  }

  async function updateAccessLevel(userId: string, level: string) {
    await supabase.from('profiles').update({ access_level: level }).eq('id', userId)
    loadData()
  }

  async function approveContractor(contractorId: string) {
    await supabase.from('contractors').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', contractorId)
    loadData()
  }

  async function rejectContractor(contractorId: string) {
    await supabase.from('contractors').update({ status: 'rejected' }).eq('id', contractorId)
    loadData()
  }

  async function removeContractor(contractorId: string, requestId: string) {
    await supabase.from('contractors').update({ status: 'removed' }).eq('id', contractorId)
    await supabase.from('contractor_removal_requests').update({ status: 'approved' }).eq('id', requestId)
    loadData()
  }

  async function denyRemoval(requestId: string) {
    await supabase.from('contractor_removal_requests').update({ status: 'denied' }).eq('id', requestId)
    loadData()
  }

  const flagged = profiles.filter(p => (p.report_count || 0) >= 5)
  const pending = profiles.filter(p => p.status === 'pending')
  const pendingContractors = contractors.filter(c => c.status === 'pending')
  const approvedContractors = contractors.filter(c => c.status === 'approved')

  const tabs = [
    { id: 'cases', label: 'Cases', count: cases.length },
    { id: 'residents', label: 'Residents', count: profiles.length },
    { id: 'pending', label: 'Pending', count: pending.length + pendingContractors.length + removalRequests.length },
    { id: 'contractors', label: 'Services', count: approvedContractors.length },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">⚙️ Admin panel</h1>
            <p className="text-xs text-gray-400">Level A — Master access</p>
          </div>
          <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
            ← Home
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Alerts */}
        {(pending.length > 0 || pendingContractors.length > 0 || removalRequests.length > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4 space-y-1">
            {pending.length > 0 && <p className="text-xs text-amber-700">⏳ {pending.length} resident registration{pending.length > 1 ? 's' : ''} awaiting approval</p>}
            {pendingContractors.length > 0 && <p className="text-xs text-amber-700">🔧 {pendingContractors.length} contractor recommendation{pendingContractors.length > 1 ? 's' : ''} awaiting review</p>}
            {removalRequests.length > 0 && <p className="text-xs text-amber-700">🚩 {removalRequests.length} contractor removal request{removalRequests.length > 1 ? 's' : ''} pending</p>}
          </div>
        )}

        {flagged.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-4">
            <p className="text-xs font-medium text-red-700 mb-1">⚠️ Possible abuse detected</p>
            {flagged.map(p => (
              <p key={p.id} className="text-xs text-red-600">{p.is_anonymous ? `Neighbor${p.neighbor_number}` : p.email} — {p.report_count} reports</p>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
            <p className="text-xs text-gray-400">Cases</p>
            <p className="text-xl font-semibold text-amber-600">{loading ? '—' : cases.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
            <p className="text-xs text-gray-400">Residents</p>
            <p className="text-xl font-semibold text-blue-600">{loading ? '—' : profiles.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
            <p className="text-xs text-gray-400">Services</p>
            <p className="text-xl font-semibold text-green-600">{loading ? '—' : approvedContractors.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
            <p className="text-xs text-gray-400">Pending</p>
            <p className="text-xl font-semibold text-amber-600">{loading ? '—' : pending.length + pendingContractors.length + removalRequests.length}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 mb-4 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-green-500 text-green-700' : 'border-transparent text-gray-400'}`}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-sm text-gray-400 py-8">Loading...</p>
        ) : activeTab === 'cases' ? (
          <div className="space-y-2">
            {cases.length === 0 && <p className="text-center text-sm text-gray-400 py-8">No cases</p>}
            {cases.map(c => (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.category}</p>
                    <p className="text-xs text-gray-400">{c.location} · {c.status} · {c.strike_count || 0} strikes</p>
                    <p className="text-xs text-gray-300">{new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => deleteCase(c.id)} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg">Delete</button>
                </div>
                {c.pr_timeline && <p className="text-xs text-blue-600 mt-2 bg-blue-50 px-2 py-1 rounded-lg">📅 {c.pr_timeline}</p>}
              </div>
            ))}
          </div>

        ) : activeTab === 'pending' ? (
          <div className="space-y-4">
            {/* Pending residents */}
            {pending.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">⏳ Pending registrations</p>
                <div className="space-y-2">
                  {pending.map(p => (
                    <div key={p.id} className="bg-white rounded-2xl border border-amber-200 p-4">
                      <p className="text-sm font-medium text-gray-800">{p.email}</p>
                      <p className="text-xs text-gray-400">Address: {p.address || 'Not provided'} · Type: {p.resident_type || 'resident'}</p>
                      <p className="text-xs text-gray-300">{new Date(p.created_at).toLocaleDateString()}</p>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => approveUser(p.id)} className="flex-1 py-2 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>✓ Approve</button>
                        <button onClick={() => rejectUser(p.id)} className="flex-1 py-2 rounded-xl text-xs font-medium bg-red-50 text-red-600 border border-red-200">✗ Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending contractors */}
            {pendingContractors.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">🔧 Contractor recommendations</p>
                <div className="space-y-2">
                  {pendingContractors.map(c => (
                    <div key={c.id} className="bg-white rounded-2xl border border-amber-200 p-4">
                      <p className="text-sm font-medium text-gray-800">{c.business_name}</p>
                      <p className="text-xs text-gray-400">{c.category} {c.owner_name ? `· ${c.owner_name}` : ''}</p>
                      {c.phone && <p className="text-xs text-gray-400">📞 {c.phone}</p>}
                      {c.description && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{c.description}</p>}
                      <p className="text-xs text-gray-300 mt-1">{new Date(c.created_at).toLocaleDateString()}</p>
                      <div className="bg-amber-50 rounded-xl px-3 py-2 mt-2 mb-3">
                        <p className="text-xs text-amber-700">⚠️ Verify no conflict of interest before approving</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => approveContractor(c.id)} className="flex-1 py-2 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>✓ Approve listing</button>
                        <button onClick={() => rejectContractor(c.id)} className="flex-1 py-2 rounded-xl text-xs font-medium bg-red-50 text-red-600 border border-red-200">✗ Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Removal requests */}
            {removalRequests.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">🚩 Removal requests</p>
                <div className="space-y-2">
                  {removalRequests.map((r: any) => (
                    <div key={r.id} className="bg-white rounded-2xl border border-red-200 p-4">
                      <p className="text-sm font-medium text-gray-800">{r.contractors?.business_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{r.contractors?.category}</p>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed"><strong>Reason:</strong> {r.reason}</p>
                      <p className="text-xs text-gray-300 mt-1">{new Date(r.created_at).toLocaleDateString()} · Requester anonymous</p>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => removeContractor(r.contractor_id, r.id)} className="flex-1 py-2 rounded-xl text-xs font-medium bg-red-500 text-white">Remove contractor</button>
                        <button onClick={() => denyRemoval(r.id)} className="flex-1 py-2 rounded-xl text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">Deny request</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pending.length === 0 && pendingContractors.length === 0 && removalRequests.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">Nothing pending — all clear!</p>
            )}
          </div>

        ) : activeTab === 'contractors' ? (
          <div className="space-y-2">
            {approvedContractors.length === 0 && <p className="text-center text-sm text-gray-400 py-8">No approved contractors yet</p>}
            {approvedContractors.map(c => (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.business_name}</p>
                    <p className="text-xs text-gray-400">{c.category} · ⭐ {c.average_rating || 0} ({c.total_ratings || 0} reviews)</p>
                    {c.phone && <p className="text-xs text-gray-400">📞 {c.phone}</p>}
                  </div>
                  <button onClick={() => rejectContractor(c.id)} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg">Remove</button>
                </div>
              </div>
            ))}
          </div>

        ) : (
          <div className="space-y-2">
            {profiles.length === 0 && <p className="text-center text-sm text-gray-400 py-8">No residents found</p>}
            {profiles.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{String(p.email || 'No email')}</p>
                    <p className="text-xs text-gray-400">Level {String(p.access_level || 'C')} · Lives: {String(p.lives_remaining || 0)} · Reports: {String(p.report_count || 0)}</p>
                    <p className="text-xs text-gray-300">
                      {p.is_anonymous ? `Neighbor${p.neighbor_number}` : 'Standard'} ·
                      <span className={p.status === 'approved' ? ' text-green-500' : p.status === 'pending' ? ' text-amber-500' : ' text-red-500'}>
                        {' '}{p.status || 'approved'}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <select value={p.access_level || 'C'} onChange={e => updateAccessLevel(p.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white">
                      <option value="C">C — Resident</option>
                      <option value="B1">B1 — Manager</option>
                      <option value="B2">B2 — Overseer</option>
                      <option value="A">A — Admin</option>
                    </select>
                    <button onClick={() => grantLife(p.id)} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg">+Life</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
