'use client'

import Image from "next/image"
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm"
import { motion } from "framer-motion"

export default function UpdatePasswordPage() {
  return (
    <div data-auth-page className="relative min-h-screen text-white">
      {/* Full-page background */}
      <Image
        src="/images/blueberry-field.jpg"
        alt="Blueberry field"
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
              src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png"
              alt="AlkaTera"
              className="h-12 md:h-14 w-auto object-contain"
            />
          </div>

          {/* Hero headline - matching /getaccess styling */}
          <h1 className="font-serif text-4xl md:text-5xl text-white text-center mb-4 whitespace-nowrap">
            Update your password.
          </h1>
          <p className="text-white/50 text-center mb-8">
            Choose a new password for your account.
          </p>

          {/* Glassmorphism Card - matching /getaccess styling */}
          <div className="border border-white/10 bg-white/5 backdrop-blur-md rounded-2xl p-8">
            <UpdatePasswordForm />
          </div>
        </motion.div>

        {/* Photo credit */}
        <div className="absolute bottom-4 text-center text-[10px] text-white/20">
          Photo by{' '}
          <a
            href="https://unsplash.com/@joshuaearle"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white/40"
          >
            Joshua Earle
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
