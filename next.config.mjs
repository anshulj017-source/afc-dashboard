/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['firebase-admin'],
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'],
  },
};

export default nextConfig;
