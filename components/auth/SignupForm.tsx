"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react"

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
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Account created successfully! Redirecting...
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input
          id="fullName"
          type="text"
          placeholder="John Smith"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={loading}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
        />
        <p className="text-xs text-muted-foreground">
          Must be at least 8 characters with uppercase, lowercase, and number
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating account...
          </>
        ) : (
          "Create Account"
        )}
      </Button>
    </form>
  )
}
