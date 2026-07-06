"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Eye, EyeOff, AlertCircle } from "lucide-react"

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    console.log('🔐 LoginForm: Starting sign-in process...')

    if (!email || !password) {
      const errorMsg = "Please fill in all fields"
      console.warn('⚠️ LoginForm:', errorMsg)
      setError(errorMsg)
      return
    }

    if (!validateEmail(email)) {
      const errorMsg = "Please enter a valid email address"
      console.warn('⚠️ LoginForm:', errorMsg)
      setError(errorMsg)
      return
    }

    if (password.length < 6) {
      const errorMsg = "Password must be at least 6 characters"
      console.warn('⚠️ LoginForm:', errorMsg)
      setError(errorMsg)
      return
    }

    setLoading(true)

    try {
      console.log('📧 LoginForm: Attempting sign-in for:', email)
      console.log('🔗 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
      console.log('🔑 Has anon key:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        console.error('❌ LoginForm: Sign-in error:', {
          message: signInError.message,
          status: signInError.status,
          name: signInError.name,
        })

        if (signInError.message === 'Failed to fetch') {
          setError('Network error: Unable to connect to authentication server. Please check your internet connection and try again.')
          setLoading(false)
          return
        }

        throw signInError
      }

      if (data.user && data.session) {
        console.log('✅ LoginForm: Sign-in successful!', {
          userId: data.user.id,
          email: data.user.email,
        })

        const destination = redirectTo || '/dashboard'
        console.log(`🚀 LoginForm: Redirecting to ${destination}...`)
        router.push(destination)
      } else {
        console.error('❌ LoginForm: Sign-in failed - no user or session')
        setError("Sign-in failed. Please check your credentials and try again.")
      }
    } catch (err: any) {
      console.error('❌ LoginForm: Fatal error during sign-in:', err)
      const errorMessage = err.message || "Failed to sign in. Please check your credentials and try again."
      setError(errorMessage)
    } finally {
      setLoading(false)
      console.log('🏁 LoginForm: Sign-in process completed')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-[6px]">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-white/60">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-[6px] text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#F2F1EA]/40 focus:border-[#F2F1EA]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-white/60">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-[6px] text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#F2F1EA]/40 focus:border-[#F2F1EA]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-[#F2F1EA] text-[#1A1B1D] font-mono uppercase text-xs tracking-[0.22em] font-bold rounded-full hover:bg-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  )
}
