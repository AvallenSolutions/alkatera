'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  Package,
  Users,
  Factory,
  FileText,
  Settings,
  Flame,
  Droplet,
  Trash2,
  Plus,
  ClipboardList,
  Sparkles,
  GraduationCap,
  Search,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  keywords?: string[];
  group: string;
}

const commands: CommandItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />,
    href: '/dashboard',
    keywords: ['home', 'overview'],
    group: 'Navigation',
  },
  {
    id: 'performance',
    label: 'Company Vitality',
    icon: <Sparkles className="h-4 w-4" />,
    href: '/performance',
    keywords: ['performance', 'vitality', 'health'],
    group: 'Navigation',
  },
  {
    id: 'products',
    label: 'Products',
    icon: <Package className="h-4 w-4" />,
    href: '/products',
    keywords: ['lca', 'lifecycle'],
    group: 'Navigation',
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    icon: <Users className="h-4 w-4" />,
    href: '/suppliers',
    keywords: ['vendor', 'partner'],
    group: 'Navigation',
  },
  {
    id: 'facilities',
    label: 'Facilities',
    icon: <Factory className="h-4 w-4" />,
    href: '/company/facilities',
    keywords: ['site', 'plant', 'factory'],
    group: 'Navigation',
  },
  {
    id: 'production',
    label: 'Production',
    icon: <ClipboardList className="h-4 w-4" />,
    href: '/production',
    keywords: ['manufacturing', 'output'],
    group: 'Navigation',
  },
  {
    id: 'knowledge-bank',
    label: 'Knowledge Bank',
    icon: <GraduationCap className="h-4 w-4" />,
    href: '/knowledge-bank',
    keywords: ['documents', 'resources', 'library'],
    group: 'Navigation',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: <FileText className="h-4 w-4" />,
    href: '/reports',
    keywords: ['sustainability', 'csrd'],
    group: 'Navigation',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings className="h-4 w-4" />,
    href: '/settings',
    keywords: ['preferences', 'account'],
    group: 'Navigation',
  },
  {
    id: 'new-product',
    label: 'Create New Product',
    icon: <Plus className="h-4 w-4" />,
    href: '/products/new',
    keywords: ['add', 'lca'],
    group: 'Quick Actions',
  },
  {
    id: 'new-supplier',
    label: 'Add New Supplier',
    icon: <Plus className="h-4 w-4" />,
    href: '/suppliers/new',
    keywords: ['add', 'vendor'],
    group: 'Quick Actions',
  },
  {
    id: 'scope-1-2',
    label: 'Record Scope 1 & 2 Emissions',
    icon: <Flame className="h-4 w-4" />,
    href: '/data/scope-1-2',
    keywords: ['emissions', 'direct'],
    group: 'Quick Actions',
  },
  {
    id: 'water-data',
    label: 'Record Water Data',
    icon: <Droplet className="h-4 w-4" />,
    href: '/data/water-footprint',
    keywords: ['consumption'],
    group: 'Quick Actions',
  },
  {
    id: 'waste-data',
    label: 'Record Waste Data',
    icon: <Trash2 className="h-4 w-4" />,
    href: '/data/waste-and-circularity',
    keywords: ['recycling', 'circularity'],
    group: 'Quick Actions',
  },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const groupedCommands = commands.reduce((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    acc[cmd.group].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {Object.entries(groupedCommands).map(([group, items], index) => (
          <div key={group}>
            {index > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.keywords?.join(' ') || ''}`}
                  onSelect={() => handleSelect(item.href)}
                  className="cursor-pointer"
                >
                  <span className="mr-2">{item.icon}</span>
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export function CommandPaletteTrigger() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Search...</span>
      <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
        <span className="text-xs">Cmd</span>K
      </kbd>
    </button>
  );
}
