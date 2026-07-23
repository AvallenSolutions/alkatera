'use client'

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { LoginClient } from "@/marketing/login/LoginClient"
import "@/marketing/shared/marketing.css"

function LoginContent() {
  const searchParams = useSearchParams()
  const tier = searchParams.get('tier')

  // Only allow internal-path returnUrls to avoid open-redirects.
  const rawReturn = searchParams.get('returnUrl')
  const returnUrl =
    rawReturn && rawReturn.startsWith('/') && !rawReturn.startsWith('//')
      ? rawReturn
      : null

  // Where to land after auth: an explicit returnUrl wins, then the tier flow.
  const redirectTo = returnUrl ?? (tier ? `/settings?tier=${tier}` : undefined)

  return <LoginClient redirectTo={redirectTo} />
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
