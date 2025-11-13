import { SignupForm } from '@/components/auth/SignupForm'
import { AuthCard } from '@/components/auth/AuthCard'

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="mb-8 text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">AlkaTera</h1>
        <p className="text-muted-foreground">Carbon management platform</p>
      </div>

      <AuthCard
        title="Create an Account"
        description="Sign up to get started with AlkaTera"
        footerLink={{
          href: '/login',
          text: 'Already have an account?',
          linkText: 'Sign in'
        }}
      >
        <SignupForm />
      </AuthCard>
    </main>
  )
}
