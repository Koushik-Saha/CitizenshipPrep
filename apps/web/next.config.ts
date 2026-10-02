import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ['@oathly/core', '@oathly/tokens'],
};

export default nextConfig;
