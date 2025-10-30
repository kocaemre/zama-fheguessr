'use client';

import { Providers } from '../providers';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <Providers>
        {children}
      </Providers>
    </ErrorBoundary>
  );
}