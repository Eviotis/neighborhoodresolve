'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

const itemCategories = [
  { cat: 'Food & drinks', items: ['Burgers/hot dogs', 'Buns', 'Salad', 'Chips & dips', 'Desserts', 'Water/soft drinks', 'Beer/wine', 'Ice'] },
  { cat: 'Equipment', items: ['BBQ grill', 'Tables', 'Chairs', 'Canopy/tent', 'Cooler', 'Music/speaker', 'Extension cord'] },
  { cat: 'Kids & fun', items: ['Inflatable castle', 'Slide', 'Games/activities', 'Balloons', 'Face painting'] },
  { cat: 'Setup & cleanup', items: ['Paper plates/cups', 'Napkins/cutlery', 'Trash bags', 'Tablecloths'] },
]

export default function EventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [eventItems, setEventItems] = useState<any[]>([])
  const [attendees, setAttendees] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showSuggestForm, setShowSuggestForm] = useState(false)
  const [activeView, setActiveView] = useState<'list'|'detail'>('list')
  const [submitting, setSubmitting] = useState(false)
  const [claimSubmitting, setClaimSubmitting] = useState<string|null>(null)

  const [newEvent, setNewEvent] = useState({
    title: '', description: '', event_date: '', location: '', max_attendees: ''
  })
  const [suggestion, setSuggestion] = useState({ idea: '', can_supply: '' })
  const [rsvpBringing, setRsvpBringing] = useState('')
  const [hasRsvp, setHasRsvp] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      setProfile(p)
      loadEvents()
    })
  }, [])

  async function loadEvents() {
    const { data } = await supabase.from('events').select('*').order('event_date', { ascending: true })
    setEvents(data || [])
    setLoading(false)
  }

  async function openEvent(event: any) {
    setSelectedEvent(event)
    const [itemsRes, attendeesRes] = await Promise.all([
      supabase.from('event_items').select('*').eq('event_id', event.id),
      supabase.from('event_attendees').select('*').eq('event_id', event.id),
    ])
    setEventItems(itemsRes.data || [])
    setAttendees(attendeesRes.data || [])
    const myRsvp = (attendeesRes.data || []).find((a: any) => a.profile_id === profile?.id)
    setHasRsvp(!!myRsvp)
    setActiveView('detail')
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const { data: event } = await supabase.from('events').insert({
      title: newEvent.title,
      description: newEvent.description,
      event_date: new Date(newEvent.event_date).toISOString(),
      location: newEvent.location,
      max_attendees: newEvent.max_attendees ? parseInt(newEvent.max_attendees) : null,
      created_by: profile?.id,
      community_code: profile?.community_code || 'ADMIN',
      status: 'upcoming',
    }).select().single()

    if (event) {
      // Auto-populate common items
      const defaultItems = [
        { event_id: event.id, category: 'Equipment', item_name: 'BBQ grill', quantity: 1 },
        { event_id: event.id, category: 'Equipment', item_name: 'Tables', quantity: 4 },
        { event_id: event.id, category: 'Equipment', item_name: 'Chairs', quantity: 20 },
        { event_id: event.id, category: 'Food & drinks', item_name: 'Burgers/hot dogs', quantity: 1 },
        { event_id: event.id, category: 'Food & drinks', item_name: 'Water/soft drinks', quantity: 2 },
        { event_id: event.id, category: 'Kids & fun', item_name: 'Games/activities', quantity: 1 },
        { event_id: event.id, category: 'Setup & cleanup', item_name: 'Paper plates/cups', quantity: 2 },
      ]
      await supabase.from('event_items').insert(defaultItems)
    }

    setShowCreateForm(false)
    setNewEvent({ title: '', description: '', event_date: '', location: '', max_attendees: '' })
    loadEvents()
    setSubmitting(false)
  }

  async function claimItem(itemId: string, itemName: string) {
    setClaimSubmitting(itemId)
    await supabase.from('event_items').update({
      claimed_by: profile?.id,
      claimed_address: profile?.address || `Neighbor${profile?.neighbor_number}`,
    }).eq('id', itemId)
    const { data } = await supabase.from('event_items').select('*').eq('event_id', selectedEvent.id)
    setEventItems(data || [])
    setClaimSubmitting(null)
  }

  async function unclaimItem(itemId: string) {
    setClaimSubmitting(itemId)
    await supabase.from('event_items').update({ claimed_by: null, claimed_address: null }).eq('id', itemId)
    const { data } = await supabase.from('event_items').select('*').eq('event_id', selectedEvent.id)
    setEventItems(data || [])
    setClaimSubmitting(null)
  }

  async function rsvp() {
    if (hasRsvp) return
    await supabase.from('event_attendees').insert({
      event_id: selectedEvent.id,
      profile_id: profile?.id,
      address: profile?.address || `Neighbor${profile?.neighbor_number}`,
      bringing: rsvpBringing || null,
    })
    const { data } = await supabase.from('event_attendees').select('*').eq('event_id', selectedEvent.id)
    setAttendees(data || [])
    setHasRsvp(true)
    setRsvpBringing('')
  }

  const isMGR = profile && ['A','B1','B2'].includes(profile.access_level)
  const groupedItems = itemCategories.map(cat => ({
    ...cat,
    items: eventItems.filter(i => i.category === cat.cat)
  })).filter(cat => cat.items.length > 0)

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' })

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeView === 'detail' ? (
                <button onClick={() => setActiveView('list')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
                  ← Events
                </button>
              ) : (
                <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
                  ← Home
                </Link>
              )}
              <h1 className="text-lg font-semibold text-gray-900">
                {activeView === 'detail' ? selectedEvent?.title : 'Community events'}
              </h1>
            </div>
            {activeView === 'list' && (
              <div className="flex gap-2">
                {isMGR && (
                  <button onClick={() => setShowCreateForm(!showCreateForm)}
                    className="text-xs font-medium text-white px-3 py-1.5 rounded-xl" style={{background:'#1D9E75'}}>
                    + Create
                  </button>
                )}
                <button onClick={() => setShowSuggestForm(!showSuggestForm)}
                  className="text-xs font-medium text-gray-600 px-3 py-1.5 rounded-xl border border-gray-200">
                  💡 Suggest
                </button>
              </div>
            )}
          </div>
          {activeView === 'detail' && selectedEvent && (
            <p className="text-xs text-gray-400 mt-1">{formatDate(selectedEvent.event_date)}</p>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

        {activeView === 'list' ? (
          <>
            {/* Suggest form */}
            {showSuggestForm && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">💡 Suggest a community event</p>
                <p className="text-xs text-gray-400">Your suggestion goes to the community manager for consideration.</p>
                <textarea value={suggestion.idea} onChange={e => setSuggestion({...suggestion, idea: e.target.value})}
                  placeholder="Describe your event idea, suggested date, location..."
                  rows={3} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 resize-none"/>
                <input type="text" value={suggestion.can_supply} onChange={e => setSuggestion({...suggestion, can_supply: e.target.value})}
                  placeholder="What can you contribute? (optional)"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
                <div className="flex gap-2">
                  <button onClick={() => setShowSuggestForm(false)} className="flex-1 py-2.5 rounded-xl text-xs border border-gray-200 text-gray-500">Cancel</button>
                  <button onClick={async () => {
                    await fetch('/api/notify', {
                      method: 'POST', headers: {'Content-Type':'application/json'},
                      body: JSON.stringify({ to: ['johnanagnostou@gmail.com'], subject: 'Event suggestion from resident', html: `<p><strong>Idea:</strong> ${suggestion.idea}</p><p><strong>Can supply:</strong> ${suggestion.can_supply}</p>` })
                    }).catch(() => {})
                    setShowSuggestForm(false)
                    setSuggestion({ idea: '', can_supply: '' })
                  }} className="flex-1 py-2.5 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
                    Send suggestion
                  </button>
                </div>
              </div>
            )}

            {/* Create event form (MGR only) */}
            {showCreateForm && isMGR && (
              <form onSubmit={createEvent} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
                <p className="text-sm font-medium text-gray-700">Create new event</p>
                <input type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                  placeholder="Event title (e.g. Summer BBQ 2026)" required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
                <textarea value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                  placeholder="Description..." rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 resize-none"/>
                <input type="datetime-local" value={newEvent.event_date} onChange={e => setNewEvent({...newEvent, event_date: e.target.value})} required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
                <input type="text" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})}
                  placeholder="Location (e.g. John's backyard, 142 Oak Drive)"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
                <input type="number" value={newEvent.max_attendees} onChange={e => setNewEvent({...newEvent, max_attendees: e.target.value})}
                  placeholder="Max attendees (optional)"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 py-3 rounded-xl text-xs border border-gray-200 text-gray-500">Cancel</button>
                  <button type="submit" disabled={submitting} className="flex-1 py-3 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
                    {submitting ? 'Creating...' : 'Create event'}
                  </button>
                </div>
              </form>
            )}

            {/* Events list */}
            {loading ? (
              <div className="text-center py-8 text-sm text-gray-400">Loading...</div>
            ) : events.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 px-4 py-12 text-center">
                <p className="text-3xl mb-3">🎉</p>
                <p className="text-sm font-medium text-gray-700">No events yet</p>
                <p className="text-xs text-gray-400 mt-1 mb-4">Have an idea? Click "Suggest" above!</p>
                {!isMGR && <p className="text-xs text-gray-300">Managers can create events from this page</p>}
              </div>
            ) : events.map(event => (
              <button key={event.id} onClick={() => openEvent(event)}
                className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left active:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{event.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(event.event_date)}</p>
                    {event.location && <p className="text-xs text-gray-400">📍 {event.location}</p>}
                    {event.description && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{event.description}</p>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-lg font-medium ml-2 flex-shrink-0 ${
                    new Date(event.event_date) > new Date() ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
                  }`}>
                    {new Date(event.event_date) > new Date() ? 'Upcoming' : 'Past'}
                  </span>
                </div>
              </button>
            ))}
          </>
        ) : selectedEvent && (
          <>
            {/* Event detail */}
            {selectedEvent.description && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-medium text-gray-500 mb-2">About this event</p>
                <p className="text-sm text-gray-700 leading-relaxed">{selectedEvent.description}</p>
                {selectedEvent.location && <p className="text-xs text-gray-400 mt-2">📍 {selectedEvent.location}</p>}
                {selectedEvent.max_attendees && <p className="text-xs text-gray-400 mt-1">👥 Max {selectedEvent.max_attendees} attendees</p>}
              </div>
            )}

            {/* RSVP */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-gray-500">RSVP — {attendees.length} attending</p>
                {hasRsvp && <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg">✓ You're going!</span>}
              </div>
              {!hasRsvp && (
                <div className="space-y-3">
                  <input type="text" value={rsvpBringing} onChange={e => setRsvpBringing(e.target.value)}
                    placeholder="What are you bringing? (optional)"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
                  <button onClick={rsvp} className="w-full py-3 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
                    🎉 I'm coming!
                  </button>
                </div>
              )}
            </div>

            {/* Items checklist */}
            {groupedItems.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-medium text-gray-500 mb-3">What's needed — claim what you can bring</p>
                <div className="space-y-4">
                  {groupedItems.map(cat => (
                    <div key={cat.cat}>
                      <p className="text-xs font-medium text-gray-400 mb-2">{cat.cat}</p>
                      <div className="space-y-2">
                        {cat.items.map((item: any) => {
                          const isMine = item.claimed_by === profile?.id
                          const isClaimed = !!item.claimed_by
                          return (
                            <div key={item.id} className={`flex items-center gap-3 p-2.5 rounded-xl border ${isClaimed ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
                              <span className="text-sm">{isClaimed ? '✅' : '⬜'}</span>
                              <div className="flex-1">
                                <p className="text-xs font-medium text-gray-700">{item.item_name}</p>
                                {isClaimed && <p className="text-xs text-green-600">Claimed by {isMine ? 'you' : item.claimed_address || 'a neighbor'}</p>}
                              </div>
                              {!isClaimed ? (
                                <button onClick={() => claimItem(item.id, item.item_name)} disabled={claimSubmitting === item.id}
                                  className="text-xs px-2.5 py-1.5 rounded-lg text-white font-medium" style={{background:'#1D9E75'}}>
                                  I'll bring it
                                </button>
                              ) : isMine ? (
                                <button onClick={() => unclaimItem(item.id)} disabled={claimSubmitting === item.id}
                                  className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 font-medium">
                                  Release
                                </button>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attendees */}
            {attendees.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-medium text-gray-500 mb-3">Who's coming ({attendees.length})</p>
                <div className="space-y-2">
                  {attendees.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2 text-xs text-gray-500">
                      <span>🏠</span>
                      <span className="flex-1">{a.address}</span>
                      {a.bringing && <span className="text-gray-400">bringing: {a.bringing}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
