"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { LoginForm } from "./LoginForm"
import { SignupForm } from "./SignupForm"

interface AuthFormProps {
  tier?: string | null
  returnUrl?: string | null
}

export function AuthForm({ tier, returnUrl }: AuthFormProps) {
  const [mode, setMode] = useState<"login" | "signup">(tier ? "signup" : "login")

  // Where to land after auth: an explicit returnUrl wins, then the tier flow.
  const redirectTo = returnUrl ?? (tier ? `/settings?tier=${tier}` : undefined)

  return (
    <div data-auth-page className="relative min-h-screen text-white">
      {/* Full-page background */}
      <Image
        src="/images/vineyard-autumn.jpg"
        alt="Autumn vineyard"
        fill
        className="object-cover"
        priority
        quality={85}
      />
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <img
              src="/logo-cream.svg"
              alt="alkatera"
              className="h-12 md:h-14 w-auto object-contain"
            />
          </div>

          {/* Hero headline */}
          {tier && (
            <p className="font-mono font-bold text-[#F2F1EA]/80 text-[10px] tracking-[0.22em] uppercase text-center mb-4">
              {tier} plan selected
            </p>
          )}
          <h1 className="font-display font-bold tracking-tight text-4xl md:text-5xl text-[#F2F1EA] text-center mb-4">
            {mode === "login"
              ? tier ? `Sign in to activate ${tier}.` : "Welcome back."
              : tier ? `Sign up to start ${tier}.` : "Create an account."}
          </h1>
          <p className="text-white/50 text-center mb-8">
            {mode === "login"
              ? tier ? "Sign in and you'll be taken to complete your subscription." : "Enter your credentials to access the platform."
              : tier ? "Create your account, then complete your subscription." : "Sign up to get started with alkatera."}
          </p>

          {/* Dark glass panel over the photo */}
          <div className="border border-white/10 bg-white/5 backdrop-blur-md rounded-[6px] p-8">
            {/* Auth Forms */}
            {mode === "login" ? (
              <LoginForm redirectTo={redirectTo} />
            ) : (
              <SignupForm redirectTo={redirectTo} />
            )}

            {/* Forgot password & mode toggle */}
            <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
              {mode === "login" && (
                <div className="flex justify-center">
                  <Link
                    href="/password-reset"
                    className="text-xs font-mono text-white/40 hover:text-[#F2F1EA] transition-colors uppercase tracking-widest"
                  >
                    Forgot Password?
                  </Link>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-white/40 font-mono text-xs uppercase tracking-widest">
                  {mode === "login"
                    ? "Don't have an account?"
                    : "Already have an account?"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setMode(mode === "login" ? "signup" : "login")
                  }
                  className="text-[#F2F1EA] font-mono text-xs uppercase tracking-widest underline underline-offset-4 hover:text-white"
                >
                  {mode === "login" ? "Sign up" : "Sign in"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Photo credit */}
        <div className="absolute bottom-4 text-center text-[10px] text-white/20">
          Photo by{' '}
          <a
            href="https://unsplash.com/@mathieuodin"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white/40"
          >
            Mathieu Odin
          </a>
          {' '}on{' '}
          <a
            href="https://unsplash.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white/40"
          >
            Unsplash
          </a>
        </div>
      </div>
    </div>
  )
}
