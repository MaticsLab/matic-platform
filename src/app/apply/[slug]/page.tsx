'use client'

import { PublicPortal } from '@/components/ApplicationsHub/Scholarships/ApplicantPortal/PublicPortal'

export default function ApplicationPage({ params }: { params: { slug: string } }) {
  return <PublicPortal slug={params.slug} />
}
