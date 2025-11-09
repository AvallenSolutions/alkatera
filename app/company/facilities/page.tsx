'use client'

import { AppLayout } from '@/components/layouts/AppLayout'

export default function FacilitiesPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Facilities Management
          </h1>
          <p className="text-base text-muted-foreground max-w-3xl">
            Manage your company's operational facilities, including energy consumption and waste generation data.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-8 text-centre">
          <div className="flex flex-col items-centre gap-4">
            <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Facilities Module Coming Soon
              </h2>
              <p className="text-sm text-muted-foreground max-w-md">
                This section will allow you to add and manage your operational facilities,
                track energy consumption, and monitor waste generation across all sites.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
