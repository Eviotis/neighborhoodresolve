'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [mode, setMode] = useState<'landing'|'login'|'register'|'forgot'>('landing')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [residentType, setResidentType] = useState('resident')
  const [phone, setPhone] = useState('')
  const [communitySearch, setCommunitySearch] = useState('')
  const [communityMatches, setCommunityMatches] = useState<any[]>([])
  const [selectedCommunity, setSelectedCommunity] = useState<any>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function searchCommunities(val: string) {
    setCommunitySearch(val)
    setSelectedCommunity(null)
    if (val.length < 2) { setCommunityMatches([]); setShowDropdown(false); return }
    const { data } = await supabase
      .from('communities')
      .select('*')
      .ilike('name', `%${val}%`)
      .limit(6)
    setCommunityMatches(data || [])
    setShowDropdown(true)
  }

  function selectCommunity(c: any) {
    setSelectedCommunity(c)
    setCommunitySearch(c.name)
    setShowDropdown(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: authError, data } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError(authError.message); setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('status').eq('id', data.user.id).single()
    if (profile && profile.status === 'pending') {
      await supabase.auth.signOut()
      setError('Your registration is pending approval. You will receive an email within 24 hours — please also check your spam folder if you don\'t see it.')
      setLoading(false)
      return
    }
    // Check if onboarding completed
    const { data: prefs } = await supabase.from('member_preferences').select('id').eq('profile_id', data.user.id).single()
    if (!prefs) {
      router.push('/onboarding')
    } else {
      router.push('/dashboard')
    }
    setLoading(false)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (!communitySearch.trim()) { setError('Please enter your neighborhood or subdivision name'); setLoading(false); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); setLoading(false); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); setLoading(false); return }
    if (!address.trim()) { setError('Street address is required for verification'); setLoading(false); return }
    if (!city.trim()) { setError('City is required'); setLoading(false); return }
    if (!state.trim()) { setError('State is required'); setLoading(false); return }
    if (!zipCode.trim()) { setError('ZIP code is required'); setLoading(false); return }

    const { error: authError, data } = await supabase.auth.signUp({
      email, password,
      options: { data: { community_name: communitySearch } }
    })
    if (authError && authError.message) { setError(authError.message); setLoading(false); return }
    if (!data.user) { setError('Registration failed. Please try again.'); setLoading(false); return }

    if (data.user) {
      // Create or find community
      let communityId = selectedCommunity?.id || null
      if (!communityId) {
        const slug = communitySearch.toUpperCase().replace(/\s+/g, '_')
        const { data: existing, error: existingError } = await supabase
          .from('communities')
          .select('id, member_count')
          .eq('slug', slug)
          .single()
        if (existingError && existingError.code !== 'PGRST116') {
          setError('Community lookup failed: ' + existingError.message)
          setLoading(false)
          return
        }
        if (existing) {
          communityId = existing.id
          await supabase.from('communities').update({ member_count: existing.member_count + 1 }).eq('id', existing.id)
        } else {
          const { data: newCom, error: insertError } = await supabase
            .from('communities')
            .insert({ name: communitySearch, slug, city, state, zip_code: zipCode, created_by: data.user.id, member_count: 1 })
            .select().single()
          if (insertError) {
            setError('Community creation failed: ' + insertError.message)
            setLoading(false)
            return
          }
          communityId = newCom?.id || null
        }
      }

      const { data: maxData } = await supabase.from('profiles').select('neighbor_number').order('neighbor_number', { ascending: false }).limit(1)
      const nextNum = maxData && maxData.length > 0 ? (maxData[0].neighbor_number || 44) + 1 : 45
      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: data.user.id, email, neighbor_number: nextNum,
        community_code: communitySearch.toUpperCase().replace(/\s+/g, '_'),
        community_id: communityId,
        access_level: 'C', lives_remaining: 1, report_count: 0,
        report_weight: 5.0, is_anonymous: false,
        status: 'pending',
        address, city, state, zip_code: zipCode,
        resident_type: residentType, phone: phone || null,
      })
      if (upsertError) {
        setError('Profile creation failed: ' + upsertError.message)
        setLoading(false)
        return
      }
    }
    setMessage('Registration submitted! Your address will be verified and you will receive approval within 24 hours. Check your spam/junk folder for our email and mark it as "Not Spam".')
    setLoading(false)
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://www.neighborhoodresolve.com/reset-password'
    })
    if (resetError) { setError(resetError.message); setLoading(false); return }
    setMessage('Password reset email sent. Check your inbox and spam folder.')
    setLoading(false)
  }

  if (mode === 'landing') return (
    <main className="min-h-screen bg-white">
      <div className="px-6 pt-16 pb-10 text-center max-w-lg mx-auto">
        <div className="mb-6 flex justify-center">
          <img src="/icon-192.png" alt="NeighborhoodResolve" width="100" height="100" style={{borderRadius:'50%'}}/>
        </div>
        <p className="text-2xl font-semibold text-gray-700 mb-2 leading-snug">Every neighborhood is only as strong as its links.</p>
        <h1 className="text-lg text-gray-400 mb-4">NeighborhoodResolve</h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-3">
          A free platform that helps neighbors connect, communicate, and support one another — so small issues can be resolved before they become lasting conflicts.
        </p>
        <p className="text-sm font-bold text-green-600 mb-8">Free for residents. Always.</p>
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-gray-400 italic">The missing link may be closer than you think.</p>
          <button onClick={() => setMode('login')}
            className="w-full max-w-xs px-8 py-3 rounded-xl text-white text-sm font-medium" style={{background:'#1D9E75'}}>
            Already a member? Sign in
          </button>
          <p className="text-sm text-gray-400">Not registered yet? <span className="font-semibold text-green-600">It's free.</span></p>
          <button onClick={() => setMode('register')}
            className="w-full max-w-xs px-8 py-3 rounded-xl text-sm font-medium border-2 border-green-600 text-green-700 bg-white">
            Join Your Community
          </button>
          <p className="text-sm font-medium text-gray-500 mt-1">See what your neighborhood can become.</p>
        </div>
      </div>

      <div className="px-6 pb-10 max-w-lg mx-auto">
        <div className="space-y-3">
          {[
            { icon: '🤝', title: 'Neighbors Helping Neighbors', desc: 'Volunteer access connects people who need help with people who want to give it.' },
            { icon: '🔒', title: 'Safe Communication', desc: 'Raise a concern without starting a war. Your identity stays protected when protection matters.' },
            { icon: '⚖️', title: 'Community-Driven Resolution', desc: 'When issues arise, the community speaks before conflict escalates.' },
          ].map(f => (
            <div key={f.title} className="flex gap-4 bg-gray-50 rounded-2xl p-4">
              <span className="text-2xl flex-shrink-0">{f.icon}</span>
              <div>
                <p className="text-sm font-medium text-gray-800 mb-0.5">{f.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400 text-center pt-1">Also includes: community events, trusted services, contractor ratings, yard sales, and more.</p>
        </div>
      </div>

      <div className="px-6 pb-10 max-w-lg mx-auto">
        <div className="bg-green-50 rounded-2xl p-6 text-center">
          <p className="text-sm font-medium text-green-800 mb-3">Built for residents without HOAs — and a powerful complement for HOA boards who want stronger resident engagement.</p>
          <p className="text-xs text-green-700 leading-relaxed mb-5">
            Whether your neighborhood has an HOA or not, NeighborhoodResolve helps everyone communicate better, resolve concerns faster, and build the kind of trust that makes a neighborhood feel like home.
          </p>
          <div className="mb-5">
            <p className="text-xs text-green-700 leading-relaxed">Enter NeighborhoodResolve and give it a test run.</p>
            <p className="text-xs text-green-700 leading-relaxed">Most questions are best answered through experience.</p>
            <p className="text-xs text-green-600 leading-relaxed mt-2">No credit card. No sales presentations. No obligations.</p>
          </div>
          <a href="mailto:hello@neighborhoodresolve.com?subject=NeighborhoodResolve Community Inquiry&body=Hello,%0A%0AWe would love to learn more about your community and how NeighborhoodResolve can help.%0A%0ACommunity Name:%0ANumber of homes:%0ALocation:%0AHow can we help?%0A%0AThank you."
            className="inline-block px-4 py-2 rounded-lg text-xs font-medium border border-green-500 text-green-600 bg-white">
            Contact Us
          </a>
          <div className="mt-4 pt-4 border-t border-green-100">
            <p className="text-sm font-bold text-green-800 tracking-wide uppercase">Free for residents. Always.</p>
            <p className="text-xs text-green-600 opacity-60 mt-1 leading-relaxed">Communities and associations receive a complimentary 90-day trial before administrative plans begin.</p>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8 text-center">
        <p className="text-xs text-gray-400">© 2026 NeighborhoodResolve</p>
        <p className="text-xs text-gray-500 mt-1 font-medium">Homes need more than rules. They need relationships.</p>
        <p className="text-xs text-gray-500 font-medium">Neighborhoods need more than houses. They need links.</p>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
      <div className="w-full max-w-sm">
        <button onClick={() => setMode('landing')} className="flex items-center gap-1.5 text-xs text-gray-400 mb-6">
          ← Back
        </button>
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <img src="/icon-192.png" alt="NeighborhoodResolve" width="56" height="56" style={{borderRadius:'50%'}}/>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">NeighborhoodResolve</h1>
          <p className="text-sm font-medium text-gray-700 mt-1">Connecting neighbors. Resolving concerns. Building stronger communities.</p>
          <p className="text-xs text-gray-400 italic mt-0.5">"Every neighborhood is only as strong as its links."</p>
        </div>

        {mode === 'forgot' ? (
          <>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-sm text-gray-500 text-center">Enter your email and we'll send you a reset link.</p>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500" required/>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              {message && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{message}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white text-sm font-medium"
                style={{background: loading ? '#9FE1CB' : '#1D9E75'}}>
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
            <p className="text-center text-xs text-gray-400 mt-4">
              <button onClick={() => setMode('login')} className="text-green-600 font-medium">← Back to sign in</button>
            </p>
          </>
        ) : mode === 'login' ? (
          <>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500" required/>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 pr-12" required/>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400 text-xs px-1">
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{typeof error === 'string' ? error : JSON.stringify(error)}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white text-sm font-medium"
                style={{background: loading ? '#9FE1CB' : '#1D9E75'}}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
            <p className="text-center text-xs text-gray-400 mt-3">
              <button onClick={() => setMode('forgot')} className="text-green-600 font-medium">Forgot your password?</button>
            </p>
            <p className="text-center text-xs text-gray-400 mt-2">
              Don't have an account? <button onClick={() => setMode('register')} className="text-green-600 font-medium">Join your community</button>
            </p>
          </>
        ) : (
          <>
            <form onSubmit={handleRegister} className="space-y-4">

              {/* Community search */}
              <div ref={searchRef} className="relative">
                <label className="block text-sm text-gray-600 mb-1">Neighborhood or Subdivision name</label>
                <input
                  type="text"
                  value={communitySearch}
                  onChange={e => searchCommunities(e.target.value)}
                  placeholder="e.g. Maple Grove, Oak Hills..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"
                  required
                  autoComplete="off"
                />
                {selectedCommunity && (
                  <p className="text-xs text-green-600 mt-1">✓ Joining: {selectedCommunity.name} · {selectedCommunity.city}, {selectedCommunity.state}</p>
                )}
                {!selectedCommunity && communitySearch.length >= 2 && communityMatches.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">No existing community found — a new one will be created for your neighborhood.</p>
                )}
                {showDropdown && communityMatches.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl mt-1 shadow-lg overflow-hidden">
                    {communityMatches.map(c => (
                      <button key={c.id} type="button" onClick={() => selectCommunity(c)}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-green-50 border-b border-gray-50 last:border-0">
                        <p className="font-medium text-gray-800">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.city}, {c.state} {c.zip_code} · {c.member_count} member{c.member_count !== 1 ? 's' : ''}</p>
                      </button>
                    ))}
                    <button type="button" onClick={() => { setShowDropdown(false); setSelectedCommunity(null) }}
                      className="w-full text-left px-4 py-3 text-sm text-green-600 bg-green-50">
                      + Create "{communitySearch}" as a new community
                    </button>
                  </div>
                )}
              </div>

              {/* Address fields */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">Street address</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="e.g. 142 Oak Drive"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500" required/>
                <p className="text-xs text-gray-400 mt-1">Used for verification only — kept private</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">City</label>
                  <input type="text" value={city} onChange={e => setCity(e.target.value)}
                    placeholder="e.g. Atlanta"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500" required/>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">State</label>
                  <input type="text" value={state} onChange={e => setState(e.target.value)}
                    placeholder="e.g. GA"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500" required/>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">ZIP code</label>
                <input type="text" value={zipCode} onChange={e => setZipCode(e.target.value)}
                  placeholder="e.g. 30060"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500" required/>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Resident type</label>
                <select value={residentType} onChange={e => setResidentType(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-green-500">
                  <option value="resident">Resident (I live here)</option>
                  <option value="landlord">Landlord (I own property here)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500" required/>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 pr-12" required/>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400 text-xs px-1">
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Confirm password</label>
                <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500" required/>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Phone <span className="text-gray-400">(optional)</span></label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="For emergencies only — never shared"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{typeof error === 'string' ? error : JSON.stringify(error)}</p>}
              {message && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{message}</p>}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white text-sm font-medium"
                style={{background: loading ? '#9FE1CB' : '#1D9E75'}}>
                {loading ? 'Please wait...' : 'Submit registration'}
              </button>
            </form>

            <div className="mt-4 p-3 bg-amber-50 rounded-xl">
              <p className="text-xs text-amber-700 text-center leading-relaxed">
                ⏱ Your address will be verified and you will receive approval within 24 hours.
              </p>
            </div>
            <p className="text-center text-xs text-gray-400 mt-4">
              Already have an account? <button onClick={() => setMode('login')} className="text-green-600 font-medium">Sign in</button>
            </p>
          </>
        )}

        <div className="mt-4 p-3 bg-green-50 rounded-xl">
          <p className="text-xs text-green-700 text-center leading-relaxed">
            🔒 Your identity is never shared with other residents. All concerns are handled with full privacy.
          </p>
        </div>
      </div>
    </main>
  )
}
