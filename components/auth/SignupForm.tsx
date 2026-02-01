"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Eye, EyeOff, ArrowRight, Lock, Mail, User, AlertCircle, Loader2, CheckCircle2 } from "lucide-react"
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

export function SignupForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullName, setFullName] = useState("")
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
          console.log('🚀 SignupForm: Redirecting to create organization...')
          await new Promise(resolve => setTimeout(resolve, 100))
          router.push("/create-organization")
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
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="flex items-start gap-2 mb-6 p-3 border border-red-900/50 bg-red-950/30 text-red-400 text-sm font-mono">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 mb-6 p-3 border border-green-900/50 bg-green-950/30 text-green-400 text-sm font-mono">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Account created successfully! Redirecting...</span>
        </div>
      )}

      <InputField
        type="text"
        label="Full Name"
        icon={User}
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        disabled={loading}
      />

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

      <p className="-mt-6 mb-8 text-xs text-gray-600 font-mono pl-8">
        Min 8 chars with uppercase, lowercase, and number
      </p>

      <InputField
        type="password"
        label="Confirm Password"
        icon={Lock}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        disabled={loading}
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#ccff00] text-black font-bold py-4 flex items-center justify-between px-6 hover:bg-white transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
      >
        <span className="font-mono uppercase tracking-widest">
          {loading ? "Creating account..." : "Create Account"}
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
