'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

interface AuthCardProps {
  title: string
  description: string
  children: React.ReactNode
  footerLink?: {
    href: string
    text: string
    linkText: string
  }
}

export function AuthCard({ title, description, children, footerLink }: AuthCardProps) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
      {footerLink && (
        <CardFooter className="flex flex-col space-y-4">
          <div className="flex items-center justify-center w-full gap-2 text-sm">
            <span className="text-muted-foreground">{footerLink.text}</span>
            <Link
              href={footerLink.href}
              className="text-primary hover:underline underline-offset-4"
            >
              {footerLink.linkText}
            </Link>
          </div>
        </CardFooter>
      )}
    </Card>
  )
}
