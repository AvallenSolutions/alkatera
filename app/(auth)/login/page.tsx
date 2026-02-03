'use client'

import { useSearchParams } from "next/navigation"
import { AuthForm } from "@/components/auth/AuthForm"

export default function LoginPage() {
  const searchParams = useSearchParams()
  const tier = searchParams.get('tier')
  return <AuthForm tier={tier} />
}
