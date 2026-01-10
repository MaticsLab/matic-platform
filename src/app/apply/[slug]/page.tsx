import { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { PublicPortal } from '@/components/ApplicationsHub/Applications/ApplicantPortal/PublicPortal'
import { PublicPortalV2 } from '@/components/ApplicationsHub/Applications/ApplicantPortal/PublicPortalV2'

const BASE_URL = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'
import { APP_DOMAIN } from '@/constants/app-domain'
const APP_URL = APP_DOMAIN

const getRequestOrigin = () => {
  const hdrs = headers()
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host')
  const proto = hdrs.get('x-forwarded-proto') || 'https'
  return host ? `${proto}://${host}` : APP_URL
}

const toAbsoluteUrl = (url?: string | null) => {
  if (!url) return undefined
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  const origin = getRequestOrigin()
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`
}

async function getFormMetadata(slug: string, subdomain?: string) {
  try {
    const endpoint = subdomain 
      ? `${BASE_URL}/forms/by-subdomain/${subdomain}/${slug}`
      : `${BASE_URL}/forms/by-slug/${slug}`
    
    const response = await fetch(endpoint, { cache: 'no-store' })
    if (response.ok) {
      return await response.json()
    }
  } catch (error) {
    console.error('Failed to fetch form metadata:', error)
  }
  return null
}

export async function generateMetadata(
  { params, searchParams }: { params: { slug: string }, searchParams: { subdomain?: string } },
): Promise<Metadata> {
  const subdomain = searchParams?.subdomain
  const form = await getFormMetadata(params.slug, subdomain)
  
  const title = form?.preview_title || form?.name || 'Application Form'
  const description = form?.preview_description || form?.description || 'Fill out this application form'
  const image = toAbsoluteUrl(form?.preview_image_url)
  
  const origin = getRequestOrigin()
  const shareUrl = subdomain 
    ? `${origin}/${params.slug}`
    : `https://forms.maticsapp.com/${params.slug}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: shareUrl,
      type: 'website',
      ...(image && {
        images: [
          {
            url: image,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(image && { images: [image] }),
    },
  }
}

// Render portal for all access methods:
// - Via subdomain (rewritten by middleware)
// - Via forms.maticsapp.com (rewritten by middleware)
// - Direct /apply/{slug} access (dev environment)
export default function ApplicationPage({ 
  params, 
  searchParams 
}: { 
  params: { slug: string }, 
  searchParams: { subdomain?: string; v1?: string; v2?: string } 
}) {
  // Use PublicPortalV2 as the default (new design with sidebar navigation)
  // Can fall back to original with ?v1=true if needed
  const useV1 = searchParams?.v1 === 'true'
  
  if (useV1) {
    return <PublicPortal slug={params.slug} subdomain={searchParams?.subdomain} />
  }
  
  // Default to new V2 portal
  return <PublicPortalV2 slug={params.slug} subdomain={searchParams?.subdomain} />
}
