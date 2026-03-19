/** @type {import('next').NextConfig} */
const nextConfig = {
    serverExternalPackages: ["playwright", "playwright-core", "playwright-extra", "puppeteer-extra-plugin-stealth", "pdf-parse", "@google/generative-ai"],
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "tlregrteeeqwvptgpiib.supabase.co",
                pathname: "/storage/v1/object/public/**",
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
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-XSS-Protection", value: "1; mode=block" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                ],
            },
        ];
    },
    async redirects() {
        return [
            {
                source: '/tenders',
                destination: '/',
                permanent: true,
            },
        ];
    },
};

export default nextConfig;
