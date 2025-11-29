'use client'

import { PublicPortal } from '@/components/ApplicationsHub/Applications/ApplicantPortal/PublicPortal'

export default function ApplicationPage({ params }: { params: { slug: string } }) {
  return <PublicPortal slug={params.slug} />
}
