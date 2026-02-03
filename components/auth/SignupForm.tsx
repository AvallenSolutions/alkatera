"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Eye, EyeOff, AlertCircle, Loader2, CheckCircle2 } from "lucide-react"

export function SignupForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long"
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter"
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter"
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number"
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    console.log('📝 SignupForm: Starting sign-up process...')

    if (!email || !password || !confirmPassword || !fullName) {
      const errorMsg = "Please fill in all fields"
      console.warn('⚠️ SignupForm:', errorMsg)
      setError(errorMsg)
      return
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address")
      return
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    try {
      console.log('📧 SignupForm: Attempting sign-up for:', email)

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (signUpError) {
        console.error('❌ SignupForm: Sign-up error:', {
          message: signUpError.message,
          status: signUpError.status,
          name: signUpError.name,
        })
        throw signUpError
      }

      if (data.user) {
        console.log('✅ SignupForm: Sign-up successful!', {
          userId: data.user.id,
          email: data.user.email,
        })

        if (data.session) {
          console.log('✅ SignupForm: Session created automatically')
        } else {
          console.log('ℹ️ SignupForm: No session created (email confirmation may be required)')
        }

        setSuccess(true)
        setTimeout(async () => {
          const destination = redirectTo || "/create-organization"
          console.log(`🚀 SignupForm: Redirecting to ${destination}...`)
          await new Promise(resolve => setTimeout(resolve, 100))
          router.push(destination)
          router.refresh()
        }, 2000)
      } else {
        console.error('❌ SignupForm: No user returned from sign-up')
        setError("Sign-up succeeded but no user data returned. Please try again.")
      }
    } catch (err: any) {
      console.error('❌ SignupForm: Fatal error during sign-up:', err)
      const errorMessage = err.message || "Failed to create account. Please try again."
      setError(errorMessage)
    } finally {
      setLoading(false)
      console.log('🏁 SignupForm: Sign-up process completed')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 p-4 bg-[#ccff00]/10 border border-[#ccff00]/20 rounded-xl">
          <CheckCircle2 className="h-5 w-5 text-[#ccff00] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-white/80">
            Account created successfully! Redirecting...
          </p>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="fullName" className="block text-sm font-medium text-white/60">
          Full Name
        </label>
        <input
          id="fullName"
          type="text"
          placeholder="John Smith"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={loading}
          required
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#ccff00]/50 focus:border-[#ccff00]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

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
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#ccff00]/50 focus:border-[#ccff00]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#ccff00]/50 focus:border-[#ccff00]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <p className="text-xs text-white/30">
          Min 8 chars with uppercase, lowercase, and number
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-white/60">
          Confirm Password
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            required
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#ccff00]/50 focus:border-[#ccff00]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed pr-12"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-[#ccff00] text-black font-mono uppercase text-xs tracking-widest font-bold rounded-xl hover:opacity-90 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating account...
          </span>
        ) : (
          "Create Account"
        )}
      </button>
    </form>
  )
}
