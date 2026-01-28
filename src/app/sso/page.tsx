import { redirect } from 'next/navigation'

/**
 * SSO (Single Sign-On) redirect page.
 * Currently redirects to the main auth page.
 * In the future, this can be expanded to support enterprise SSO providers.
 */
export default function SSOPage() {
  // For now, redirect to the main auth page
  // TODO: Implement proper SSO with SAML/OIDC providers
  redirect('/auth')
}
