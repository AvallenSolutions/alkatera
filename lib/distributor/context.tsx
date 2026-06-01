'use client';

import React, { createContext, useContext } from 'react';
import type { DistributorContextValue } from '@/types/distributor';

const DistributorContext = createContext<DistributorContextValue | null>(null);

interface ProviderProps extends DistributorContextValue {
  children: React.ReactNode;
}

/**
 * The distributor portal loads { organization, member, partnerProcurement }
 * in the server layout (app/(distributor)/layout.tsx) and hydrates this
 * provider with the result. No client-side fetching is needed; state
 * refreshes on navigation.
 */
export function DistributorProvider({
  organization,
  member,
  partnerProcurement,
  children,
}: ProviderProps) {
  return (
    <DistributorContext.Provider value={{ organization, member, partnerProcurement }}>
      {children}
    </DistributorContext.Provider>
  );
}

export function useDistributor(): DistributorContextValue {
  const value = useContext(DistributorContext);
  if (!value) {
    throw new Error('useDistributor must be used inside a DistributorProvider');
  }
  return value;
}
