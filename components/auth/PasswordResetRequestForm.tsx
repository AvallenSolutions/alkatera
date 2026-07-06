"use client"

import { useState } from "react"
import { AlertCircle, CheckCircle2 } from "lucide-react"

export function PasswordResetRequestForm() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!email) {
      setError("Please enter your email address")
      return
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address")
      return
    }

    setLoading(true)

    try {
      // Use custom API route that sends branded emails via Resend
      const response = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        throw new Error('Failed to send reset email')
      }

      // Always show success to prevent revealing if email exists in system
      setSuccess(true)
      setEmail("")
    } catch (err: any) {
      // Even on network errors, don't reveal specifics
      console.error('Password reset error:', err)
      setError("Unable to process request. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-[6px]">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 p-4 bg-white/10 border border-white/20 rounded-[6px]">
          <CheckCircle2 className="h-5 w-5 text-[#F2F1EA] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-white/80">
            If an account exists with this email, you will receive a password reset link shortly. Please check your inbox and spam folder.
          </p>
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

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-[#F2F1EA] text-[#1A1B1D] font-mono uppercase text-xs tracking-[0.22em] font-bold rounded-full hover:bg-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Sending reset email..." : "Send reset email"}
      </button>
    </form>
  )
}
