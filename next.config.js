const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Compression
  compress: true,
  
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
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
      '@/components': path.resolve(__dirname, 'src/components'),
      '@/ui-components': path.resolve(__dirname, 'src/ui-components'),
      '@/lib': path.resolve(__dirname, 'src/lib'),
      '@/types': path.resolve(__dirname, 'src/types'),
      '@/hooks': path.resolve(__dirname, 'src/hooks'),
      '@/styles': path.resolve(__dirname, 'src/styles'),
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

module.exports = nextConfig
