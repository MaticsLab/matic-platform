'use client'

import { useSearchParams } from 'next/navigation'
import { PublicPortal } from '@/components/ApplicationsHub/Applications/ApplicantPortal/PublicPortal'

export default function ApplicationPage({ params }: { params: { slug: string } }) {
  const searchParams = useSearchParams()
  const subdomain = searchParams.get('subdomain')
  
  return <PublicPortal slug={params.slug} subdomain={subdomain || undefined} />
}
