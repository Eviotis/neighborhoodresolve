'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [communityCode, setCommunityCode] = useState('')
  const [address, setAddress] = useState('')
  const [residentType, setResidentType] = useState('resident')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    // Check if approved
    const { error: authError, data } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError(authError.message); setLoading(false); return }
    
    // Check approval status
    const { data: profile } = await supabase.from('profiles').select('status').eq('id', data.user.id).single()
    if (profile && profile.status === 'pending') {
      await supabase.auth.signOut()
      setError('Your registration is pending approval. You will receive an email within 24 hours.')
      setLoading(false)
      return
    }
    
    router.push('/dashboard')
    setLoading(false)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!communityCode.trim()) { setError('Community access code is required'); setLoading(false); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); setLoading(false); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); setLoading(false); return }
    if (!address.trim()) { setError('Address is required for verification'); setLoading(false); return }

    const { error: authError, data } = await supabase.auth.signUp({
      email, password,
      options: { data: { community_code: communityCode.toUpperCase() } }
    })
    
    if (authError) { setError(authError.message); setLoading(false); return }

    // Create profile with pending status
    if (data.user) {
      const { data: maxData } = await supabase.from('profiles').select('neighbor_number').order('neighbor_number', { ascending: false }).limit(1)
      const nextNum = maxData && maxData.length > 0 ? (maxData[0].neighbor_number || 44) + 1 : 45

      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        neighbor_number: nextNum,
        community_code: communityCode.toUpperCase(),
        access_level: 'C',
        lives_remaining: 1,
        report_count: 0,
        report_weight: 5.0,
        is_anonymous: false,
        status: communityCode.toUpperCase() === 'ADMIN' ? 'approved' : 'pending',
        address,
        resident_type: residentType,
        phone: phone || null,
      })
    }

    if (communityCode.toUpperCase() === 'ADMIN') {
      router.push('/dashboard')
    } else {
      setMessage('Registration submitted! Your address will be verified and you will receive an approval email within 24 hours. ⚠️ Check your spam/junk folder if you do not see our email — mark it as "Not Spam" to ensure future emails arrive in your inbox.')
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{background:'#1D9E75'}}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 22V12h6v10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">NeighborhoodResolve</h1>
          <p className="text-sm text-gray-500 mt-1">Friendly. Anonymous. Fair.</p>
        </div>

        <div className="flex border border-gray-200 rounded-xl p-1 mb-6">
          <button onClick={() => setMode('login')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode==='login' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            Sign in
          </button>
          <button onClick={() => setMode('register')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode==='register' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            Join community
          </button>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Community access code</label>
                <input type="text" value={communityCode} onChange={e => setCommunityCode(e.target.value)}
                  placeholder="e.g. MAPLEGROVE"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 uppercase" required/>
                <p className="text-xs text-gray-400 mt-1">Provided by your community administrator</p>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Your address</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="e.g. 142 Oak Drive"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500" required/>
                <p className="text-xs text-gray-400 mt-1">Used for verification only — kept private</p>
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
                <label className="block text-sm text-gray-600 mb-1">Phone <span className="text-gray-400">(optional)</span></label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="For emergencies only — never shared"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
              </div>
            </>
          )}

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
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 text-xs px-1">
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Confirm password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 pr-12" required/>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          {message && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{message}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-white text-sm font-medium transition-all active:scale-95"
            style={{background: loading ? '#9FE1CB' : '#1D9E75'}}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Submit registration'}
          </button>
        </form>

        {mode === 'register' && (
          <div className="mt-4 p-3 bg-amber-50 rounded-xl">
            <p className="text-xs text-amber-700 text-center leading-relaxed">
              ⏱ After submitting, your address will be verified and you will receive approval within 24 hours.
            </p>
          </div>
        )}

        <div className="mt-4 p-3 bg-green-50 rounded-xl">
          <p className="text-xs text-green-700 text-center leading-relaxed">
            🔒 Your identity is never shared with other residents. All complaints are routed anonymously through a Messenger.
          </p>
        </div>
      </div>
    </main>
  )
}
// Note: spam notice is already included in the register-page.tsx file
// The message after registration says to check spam folder
