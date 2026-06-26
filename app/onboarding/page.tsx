'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const MAIN_PREFERENCES = [
  { key: 'local_business', label: 'I own or represent a local business.' },
  { key: 'offers_services', label: 'I offer professional services to the community.' },
  { key: 'wants_event_notifications', label: "I'd like to receive notifications about neighborhood events and activities." },
  { key: 'volunteer_available', label: "I'd like to volunteer occasionally when my schedule allows." },
  { key: 'helps_elderly', label: "I'd be willing to help elderly or disabled neighbors with occasional errands." },
  { key: 'available_for_roles', label: "I'd like to be considered for temporary community roles such as Manager, Messenger, Auditor, or Verifier." },
  { key: 'will_invite_neighbors', label: 'I know other residents in this neighborhood and may invite them to join.' },
  { key: 'works_from_home', label: 'I work from home or spend much of my day in the neighborhood.' },
  { key: 'wants_help_requests', label: "I'd like to receive requests for help that match my interests or skills." },
]

const SKILLS_BY_CATEGORY = [
  {
    category: 'Professional Trades',
    skills: ['Electrical', 'Plumbing', 'HVAC', 'Landscaping / Lawn care', 'Painting (interior / exterior)', 'Carpentry / Woodworking', 'Pressure washing', 'Cleaning services'],
  },
  {
    category: 'General Handyman',
    skills: ['Handyman — homeowner level', 'Handyman — professional level', 'General repairs / odd jobs'],
  },
  {
    category: 'Technology',
    skills: ['Website / app development', 'Computer / tech support', 'Electronics repair', 'Security / cameras / smart home'],
  },
  {
    category: 'Transportation',
    skills: ['I have a pickup truck available', 'I can drive / transport neighbors', 'I have a trailer available'],
  },
  {
    category: 'Community & Personal',
    skills: ['Event organizing', 'Cooking / meal preparation', 'Childcare / babysitting', 'Pet sitting / dog walking', 'Tutoring / education', 'Language skills', 'Senior / disability assistance', 'Errands / grocery runs'],
  },
]

export default function Onboarding() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    local_business: false,
    offers_services: false,
    wants_event_notifications: false,
    volunteer_available: false,
    helps_elderly: false,
    available_for_roles: false,
    will_invite_neighbors: false,
    works_from_home: false,
    wants_help_requests: false,
  })
  const [showSkills, setShowSkills] = useState(false)
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [otherSkills, setOtherSkills] = useState('')
  const [showOtherText, setShowOtherText] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      setUser(data.user)
    })
  }, [])

  function togglePref(key: string) {
    setPrefs(p => ({ ...p, [key]: !p[key] }))
  }

  function toggleSkill(skill: string) {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    )
  }

  async function handleSubmit(skipped = false) {
    if (!user) return
    setLoading(true)
    await supabase.from('member_preferences').upsert({
      profile_id: user.id,
      ...prefs,
      selected_skills: selectedSkills,
      other_skills: otherSkills || null,
      completed: !skipped,
      skipped,
      updated_at: new Date().toISOString(),
    })
    router.push('/dashboard')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white pb-10">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <img src="/icon-192.png" alt="NeighborhoodResolve" width="32" height="32" style={{borderRadius:'50%'}}/>
            <h1 className="text-base font-semibold text-gray-900">NeighborhoodResolve</h1>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        <div>
          <h2 className="text-lg font-semibold text-gray-900 leading-snug">Help us personalize your NeighborhoodResolve experience.</h2>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed">The more we know about your interests, the better we can connect you with opportunities that matter to you. <span className="italic">You can change these preferences anytime.</span></p>
        </div>

        <div className="space-y-3">
          {MAIN_PREFERENCES.map(p => (
            <label key={p.key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs[p.key]}
                onChange={() => togglePref(p.key)}
                className="mt-0.5 w-4 h-4 rounded accent-green-600 flex-shrink-0"
              />
              <span className="text-sm text-gray-700 leading-relaxed">{p.label}</span>
            </label>
          ))}

          {/* Skills checkbox with submenu */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showSkills}
                onChange={() => setShowSkills(!showSkills)}
                className="mt-0.5 w-4 h-4 rounded accent-green-600 flex-shrink-0"
              />
              <span className="text-sm text-gray-700 leading-relaxed">I have skills or services I can offer the community.</span>
            </label>

            {showSkills && (
              <div className="mt-3 ml-7 space-y-4">
                {SKILLS_BY_CATEGORY.map(cat => (
                  <div key={cat.category}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{cat.category}</p>
                    <div className="space-y-2">
                      {cat.skills.map(skill => (
                        <label key={skill} className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedSkills.includes(skill)}
                            onChange={() => toggleSkill(skill)}
                            className="w-4 h-4 rounded accent-green-600 flex-shrink-0"
                          />
                          <span className="text-sm text-gray-600">{skill}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Other skills */}
                <div>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOtherText}
                      onChange={() => setShowOtherText(!showOtherText)}
                      className="w-4 h-4 rounded accent-green-600 flex-shrink-0"
                    />
                    <span className="text-sm text-gray-600">Other</span>
                  </label>
                  {showOtherText && (
                    <textarea
                      value={otherSkills}
                      onChange={e => setOtherSkills(e.target.value.slice(0, 500))}
                      rows={4}
                      placeholder={`"I'm a retired electrician."\n"I'm available weekends."\n"I have a pickup truck."\n"I speak Spanish."\n"I enjoy helping seniors."`}
                      className="mt-2 w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-green-500 text-gray-700 placeholder-gray-300 leading-relaxed resize-none"
                    />
                  )}
                  {showOtherText && (
                    <p className="text-xs text-gray-300 mt-1 text-right">{otherSkills.length}/500</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 space-y-3">
          <button
            onClick={() => handleSubmit(false)}
            disabled={loading}
            className="w-full py-3 rounded-xl text-white text-sm font-medium"
            style={{background: loading ? '#9FE1CB' : '#1D9E75'}}>
            {loading ? 'Saving...' : 'Save my preferences'}
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-medium border border-gray-200 text-gray-400">
            Skip for now
          </button>
        </div>

        <p className="text-xs text-gray-300 text-center leading-relaxed">You can always update these preferences from your profile page.</p>

      </div>
    </div>
  )
}
