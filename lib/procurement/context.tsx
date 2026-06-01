'use client';

import React, { createContext, useContext } from 'react';
import type { ProcurementContextValue } from '@/types/procurement';

const ProcurementContext = createContext<ProcurementContextValue | null>(null);

interface ProviderProps extends ProcurementContextValue {
  children: React.ReactNode;
}

/**
 * The procurement portal loads { organization, member } in the server
 * layout (app/procurement/[slug]/(portal)/layout.tsx) and hydrates this
 * provider with the result. No client-side fetching required.
 */
export function ProcurementProvider({ organization, member, children }: ProviderProps) {
  return (
    <ProcurementContext.Provider value={{ organization, member }}>
      {children}
    </ProcurementContext.Provider>
  );
}

export function useProcurement(): ProcurementContextValue {
  const value = useContext(ProcurementContext);
  if (!value) {
    throw new Error('useProcurement must be used inside a ProcurementProvider');
  }
  return value;
}
