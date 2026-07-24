const path = require('path')
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

// Same fallback go-client.ts itself uses when this env var is unset. Derived
// at build time rather than hardcoded: NEXT_PUBLIC_GO_API_URL is currently
// pinned to Railway's own generated backend domain in production (not the
// custom api.maticsapp.com domain the code falls back to), which is exactly
// the kind of drift that silently 400s next/image's optimizer if the allowed
// host is hardcoded to the "intended" domain instead of the real one.
const GO_API_HOSTNAME = new URL(
  process.env.NEXT_PUBLIC_GO_API_URL || 'https://api.maticsapp.com/api/v1'
).hostname

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Skip ESLint during builds (run it separately in CI)
  eslint: { ignoreDuringBuilds: true },
  
  // Railway runs directly from the build output, so standalone packaging is unnecessary.
  // Keeping default output avoids intermittent manifest copy errors during standalone emit.
  
  // Compression
  compress: true,
  
  // Transpile packages that must be compiled for Next.js
  transpilePackages: ['better-auth'],

  // Uploaded assets (workspace logos, cover images) are served from the Go
  // backend's own storage proxy (see storageObjectUrl in storage-client.ts) —
  // never a third-party or user-supplied host, so these are narrow, specific
  // patterns rather than a wildcard. Both the actual current backend host
  // (GO_API_HOSTNAME) and the intended custom domain are listed, so this
  // keeps working if NEXT_PUBLIC_GO_API_URL is ever repointed to the latter.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: GO_API_HOSTNAME,
        pathname: '/api/v1/storage/object/**',
      },
      {
        protocol: 'https',
        hostname: 'api.maticsapp.com',
        pathname: '/api/v1/storage/object/**',
      },
    ],
  },
  
  // API proxy to backend (excludes /api/auth which is handled by Better Auth)
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: process.env.NEXT_PUBLIC_GO_API_URL 
          ? `${process.env.NEXT_PUBLIC_GO_API_URL.replace('/api/v1', '')}/:path*`
          : 'http://localhost:8080/api/v1/:path*',
      },
    ]
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  
  // Webpack optimization
  webpack: (config, { isServer }) => {
    // Avoid webpack's WASM-based xxhash64 content hasher — it has a known crash
    // ("Cannot read properties of undefined (reading 'length')" in WasmHash._updateWithBuffer)
    // that reproduced reliably on Railway's build machines while building locally clean.
    // sha256 is the traditional, non-WASM webpack hash implementation.
    config.output.hashFunction = 'sha256'

    // The sha256 switch above didn't fully avoid this class of crash — it
    // recurred with Node's own crypto Hash.update() ("data argument must be
    // string/Buffer... Received undefined") right after a commit that deleted
    // a large number of files. That's the real signature of a stale
    // persistent filesystem cache (.next/cache/webpack) still holding a
    // reference to a module/asset that no longer exists on disk, which then
    // gets hashed as undefined regardless of which hash algorithm runs.
    // Disabling the cross-build persistent cache (in-memory only, scoped to a
    // single build) removes the possibility of stale references entirely.
    config.cache = { type: 'memory' }

    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
      '@/components': path.resolve(__dirname, 'src/components'),
      '@/ui-components': path.resolve(__dirname, 'src/ui-components'),
      '@/lib': path.resolve(__dirname, 'src/lib'),
      '@/types': path.resolve(__dirname, 'src/types'),
      '@/hooks': path.resolve(__dirname, 'src/hooks'),
      '@/styles': path.resolve(__dirname, 'src/styles'),
      '@/auth': path.resolve(__dirname, 'auth'),
    }
    
    // Add watch options to ignore auth directory for file watching
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules', '**/.git', '**/auth/**/*.md'],
    }

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      }
      
      // Exclude pg and other Node.js-only packages from client bundle
      config.externals = config.externals || []
      if (Array.isArray(config.externals)) {
        config.externals.push('pg', 'pg-native')
      } else {
        config.externals = [config.externals, 'pg', 'pg-native']
      }
    }

    return config
  },
}

module.exports = withBundleAnalyzer(nextConfig)
