/** @type {import('next').NextConfig} */
const nextConfig = {
    serverExternalPackages: ["playwright", "playwright-core", "playwright-extra", "puppeteer-extra-plugin-stealth", "pdf-parse", "@google/generative-ai"],
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
