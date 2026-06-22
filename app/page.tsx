'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [communityCode, setCommunityCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else router.push('/dashboard')
    setLoading(false)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (!communityCode.trim()) {
      setError('Community access code is required')
      setLoading(false)
      return
    }
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { community_code: communityCode.toUpperCase() } }
    })
    if (error) setError(error.message)
    else setMessage('Check your email to confirm your account, then log in.')
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
      <div className="w-full max-w-sm">
        {/* Logo */}
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

        {/* Tabs */}
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

        {/* Form */}
        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Community access code</label>
              <input
                type="text"
                value={communityCode}
                onChange={e => setCommunityCode(e.target.value)}
                placeholder="e.g. MAPLEGROVE"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 uppercase"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Provided by your community administrator</p>
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          {message && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white text-sm font-medium transition-all active:scale-95"
            style={{background: loading ? '#9FE1CB' : '#1D9E75'}}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {/* Privacy note */}
        <div className="mt-6 p-3 bg-green-50 rounded-xl">
          <p className="text-xs text-green-700 text-center leading-relaxed">
            🔒 Your identity is never shared with other residents. All complaints are routed anonymously through a Messenger.
          </p>
        </div>
      </div>
    </main>
  )
}
