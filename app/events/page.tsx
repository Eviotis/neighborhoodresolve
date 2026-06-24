'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

export default function EventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<any[]>([])
  const [pastEvents, setPastEvents] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [eventItems, setEventItems] = useState<any[]>([])
  const [attendees, setAttendees] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showSuggestForm, setShowSuggestForm] = useState(false)
  const [activeView, setActiveView] = useState<'list'|'detail'>('list')
  const [showPast, setShowPast] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [claimSubmitting, setClaimSubmitting] = useState<string|null>(null)
  const [hasRsvp, setHasRsvp] = useState(false)
  const [rsvpBringing, setRsvpBringing] = useState('')
  const [suggestion, setSuggestion] = useState({ idea: '', can_supply: '' })
  const [suggestionSent, setSuggestionSent] = useState(false)
  const [newEvent, setNewEvent] = useState({
    title: '', description: '', event_date: '', location: '',
    max_attendees: '', hide_creator_id: true, event_type: 'social'
  })

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/'); return }
      try {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
        setProfile(p)
      } catch(e) {}
      loadEvents()
    })
  }, [])

  async function loadEvents() {
    try {
      const now = new Date().toISOString()
      const { data: upcoming } = await supabase
        .from('events')
        .select('id, title, description, event_date, location, status, max_attendees, created_by, community_code, created_at, hide_creator_id, event_type')
        .gte('event_date', now)
        .order('event_date', { ascending: true })
      const { data: past } = await supabase
        .from('events')
        .select('id, title, description, event_date, location, status, max_attendees, created_by, community_code, created_at, hide_creator_id, event_type')
        .lt('event_date', now)
        .order('event_date', { ascending: false })
        .limit(10)
      setEvents(upcoming || [])
      setPastEvents(past || [])
    } catch(e) {
      setEvents([])
      setPastEvents([])
    }
    setLoading(false)
  }

  async function openEvent(event: any) {
    setSelectedEvent(event)
    try {
      const [itemsRes, attendeesRes] = await Promise.all([
        supabase.from('event_items').select('*').eq('event_id', event.id),
        supabase.from('event_attendees').select('*').eq('event_id', event.id),
      ])
      setEventItems(itemsRes.data || [])
      setAttendees(attendeesRes.data || [])
      const myRsvp = (attendeesRes.data || []).find((a: any) => a.profile_id === profile?.id)
      setHasRsvp(!!myRsvp)
    } catch(e) {
      setEventItems([])
      setAttendees([])
    }
    setActiveView('detail')
  }

  async function notifyManagers(subject: string, html: string) {
    try {
      const { data: managers } = await supabase
        .from('profiles')
        .select('email')
        .in('access_level', ['A', 'B1', 'B2', 'B3'])
      if (managers && managers.length > 0) {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: managers.map((m: any) => m.email).filter(Boolean),
            subject,
            html
          })
        })
      }
    } catch(e) {}
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { data: event } = await supabase.from('events').insert({
        title: newEvent.title,
        description: newEvent.description || null,
        event_date: new Date(newEvent.event_date).toISOString(),
        location: newEvent.location || null,
        max_attendees: newEvent.max_attendees ? parseInt(newEvent.max_attendees) : null,
        created_by: profile?.id || null,
        community_code: profile?.community_code || 'ADMIN',
        status: 'upcoming',
        hide_creator_id: newEvent.hide_creator_id,
        event_type: newEvent.event_type,
      }).select('id').single()

      if (event) {
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

        await notifyManagers(
          `New event created: ${newEvent.title}`,
          `<div style="font-family:sans-serif;max-width:500px">
            <h2 style="color:#1D9E75">New community event created</h2>
            <p><strong>Title:</strong> ${newEvent.title}</p>
            <p><strong>Date:</strong> ${new Date(newEvent.event_date).toLocaleDateString()}</p>
            <p><strong>Location:</strong> ${newEvent.location || 'TBD'}</p>
            <p><strong>Type:</strong> ${newEvent.event_type}</p>
            <p><strong>Creator ID hidden:</strong> ${newEvent.hide_creator_id ? 'Yes' : 'No'}</p>
          </div>`
        )
      }
    } catch(e) { console.error('Create event error:', e) }

    setShowCreateForm(false)
    setNewEvent({ title: '', description: '', event_date: '', location: '', max_attendees: '', hide_creator_id: true, event_type: 'social' })
    loadEvents()
    setSubmitting(false)
  }

  async function deleteEvent(eventId: string) {
    if (!confirm('Delete this event? This cannot be undone.')) return
    await supabase.from('event_items').delete().eq('event_id', eventId)
    await supabase.from('event_attendees').delete().eq('event_id', eventId)
    await supabase.from('events').delete().eq('id', eventId)
    setActiveView('list')
    loadEvents()
  }

  async function claimItem(itemId: string) {
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

  async function sendSuggestion() {
    await notifyManagers(
      'New event suggestion from resident',
      `<div style="font-family:sans-serif;max-width:500px">
        <h2 style="color:#1D9E75">Event suggestion received</h2>
        <p><strong>Idea:</strong> ${suggestion.idea}</p>
        <p><strong>Can supply:</strong> ${suggestion.can_supply || 'Nothing specified'}</p>
        <p><em>Sent to all managers and admin simultaneously.</em></p>
      </div>`
    )
    setSuggestionSent(true)
    setShowSuggestForm(false)
    setSuggestion({ idea: '', can_supply: '' })
  }

  const isMGR = profile && ['A','B1','B2','B3'].includes(String(profile.access_level))
  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }) }
    catch(e) { return d }
  }

  const groupedItems = ['Equipment','Food & drinks','Kids & fun','Setup & cleanup'].map(cat => ({
    cat, items: eventItems.filter((i: any) => String(i.category) === cat)
  })).filter(g => g.items.length > 0)

  const spotsLeft = selectedEvent?.max_attendees ? selectedEvent.max_attendees - attendees.length : null

  const EventCard = ({ event }: { event: any }) => (
    <button onClick={() => openEvent(event)}
      className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left active:bg-gray-50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm">{event.event_type === 'yardsale' ? '🏷️' : '🎉'}</span>
            <p className="text-sm font-medium text-gray-800 truncate">{String(event.title)}</p>
          </div>
          <p className="text-xs text-gray-400">{formatDate(String(event.event_date))}</p>
          {event.location && <p className="text-xs text-gray-400">📍 {String(event.location)}</p>}
        </div>
        <span className="text-xs px-2 py-1 rounded-lg font-medium bg-green-50 text-green-700 flex-shrink-0">
          {new Date(String(event.event_date)) > new Date() ? 'Upcoming' : 'Past'}
        </span>
      </div>
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeView === 'detail' ? (
              <button onClick={() => { setActiveView('list'); setSelectedEvent(null) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
                ← Events
              </button>
            ) : (
              <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
                ← Home
              </Link>
            )}
            <h1 className="text-lg font-semibold text-gray-900">
              {activeView === 'detail' && selectedEvent ? String(selectedEvent.title) : 'Community events'}
            </h1>
          </div>
          {activeView === 'list' && (
            <div className="flex gap-2">
              {isMGR && (
                <button onClick={() => { setShowCreateForm(!showCreateForm); setShowSuggestForm(false) }}
                  className="text-xs font-medium text-white px-3 py-1.5 rounded-xl" style={{background:'#1D9E75'}}>
                  + Create
                </button>
              )}
              <button onClick={() => { setShowSuggestForm(!showSuggestForm); setShowCreateForm(false) }}
                className="text-xs font-medium text-gray-600 px-3 py-1.5 rounded-xl border border-gray-200">
                💡 Suggest
              </button>
            </div>
          )}
        </div>
        {activeView === 'detail' && selectedEvent && (
          <p className="text-xs text-gray-400 mt-1 max-w-lg mx-auto">
            {formatDate(String(selectedEvent.event_date))}{selectedEvent.location ? ` · 📍 ${String(selectedEvent.location)}` : ''}
          </p>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {activeView === 'list' ? (
          <>
            {suggestionSent && (
              <div className="bg-green-50 rounded-2xl px-4 py-3 text-xs text-green-700">
                ✓ Suggestion sent to all community managers!
              </div>
            )}

            {showSuggestForm && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">💡 Suggest a community event</p>
                <p className="text-xs text-gray-400">Your suggestion goes to ALL managers and admin simultaneously.</p>
                <textarea value={suggestion.idea} onChange={e => setSuggestion({...suggestion, idea: e.target.value})}
                  placeholder="Describe your event idea, suggested date, location..." rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 resize-none"/>
                <input type="text" value={suggestion.can_supply} onChange={e => setSuggestion({...suggestion, can_supply: e.target.value})}
                  placeholder="What can you contribute? (optional)"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
                <div className="flex gap-2">
                  <button onClick={() => setShowSuggestForm(false)} className="flex-1 py-2.5 rounded-xl text-xs border border-gray-200 text-gray-500">Cancel</button>
                  <button onClick={sendSuggestion} disabled={!suggestion.idea.trim()}
                    className="flex-1 py-2.5 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
                    Send to all managers
                  </button>
                </div>
              </div>
            )}

            {showCreateForm && isMGR && (
              <form onSubmit={createEvent} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">Create new event</p>

                {/* Event type */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Event type</label>
                  <div className="flex gap-2">
                    {[{v:'social',l:'🎉 Social gathering'},{v:'yardsale',l:'🏷️ Yard sale'},{v:'meeting',l:'📋 Meeting'},{v:'other',l:'📌 Other'}].map(t => (
                      <button key={t.v} type="button" onClick={() => setNewEvent({...newEvent, event_type: t.v})}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${newEvent.event_type === t.v ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                        style={newEvent.event_type === t.v ? {background:'#1D9E75'} : {}}>
                        {t.l}
                      </button>
                    ))}
                  </div>
                </div>

                <input type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                  placeholder="Event title" required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
                <textarea value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                  placeholder="Description (optional)" rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 resize-none"/>
                <input type="datetime-local" value={newEvent.event_date} onChange={e => setNewEvent({...newEvent, event_date: e.target.value})} required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>

                <div>
                  <input type="text" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})}
                    placeholder="Location / address"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
                  {newEvent.location && (
                    <p className="text-xs text-amber-600 mt-1">⚠️ Since attendees will visit this address, your user ID will be hidden from attendees automatically.</p>
                  )}
                </div>

                <input type="number" value={newEvent.max_attendees} onChange={e => setNewEvent({...newEvent, max_attendees: e.target.value})}
                  placeholder="Max attendees (optional)"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>

                {/* Hide creator ID toggle */}
                <div className="flex items-center justify-between py-2 border-t border-gray-50">
                  <div>
                    <p className="text-xs font-medium text-gray-700">Hide my user ID from attendees</p>
                    <p className="text-xs text-gray-400 mt-0.5">Recommended for face-to-face events</p>
                  </div>
                  <button type="button" onClick={() => setNewEvent({...newEvent, hide_creator_id: !newEvent.hide_creator_id})}
                    className={`w-12 h-7 rounded-full transition-colors relative ${newEvent.hide_creator_id ? 'bg-green-500' : 'bg-gray-200'}`}>
                    <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${newEvent.hide_creator_id ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                  </button>
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 py-3 rounded-xl text-xs border border-gray-200 text-gray-500">Cancel</button>
                  <button type="submit" disabled={submitting} className="flex-1 py-3 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
                    {submitting ? 'Creating...' : 'Create & notify managers'}
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <div className="text-center py-8 text-sm text-gray-400">Loading...</div>
            ) : events.length === 0 && pastEvents.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 px-4 py-12 text-center">
                <p className="text-3xl mb-3">🎉</p>
                <p className="text-sm font-medium text-gray-700">No events yet</p>
                <p className="text-xs text-gray-400 mt-1">Have an idea? Click "Suggest" above!</p>
              </div>
            ) : (
              <>
                {events.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-400 px-1">Upcoming ({events.length})</p>
                    {events.map(event => <EventCard key={String(event.id)} event={event}/>)}
                  </div>
                )}
                {pastEvents.length > 0 && (
                  <div>
                    <button onClick={() => setShowPast(!showPast)}
                      className="text-xs text-gray-400 px-1 mb-2 flex items-center gap-1">
                      {showPast ? '▼' : '▶'} Past events ({pastEvents.length})
                    </button>
                    {showPast && (
                      <div className="space-y-2">
                        {pastEvents.map(event => <EventCard key={String(event.id)} event={event}/>)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        ) : selectedEvent && (
          <>
            {selectedEvent.description && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-sm text-gray-700 leading-relaxed">{String(selectedEvent.description)}</p>
                <div className="flex gap-4 mt-2">
                  {selectedEvent.max_attendees && (
                    <p className="text-xs text-gray-400">👥 {spotsLeft !== null ? `${spotsLeft} spots left` : `Max ${selectedEvent.max_attendees}`}</p>
                  )}
                  <p className="text-xs text-gray-400">🏷️ {String(selectedEvent.event_type || 'social')}</p>
                  {selectedEvent.hide_creator_id && <p className="text-xs text-gray-400">🕵️ Creator anonymous</p>}
                </div>
              </div>
            )}

            {/* RSVP */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-gray-500">🎉 {attendees.length} attending{spotsLeft !== null ? ` · ${spotsLeft} spots left` : ''}</p>
                {hasRsvp && <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg">✓ You're going!</span>}
              </div>
              {!hasRsvp && (spotsLeft === null || spotsLeft > 0) && (
                <div className="space-y-2">
                  <input type="text" value={rsvpBringing} onChange={e => setRsvpBringing(e.target.value)}
                    placeholder="What are you bringing? (optional)"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
                  <button onClick={rsvp} className="w-full py-3 rounded-xl text-xs font-medium text-white" style={{background:'#1D9E75'}}>
                    🎉 I'm coming!
                  </button>
                </div>
              )}
              {spotsLeft === 0 && !hasRsvp && (
                <p className="text-xs text-red-500 text-center">This event is full</p>
              )}
            </div>

            {/* Items checklist */}
            {groupedItems.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-medium text-gray-500 mb-3">What's needed — claim what you can bring</p>
                <div className="space-y-4">
                  {groupedItems.map(g => (
                    <div key={g.cat}>
                      <p className="text-xs font-medium text-gray-400 mb-2">{g.cat}</p>
                      <div className="space-y-2">
                        {g.items.map((item: any) => {
                          const isMine = String(item.claimed_by) === String(profile?.id)
                          const isClaimed = !!item.claimed_by
                          return (
                            <div key={String(item.id)} className={`flex items-center gap-3 p-2.5 rounded-xl border ${isClaimed ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
                              <span>{isClaimed ? '✅' : '⬜'}</span>
                              <div className="flex-1">
                                <p className="text-xs font-medium text-gray-700">{String(item.item_name)}</p>
                                {isClaimed && <p className="text-xs text-green-600">By {isMine ? 'you' : String(item.claimed_address || 'a neighbor')}</p>}
                              </div>
                              {!isClaimed ? (
                                <button onClick={() => claimItem(String(item.id))} disabled={claimSubmitting === String(item.id)}
                                  className="text-xs px-2.5 py-1.5 rounded-lg text-white font-medium" style={{background:'#1D9E75'}}>
                                  I'll bring it
                                </button>
                              ) : isMine ? (
                                <button onClick={() => unclaimItem(String(item.id))} disabled={claimSubmitting === String(item.id)}
                                  className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600">
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

            {/* Attendees — addresses only, no user IDs */}
            {attendees.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-medium text-gray-500 mb-3">Who's coming ({attendees.length})</p>
                {attendees.map((a: any) => (
                  <div key={String(a.id)} className="flex items-center gap-2 text-xs text-gray-500 py-1 border-b border-gray-50 last:border-0">
                    <span>🏠</span>
                    <span className="flex-1">{String(a.address || 'A neighbor')}</span>
                    {a.bringing && <span className="text-gray-400 truncate max-w-24">{String(a.bringing)}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* MGR delete option */}
            {isMGR && (
              <button onClick={() => deleteEvent(String(selectedEvent.id))}
                className="w-full py-3 rounded-2xl text-xs font-medium bg-red-50 text-red-600 border border-red-100">
                🗑 Delete this event
              </button>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
