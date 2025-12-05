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
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  console.log('Auth callback received:', { code, token_hash, type, next, error })

  // Handle errors from Supabase
  if (error) {
    console.error('Auth error:', error, error_description)
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error_description || error)}`, requestUrl.origin))
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // Handle different auth flows
  if (code) {
    // OAuth or magic link with PKCE - this also handles password recovery with PKCE
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      console.error('Error exchanging code for session:', exchangeError)
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin))
    }
    
    // Check if this is a recovery flow (password reset)
    // The session will have a user but we need to redirect to reset password
    if (type === 'recovery' || next === '/auth/reset-password') {
      return NextResponse.redirect(new URL('/auth/reset-password', requestUrl.origin))
    }
  } else if (token_hash && type) {
    // Email confirmation, invite, or password recovery (non-PKCE flow)
    if (type === 'invite' || type === 'signup') {
      // Redirect to set password page with the token
      return NextResponse.redirect(new URL(`/auth/set-password?token_hash=${token_hash}&type=${type}`, requestUrl.origin))
    } else if (type === 'recovery') {
      // Password recovery
      return NextResponse.redirect(new URL(`/auth/reset-password?token_hash=${token_hash}&type=${type}`, requestUrl.origin))
    } else if (type === 'email') {
      // Email confirmation
      const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash, type: 'email' })
      if (verifyError) {
        console.error('Error verifying email:', verifyError)
        return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(verifyError.message)}`, requestUrl.origin))
      }
    }
  }

  // Redirect to the next page or home
  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
