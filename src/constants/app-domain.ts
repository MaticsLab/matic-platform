// Centralized app domain config
// NEXT_PUBLIC_ variables are injected at build time by Next.js
// They become static strings in the client bundle
export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_URL || 'https://www.maticsapp.com';
