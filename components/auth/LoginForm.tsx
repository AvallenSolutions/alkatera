"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"

export function LoginForm() {
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
        throw signInError
      }

      if (data.user) {
        console.log('✅ LoginForm: Sign-in successful!', {
          userId: data.user.id,
          email: data.user.email,
        })

        if (data.session) {
          console.log('✅ LoginForm: Session created, redirecting to dashboard...')
          router.push("/dashboard")
          router.refresh()
        } else {
          console.warn('⚠️ LoginForm: User authenticated but no session returned')
          setError("Authentication successful but session not created. Please try again.")
        }
      } else {
        console.error('❌ LoginForm: No user returned from sign-in')
        setError("Sign-in succeeded but no user data returned. Please try again.")
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
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          "Sign In"
        )}
      </Button>
    </form>
  )
}
