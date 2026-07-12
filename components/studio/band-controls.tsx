'use client';

import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/lib/organizationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from '@/components/layouts/NotificationBell';
import { HelpPanel } from './help-panel';

/**
 * The room band's quiet right-hand cluster: notifications, the
 * organisation, the person. Replaces the old Header's org switcher and
 * account menu; text and marks on colour are cream or ink only, so
 * everything here inherits the band's currentColor.
 */
export function BandControls() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { currentOrganization, organizations, switchOrganization } = useOrganization();

  const initial =
    user?.user_metadata?.full_name?.[0]?.toUpperCase() ??
    user?.email?.[0]?.toUpperCase() ??
    '·';

  return (
    <div className="flex shrink-0 items-center gap-1">
      <HelpPanel />
      <span className="[&_button]:text-current [&_svg]:h-4 [&_svg]:w-4">
        <NotificationBell />
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full px-2 py-1 opacity-90 transition-opacity duration-150 ease-studio hover:opacity-100"
            aria-label="Organisation and account"
          >
            <span className="hidden max-w-[9rem] truncate font-mono text-[10px] uppercase tracking-[0.18em] md:block">
              {currentOrganization?.name ?? 'Account'}
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-current font-mono text-[10px] font-bold">
              {initial}
            </span>
            <ChevronsUpDown className="h-3 w-3 opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60" align="end">
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-medium">
              {user?.user_metadata?.full_name ?? user?.email}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
          </DropdownMenuLabel>
          {organizations.length > 1 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Organisations
              </DropdownMenuLabel>
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => switchOrganization(org.id)}
                  className="flex items-center justify-between"
                >
                  <span className="truncate">{org.name}</span>
                  {org.id === currentOrganization?.id && <Check className="h-4 w-4 shrink-0" />}
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
