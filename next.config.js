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
                source: "/(.*)",
                headers: [
                    { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.supabase.co;" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-XSS-Protection", value: "1; mode=block" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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
