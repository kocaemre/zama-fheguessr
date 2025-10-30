import type { NextConfig } from "next";
import webpack from "webpack";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Temporarily disable to avoid duplicate key warnings
  eslint: {
    ignoreDuringBuilds: true, // Ignore ESLint errors during Vercel builds
  },
  typescript: {
    ignoreBuildErrors: true, // Ignore TypeScript errors during Vercel builds
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        global: false,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        assert: false,
        http: false,
        https: false,
        os: false,
        url: false,
        zlib: false,
        'pino-pretty': false,
        '@react-native-async-storage/async-storage': false,
        'react-native': false,
        'react-native-get-random-values': false,
        '@react-native-community/netinfo': false,
      };

      // Add global polyfill
      config.plugins.push(
        new webpack.DefinePlugin({
          global: 'globalThis',
        })
      );

      // Fix circular dependency issues with @zama-fhe/relayer-sdk
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            zamaFhe: {
              name: 'zama-fhe',
              test: /[\\/]node_modules[\\/]@zama-fhe[\\/]/,
              chunks: 'all',
              priority: 20,
              enforce: true,
              reuseExistingChunk: false,
            },
          },
        },
      };

      // Ignore warnings for missing React Native dependencies and other issues
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        {
          module: /node_modules\/@zama-fhe\/relayer-sdk/,
          message: /Circular dependency/,
        },
        {
          module: /node_modules\/@metamask\/sdk/,
          message: /Can't resolve '@react-native-async-storage\/async-storage'/,
        },
        {
          module: /node_modules\/pino/,
          message: /Can't resolve 'pino-pretty'/,
        },
        // Ignore all React Native related warnings
        {
          message: /Can't resolve '@react-native-async-storage\/async-storage'/,
        },
        {
          message: /Can't resolve 'pino-pretty'/,
        },
        {
          message: /Can't resolve 'react-native'/,
        },
        // Ignore MetaMask SDK warnings
        {
          module: /node_modules\/@metamask/,
          message: /Can't resolve/,
        },
        // Ignore WalletConnect warnings
        {
          module: /node_modules\/@walletconnect/,
          message: /Can't resolve/,
        },
      ];
    }
    return config;
  },

};

export default nextConfig;
