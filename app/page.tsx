import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-2xl text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">
            Welcome to AlkaTera
          </h1>
          <p className="text-xl text-muted-foreground">
            A secure, modern authentication system built with Next.js and Supabase
          </p>
        </div>

        <div className="flex gap-4 justify-center">
          <Link href="/login">
            <Button size="lg">
              Sign In
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="lg" variant="outline">
              Create Account
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
