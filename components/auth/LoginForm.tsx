"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Eye, EyeOff, ArrowRight, Lock, Mail, AlertCircle, Loader2 } from "lucide-react"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs))
}

const InputField = ({
  type,
  label,
  icon: Icon,
  value,
  onChange,
  disabled,
}: {
  type: string
  label: string
  icon: React.ElementType
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
}) => {
  const [isFocused, setIsFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const inputType = type === "password" ? (showPassword ? "text" : "password") : type

  return (
    <div className="relative group mb-8">
      <label
        className={cn(
          "absolute left-8 transition-all duration-300 pointer-events-none font-mono text-xs tracking-widest uppercase",
          isFocused || value
            ? "-top-3 text-[#ccff00] text-[10px]"
            : "top-3 text-gray-500"
        )}
      >
        {label}
      </label>

      <div className="absolute left-0 top-3 text-gray-500 group-focus-within:text-[#ccff00] transition-colors">
        <Icon size={18} />
      </div>

      <input
        type={inputType}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={disabled}
        className="w-full bg-transparent border-b border-gray-800 py-3 pl-8 pr-10 text-white placeholder-transparent focus:outline-none focus:border-[#ccff00] transition-colors font-sans text-lg disabled:opacity-50"
      />

      {type === "password" && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-0 top-3 text-gray-500 hover:text-white transition-colors"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
    </div>
  )
}

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
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
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="flex items-start gap-2 mb-6 p-3 border border-red-900/50 bg-red-950/30 text-red-400 text-sm font-mono">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <InputField
        type="email"
        label="Email Address"
        icon={Mail}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
      />

      <InputField
        type="password"
        label="Password"
        icon={Lock}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#ccff00] text-black font-bold py-4 flex items-center justify-between px-6 hover:bg-white transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
      >
        <span className="font-mono uppercase tracking-widest">
          {loading ? "Authenticating..." : "Sign In"}
        </span>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ArrowRight className="group-hover:translate-x-1 transition-transform" />
        )}
      </button>
    </form>
  )
}
