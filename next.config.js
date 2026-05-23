/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "itsalwaysfun.com" },
      { protocol: "https", hostname: "itsalwaysfun.net" },
      { protocol: "https", hostname: "files.sysers.com" },
    ],
  },
};

module.exports = nextConfig;
