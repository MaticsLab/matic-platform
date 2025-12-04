import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') || '/'

  console.log('Auth callback received:', { code, token_hash, type, next })

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // Handle different auth flows
  if (code) {
    // OAuth or magic link with PKCE
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin))
    }
  } else if (token_hash && type) {
    // Email confirmation, invite, or password recovery
    if (type === 'invite' || type === 'signup') {
      // Redirect to set password page with the token
      return NextResponse.redirect(new URL(`/auth/set-password?token_hash=${token_hash}&type=${type}`, requestUrl.origin))
    } else if (type === 'recovery') {
      // Password recovery
      return NextResponse.redirect(new URL(`/auth/reset-password?token_hash=${token_hash}&type=${type}`, requestUrl.origin))
    } else if (type === 'email') {
      // Email confirmation
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'email' })
      if (error) {
        console.error('Error verifying email:', error)
        return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin))
      }
    }
  }

  // Redirect to the next page or home
  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
