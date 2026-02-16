'use client'

import { useState } from 'react'
import { Button } from '@/ui-components/button'
import { Download, Loader2 } from 'lucide-react'
import { reviewExportClient, ReviewExportFilters } from '@/lib/api/review-export-client'
import { useToast } from '@/ui-components/use-toast'

interface ReviewExportButtonProps {
  workspaceId: string
  formId?: string
  status?: string
  disabled?: boolean
  className?: string
}

/**
 * ReviewExportButton - Export button for review workspace
 * Fetches comprehensive submission data and exports to CSV
 */
export function ReviewExportButton({
  workspaceId,
  formId,
  status,
  disabled,
  className,
}: ReviewExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()

  const handleExport = async () => {
    try {
      setIsExporting(true)

      const filters: ReviewExportFilters = {
        workspace_id: workspaceId,
      }

      if (formId) filters.form_id = formId
      if (status) filters.status = status

      // Fetch data
      const response = await reviewExportClient.getExportData(filters)

      if (response.count === 0) {
        toast({
          title: 'No data to export',
          description: 'No submissions match the current filters.',
          variant: 'default',
        })
        return
      }

      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = formId
        ? `review-export-${formId}-${timestamp}.csv`
        : `review-export-${workspaceId}-${timestamp}.csv`

      // Download CSV
      await reviewExportClient.downloadCSV(filters, filename)

      toast({
        title: 'Export successful',
        description: `Exported ${response.count} submissions to CSV.`,
        variant: 'default',
      })
    } catch (error) {
      console.error('Export failed:', error)
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export data',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      onClick={handleExport}
      disabled={disabled || isExporting}
      className={className}
      variant="outline"
    >
      {isExporting ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </>
      )}
    </Button>
  )
}
