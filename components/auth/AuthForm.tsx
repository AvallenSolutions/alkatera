"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { LoginForm } from "./LoginForm"
import { SignupForm } from "./SignupForm"

// --- Visual Side Component ---
const BiomeVisual = () => {
  return (
    <div className="relative w-full h-full overflow-hidden bg-[#080808]">
      <div
        className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay grayscale"
      />

      {/* Abstract Grid Overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      {/* Animated Organic Shapes */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-[#ccff00]/20"
            style={{
              width: `${(i + 1) * 300}px`,
              height: `${(i + 1) * 300}px`,
            }}
            animate={{
              rotate: [0, 360],
              scale: [1, 1.05, 1],
              borderWidth: ["1px", "3px", "1px"],
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{
              duration: 20 + i * 5,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}

        {/* Central Glowing Core */}
        <motion.div
          className="w-64 h-64 rounded-full bg-[#ccff00]/5 blur-[100px]"
          animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 5, repeat: Infinity }}
        />
      </div>

      {/* Text overlay */}
      <div className="absolute bottom-12 left-12 right-12">
        <h2 className="text-4xl md:text-5xl font-serif text-white mb-4 leading-none">
          Nature&apos;s <span className="italic text-[#ccff00]">Digital</span>
          <br /> Twin
        </h2>
        <p className="font-mono text-xs text-gray-400 uppercase tracking-widest max-w-md">
          Secure access to the global drinks intelligence network. Authorised
          personnel only.
        </p>
      </div>
    </div>
  )
}

interface AuthFormProps {
  tier?: string | null
}

export function AuthForm({ tier }: AuthFormProps) {
  const [mode, setMode] = useState<"login" | "signup">(tier ? "signup" : "login")

  return (
    <div className="flex min-h-screen w-full bg-[#050505]">
      {/* Left Side - Visual (Hidden on mobile) */}
      <div className="hidden lg:block w-1/2 h-screen sticky top-0">
        <BiomeVisual />
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 md:p-16 lg:p-24 relative overflow-hidden">
        {/* Background Texture */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img
            src="https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?q=80&w=2874&auto=format&fit=crop"
            alt=""
            className="w-full h-full object-cover opacity-10 mix-blend-overlay grayscale"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-[#050505]" />
        </div>

        <div className="w-full max-w-md relative z-10">
          {/* Mobile Logo Header */}
          <div className="flex items-center mb-16 lg:hidden">
            <img
              src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png"
              alt="AlkaTera"
              className="h-10 w-auto object-contain"
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {tier && (
              <div className="inline-block mb-4 px-4 py-1.5 border border-[#ccff00]/30 bg-[#ccff00]/5 rounded-full">
                <span className="font-mono text-[#ccff00] text-[10px] tracking-widest uppercase">
                  {tier} Plan Selected
                </span>
              </div>
            )}
            <h1 className="text-3xl md:text-4xl font-serif text-white mb-2">
              {mode === "login"
                ? tier ? `Sign in to activate ${tier}` : "Welcome Back"
                : tier ? `Sign up to start ${tier}` : "Create an Account"}
            </h1>
            <p className="text-gray-500 font-mono text-sm mb-12">
              {mode === "login"
                ? tier ? "Sign in and you'll be taken to complete your subscription." : "Enter your credentials to access the platform."
                : tier ? "Create your account, then complete your subscription." : "Sign up to get started with AlkaTera."}
            </p>

            {/* Google SSO */}
            <button className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-800 rounded-none hover:bg-white hover:text-black hover:border-white transition-all duration-300 text-gray-300 mb-8 group">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span className="font-mono text-sm tracking-wide uppercase group-hover:font-bold">
                Continue with Google
              </span>
            </button>

            <div className="relative flex items-center justify-center mb-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-800"></div>
              </div>
              <div className="relative bg-[#050505] px-4">
                <span className="text-xs font-mono text-gray-600 uppercase tracking-widest">
                  Or continue with email
                </span>
              </div>
            </div>

            {/* Auth Forms */}
            {mode === "login" ? (
              <LoginForm redirectTo={tier ? `/settings?tier=${tier}` : undefined} />
            ) : (
              <SignupForm redirectTo={tier ? `/settings?tier=${tier}` : undefined} />
            )}

            {/* Forgot password & mode toggle */}
            <div className="mt-8 space-y-4">
              {mode === "login" && (
                <div className="flex justify-end">
                  <Link
                    href="/password-reset"
                    className="text-xs font-mono text-gray-500 hover:text-[#ccff00] transition-colors uppercase tracking-widest border-b border-transparent hover:border-[#ccff00]"
                  >
                    Forgot Password?
                  </Link>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-gray-500 font-mono text-xs uppercase tracking-widest">
                  {mode === "login"
                    ? "Don't have an account?"
                    : "Already have an account?"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setMode(mode === "login" ? "signup" : "login")
                  }
                  className="text-[#ccff00] font-mono text-xs uppercase tracking-widest hover:underline"
                >
                  {mode === "login" ? "Sign up" : "Sign in"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-gray-700 text-[10px] font-mono uppercase tracking-widest">
            Secured by AlkaTera Intelligence Engine &bull; v2.4.0
          </p>
        </div>
      </div>
    </div>
  )
}
