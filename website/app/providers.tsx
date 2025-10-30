'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi';
import { useState } from 'react';

// Singleton pattern to prevent multiple initializations
let queryClient: QueryClient | null = null;

function getQueryClient() {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          // Prevent refetching immediately on component mount
          staleTime: 60 * 1000,
        },
      },
    });
  }
  return queryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => getQueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={client}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}