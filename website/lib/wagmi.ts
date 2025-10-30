import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  walletConnectWallet,
  coinbaseWallet,
  rainbowWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';

// Get project ID from environment - must be provided
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  console.warn('WalletConnect Project ID not found. Get one at https://cloud.walletconnect.com');
}

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [
        metaMaskWallet,
        walletConnectWallet,
        coinbaseWallet,
        rainbowWallet,
      ],
    },
  ],
  {
    appName: 'FHE GeoGuessr',
    projectId: projectId || 'fallback-for-local-dev',
  }
);

export const config = createConfig({
  connectors,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
  ssr: true,
});