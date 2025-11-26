import { ExternalReviewInterface } from '@/components/ApplicationsHub/Scholarships/Reviewers/ExternalReviewInterface'

export default function ExternalReviewPage({ params }: { params: { token: string } }) {
  // In a real app, we would validate the token here and fetch the reviewer's name
  // For now, we'll mock it based on the token
  
  const reviewerName = params.token === 'demo' ? 'Demo Reviewer' : 'Guest Reviewer'

  return <ExternalReviewInterface reviewerName={reviewerName} token={params.token} />
}
