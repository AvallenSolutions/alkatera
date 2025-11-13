"use client"

import { useState } from "react"
import Link from "next/link"
import { LoginForm } from "./LoginForm"
import { SignupForm } from "./SignupForm"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup">("login")

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{mode === "login" ? "Welcome Back" : "Create an Account"}</CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Sign in to your account to continue"
            : "Sign up to get started with AlkaTera"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mode === "login" ? <LoginForm /> : <SignupForm />}
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        {mode === "login" && (
          <Link
            href="/password-reset"
            className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
          >
            Forgot your password?
          </Link>
        )}
        <div className="flex items-center justify-center w-full gap-2 text-sm">
          <span className="text-muted-foreground">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}
          </span>
          <Button
            variant="link"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="p-0 h-auto"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
