import { AuthForm } from "@/components/auth/AuthForm"

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="mb-8 text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">AlkaTera</h1>
        <p className="text-muted-foreground">Secure authentication for your application</p>
      </div>
      <AuthForm />
    </main>
  )
}
