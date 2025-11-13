import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'
import { AuthCard } from '@/components/auth/AuthCard'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="mb-8 text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">AlkaTera</h1>
        <p className="text-muted-foreground">Carbon management platform</p>
      </div>

      <AuthCard
        title="Welcome Back"
        description="Sign in to your account to continue"
        footerLink={{
          href: '/signup',
          text: "Don't have an account?",
          linkText: 'Sign up'
        }}
      >
        <LoginForm />
        <div className="mt-4 text-center">
          <Link
            href="/password-reset"
            className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
          >
            Forgot your password?
          </Link>
        </div>
      </AuthCard>
    </main>
  )
}
