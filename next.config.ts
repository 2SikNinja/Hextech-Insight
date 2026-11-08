import type { NextConfig } from 'next'

const isDevelopment = process.env.NODE_ENV === 'development'

// Local port for the FastAPI dev server (must match "dev:python" in package.json).
const pythonDevPort = 8000

const nextConfig: NextConfig = {
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,

  images: {
    // Champion, item and icon images come straight from Riot's Data Dragon CDN,
    // which already serves small optimized files. Skipping Vercel's image
    // optimizer keeps us inside the free plan's limits.
    unoptimized: true,
  },

  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },

  async rewrites() {
    return [
      {
        // Everything under /api/py goes to the Python (FastAPI) analytics service.
        // Locally that is the uvicorn dev server. On Vercel it is the Python
        // serverless function built from api/index.py.
        source: '/api/py/:path*',
        destination: isDevelopment ? `http://127.0.0.1:${pythonDevPort}/api/py/:path*` : '/api/',
      },
    ]
  },
}

export default nextConfig
