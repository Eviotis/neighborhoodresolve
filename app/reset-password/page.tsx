'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [validSession, setValidSession] = useState(false)

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true)
      }
    })
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) { setError(updateError.message); setLoading(false); return }
    setSuccess(true)
    setTimeout(() => router.push('/'), 3000)
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <img src="/icon-192.png" alt="NeighborhoodResolve" width="56" height="56" style={{borderRadius:'50%'}}/>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Reset Password</h1>
          <p className="text-sm text-gray-400 mt-1">NeighborhoodResolve</p>
        </div>

        {success ? (
          <div className="bg-green-50 rounded-2xl p-6 text-center">
            <p className="text-2xl mb-2">✓</p>
            <p className="text-sm font-medium text-green-800">Password updated successfully!</p>
            <p className="text-xs text-green-600 mt-1">Redirecting you to sign in...</p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">New password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 pr-12"
                  required/>
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400 text-xs px-1">
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Confirm new password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"
                required/>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-white text-sm font-medium"
              style={{background: loading ? '#9FE1CB' : '#1D9E75'}}>
              {loading ? 'Updating...' : 'Set new password'}
            </button>
            <button type="button" onClick={() => router.push('/')}
              className="w-full py-3 rounded-xl text-sm text-gray-400 border border-gray-200">
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
