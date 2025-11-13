'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, Users, Building2, ChevronRight } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()

  const settingsSections = [
    {
      title: 'Profile Settings',
      description: 'Manage your personal account information and preferences',
      icon: User,
      href: '/dashboard/settings/profile',
    },
    {
      title: 'Team Management',
      description: 'Invite members, manage roles and permissions',
      icon: Users,
      href: '/dashboard/settings/team',
    },
    {
      title: 'Company Overview',
      description: 'View and update your organisation details',
      icon: Building2,
      href: '/company/overview',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account and organisation settings
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingsSections.map((section) => {
          const Icon = section.icon
          return (
            <Card
              key={section.href}
              className="cursor-pointer transition-all hover:shadow-md"
              onClick={() => router.push(section.href)}
            >
              <CardHeader>
                <div className="flex items-centre justify-between">
                  <Icon className="h-8 w-8 text-slate-700" />
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardTitle className="mt-4">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
