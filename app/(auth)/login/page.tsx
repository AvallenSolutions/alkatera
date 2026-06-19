'use client'

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { AuthForm } from "@/components/auth/AuthForm"

function LoginContent() {
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

export default function LoginPage() {
  // useSearchParams must sit inside a Suspense boundary or static prerendering
  // of this route (it has no force-dynamic ancestor) fails the build.
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}
