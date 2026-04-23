'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { useOrganization } from '@/lib/organizationContext'
import { useAuth } from '@/hooks/useAuth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { LogOut, User, Menu, X, Building2, Check, ChevronsUpDown, Dog, MessageSquare, Upload, CornerDownLeft } from 'lucide-react'
import { CommandPalette } from '@/components/dashboard/CommandPalette'
import { UniversalDropzone } from '@/components/layouts/UniversalDropzone'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { FeedbackDialog } from '@/components/feedback/FeedbackDialog'
import { NotificationBell } from '@/components/layouts/NotificationBell'

interface HeaderProps {
  onMenuClick?: () => void
  isMobileMenuOpen?: boolean
}

export function Header({ onMenuClick, isMobileMenuOpen }: HeaderProps) {
  const router = useRouter()
  const { currentOrganization, organizations, switchOrganization } = useOrganization()
  const { user, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [orgPopoverOpen, setOrgPopoverOpen] = useState(false)
  const [rosaPrompt, setRosaPrompt] = useState('')

  const submitRosaPrompt = (e?: React.FormEvent) => {
    e?.preventDefault()
    const q = rosaPrompt.trim()
    if (!q) return
    router.push(`/rosa?prompt=${encodeURIComponent(q)}`)
    setRosaPrompt('')
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    router.refresh()
  }

  const getUserInitials = () => {
    if (!user?.email) return 'U'
    return user.email.charAt(0).toUpperCase()
  }

  const getUserDisplayName = () => {
    return user?.user_metadata?.full_name || user?.email || 'User'
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-colors">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle menu</span>
          </Button>

          {organizations.length > 0 && (
            <Popover open={orgPopoverOpen} onOpenChange={setOrgPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={orgPopoverOpen}
                  className="w-[200px] justify-between"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="truncate text-sm">
                      {currentOrganization?.name || 'Select organisation'}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0">
                <Command>
                  <CommandInput placeholder="Search organisations..." />
                  <CommandList>
                    <CommandEmpty>No organisations found.</CommandEmpty>
                    <CommandGroup heading="Your Organisations">
                      {organizations.map((org) => (
                        <CommandItem
                          key={org.id}
                          value={org.name}
                          onSelect={() => {
                            switchOrganization(org.id)
                            setOrgPopoverOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              currentOrganization?.id === org.id
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          {org.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className="flex items-center gap-2">
          <form
            onSubmit={submitRosaPrompt}
            className="hidden sm:flex items-center gap-2 relative"
          >
            <div className="relative">
              <Dog className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400 pointer-events-none" />
              <Input
                value={rosaPrompt}
                onChange={(e) => setRosaPrompt(e.target.value)}
                placeholder="Ask Rosa anything..."
                aria-label="Ask Rosa"
                className="h-9 w-[280px] lg:w-[360px] pl-8 pr-14"
              />
              <kbd className="hidden lg:inline-flex absolute right-2 top-1/2 -translate-y-1/2 h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground pointer-events-none">
                <CornerDownLeft className="h-3 w-3" />
              </kbd>
            </div>
          </form>
          <CommandPalette />
          <FeedbackDialog
            trigger={
              <Button variant="ghost" size="icon" className="hidden sm:flex">
                <MessageSquare className="h-4 w-4" />
                <span className="sr-only">Send Feedback</span>
              </Button>
            }
          />
          <NotificationBell />
          <UniversalDropzone
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="gap-2 h-9 border-[#ccff00]/40 hover:bg-[#ccff00]/10"
                title="Upload anything — we'll figure out what it is"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Upload</span>
              </Button>
            }
          />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-slate-200 dark:bg-slate-700">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {getUserDisplayName()}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push('/dashboard/settings/profile')}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                <span>Profile Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                disabled={signingOut}
                className="cursor-pointer text-red-600 dark:text-red-400"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>{signingOut ? 'Signing out...' : 'Sign out'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
