import type { Recursiv } from '@recursiv/sdk';
import React, { createContext, type ReactNode, useContext } from 'react';
import { useAuth } from './AuthContext';
import { ORG_ID } from '@/lib/recursiv';

type RecursivContextValue = {
  sdk: Recursiv;
  orgId: string;
};

const noopSdk = new Proxy({} as Recursiv, {
  get() {
    throw new Error('Recursiv SDK is not authenticated. Sign in first.');
  },
});

const RecursivContext = createContext<RecursivContextValue | null>(null);

export function RecursivProvider({ children }: { children: ReactNode }) {
  const { sdk, orgId } = useAuth();
  return (
    <RecursivContext.Provider value={{ sdk: sdk || noopSdk, orgId: orgId || ORG_ID }}>
      {children}
    </RecursivContext.Provider>
  );
}

export function useRecursiv() {
  const ctx = useContext(RecursivContext);
  if (!ctx) throw new Error('useRecursiv must be used within RecursivProvider');
  return ctx;
}
