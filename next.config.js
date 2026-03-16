/** @type {import('next').NextConfig} */
const nextConfig = {
    serverExternalPackages: ["playwright", "playwright-core", "pdf-parse", "@google/generative-ai"],
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
