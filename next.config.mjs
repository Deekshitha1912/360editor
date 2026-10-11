/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: '*.supabase.co' },
        ],
    },
    // Lets a verification build (NEXT_DIST_DIR=.next-check npm run build)
    // write somewhere other than the running dev server's .next folder.
    distDir: process.env.NEXT_DIST_DIR || '.next',
    experimental: {
        // Turbopack's on-disk dev cache is on by default in Next 16 and still
        // beta. Reusing stale entries from it across restarts is what served
        // intermittent 404s for real routes (e.g. /360editor) right after
        // `npm run dev` started. Off costs only a slower first compile.
        turbopackFileSystemCacheForDev: false,
    },
};

export default nextConfig;
