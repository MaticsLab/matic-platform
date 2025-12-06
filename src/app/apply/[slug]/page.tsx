import { Metadata } from 'next'
import { headers } from 'next/headers'
import { PublicPortal } from '@/components/ApplicationsHub/Applications/ApplicantPortal/PublicPortal'

const BASE_URL = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://maticsapp.com'

const getRequestOrigin = () => {
  const hdrs = headers()
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host')
  const proto = hdrs.get('x-forwarded-proto') || 'https'
  return host ? `${proto}://${host}` : APP_URL
}

// Ensure we always emit an absolute URL for social previews
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
  parent: any
): Promise<Metadata> {
  const subdomain = searchParams?.subdomain
  const form = await getFormMetadata(params.slug, subdomain)
  
  const title = form?.preview_title || form?.name || 'Application Form'
  const description = form?.preview_description || form?.description || 'Fill out this application form'
  const image = toAbsoluteUrl(form?.preview_image_url)
  
  // Build the share URL anchored to the current request origin for proper previews
  const origin = getRequestOrigin()
  const shareUrl = subdomain 
    ? `${origin}/apply/${params.slug}?subdomain=${subdomain}`
    : `${origin}/apply/${params.slug}`

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

export default function ApplicationPage({ params, searchParams }: { params: { slug: string }, searchParams: { subdomain?: string } }) {
  return <PublicPortal slug={params.slug} subdomain={searchParams?.subdomain} />
}
