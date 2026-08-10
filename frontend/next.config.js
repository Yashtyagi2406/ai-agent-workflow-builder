import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@nhost/nextjs', '@nhost/react'],
};

export default nextConfig;
