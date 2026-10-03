'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // 1. Felhasználó létrehozása Supabase Auth-ban
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // 2. Profil létrehozása a profiles táblában
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        username,
      })

      if (profileError) {
        setError('Regisztráció sikerült, de a profil létrehozása nem: ' + profileError.message)
        setLoading(false)
        return
      }
    }

    setLoading(false)
    router.push('/profile')
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold">Regisztráció</h1>
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Felhasználónév"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="rounded-xl border border-gray-300 px-4 py-2 outline-none focus:border-black"
          />
          <input
            type="email"
            placeholder="Email cím"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-xl border border-gray-300 px-4 py-2 outline-none focus:border-black"
          />
          <input
            type="password"
            placeholder="Jelszó"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="rounded-xl border border-gray-300 px-4 py-2 outline-none focus:border-black"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-black px-4 py-2 text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Regisztráció...' : 'Regisztráció'}
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-600">
          Már van fiókod?{' '}
          <a href="/login" className="underline">
            Jelentkezz be
          </a>
        </p>
      </div>
    </div>
  )
}
