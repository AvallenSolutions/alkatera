'use client'

import { useSearchParams } from "next/navigation"
import { AuthForm } from "@/components/auth/AuthForm"

export default function LoginPage() {
  const searchParams = useSearchParams()
  const tier = searchParams.get('tier')

  // Only allow internal-path returnUrls to avoid open-redirects.
  const rawReturn = searchParams.get('returnUrl')
  const returnUrl =
    rawReturn && rawReturn.startsWith('/') && !rawReturn.startsWith('//')
      ? rawReturn
      : null

  return <AuthForm tier={tier} returnUrl={returnUrl} />
}
