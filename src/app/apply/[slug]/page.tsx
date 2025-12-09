import { redirect } from 'next/navigation'

// Redirect all /apply/{slug} requests to forms.maticsapp.com/{slug}
export default function ApplicationPage({ 
  params, 
  searchParams 
}: { 
  params: { slug: string }, 
  searchParams: { subdomain?: string } 
}) {
  const baseUrl = 'https://forms.maticsapp.com'
  const url = searchParams?.subdomain 
    ? `https://${searchParams.subdomain}.maticsapp.com/${params.slug}`
    : `${baseUrl}/${params.slug}`
  
  redirect(url)
}
