/** @type {import('next').NextConfig} */
const nextConfig = {
    serverExternalPackages: ["@google/generative-ai"],
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "*.supabase.co",
            },
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com",
            },
        ],
        formats: ["image/avif", "image/webp"],
    },
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://accounts.google.com; frame-src https://accounts.google.com;" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-XSS-Protection", value: "1; mode=block" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
                    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
                    { key: "X-DNS-Prefetch-Control", value: "on" },
                    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
                    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
                ],
            },
        ];
    },
    experimental: {
        cpus: 2,
        workerThreads: false,
        optimizePackageImports: ["lucide-react"],
    },
    async redirects() {
        return [
            {
                source: '/:path*',
                has: [
                    {
                        type: 'host',
                        value: '(?<host>.*\\.vercel\\.app)',
                    },
                ],
                destination: 'https://gemtenders.org/:path*',
                permanent: true,
            },
            {
                source: '/:path*',
                has: [
                    {
                        type: 'host',
                        value: 'www.gemtenders.org',
                    },
                ],
                destination: 'https://gemtenders.org/:path*',
                permanent: true,
            },
            {
                source: '/tenders',
                destination: '/',
                permanent: true,
            },
            {
                source: '/tenders/:slug',
                destination: '/bids/:slug',
                permanent: true,
            },
            {
                source: '/bids',
                destination: '/',
                permanent: true,
            },
        ];
    },
};

export default nextConfig;
