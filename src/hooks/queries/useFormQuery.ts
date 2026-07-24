'use client'

import { useQuery } from '@tanstack/react-query'
import { formsClient } from '@/lib/api/forms-client'

export function formQueryKey(formId: string | null | undefined) {
  return ['form', formId] as const
}

// Shared cache for a form record — PortalEditor and its own Share tab (which
// remounts on every tab switch) previously each called formsClient.get(formId)
// independently, refetching data the other already had in memory.
export function useFormQuery(formId: string | null | undefined) {
  return useQuery({
    queryKey: formQueryKey(formId),
    queryFn: () => formsClient.get(formId as string),
    enabled: !!formId,
  })
}
