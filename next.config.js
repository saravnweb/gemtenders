/** @type {import('next').NextConfig} */
const nextConfig = {
    serverExternalPackages: ["playwright", "playwright-core", "pdf-parse", "@google/generative-ai"],
};

export default nextConfig;
