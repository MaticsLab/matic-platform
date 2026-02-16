/**
 * Example: Integrating Review Export into ActivityHub/ReviewWorkspace
 * 
 * This demonstrates how to add the export button to your existing review workspace.
 */

import { ReviewExportButton } from '@/components/ReviewWorkspace/ReviewExportButton'

// Example 1: Add to ActivityHub toolbar
export function ActivityHubToolbar({ workspace }: { workspace: any }) {
  return (
    <div className="flex items-center gap-2">
      {/* Your existing buttons */}
      <button>Refresh</button>
      <button>Filters</button>
      
      {/* Add the export button */}
      <ReviewExportButton
        workspaceId={workspace.id}
        className="ml-auto"
      />
    </div>
  )
}

// Example 2: Form-specific export in Applications list
export function ApplicationsListHeader({ 
  workspaceId, 
  formId 
}: { 
  workspaceId: string
  formId: string 
}) {
  return (
    <div className="flex justify-between items-center p-4">
      <h2 className="text-2xl font-semibold">Applications</h2>
      
      <div className="flex gap-2">
        <ReviewExportButton
          workspaceId={workspaceId}
          formId={formId}
          status="submitted" // Only export submitted applications
        />
      </div>
    </div>
  )
}

// Example 3: Programmatic export (e.g., for automation)
import { reviewExportClient } from '@/lib/api/review-export-client'

export async function exportReviewsAutomation(workspaceId: string) {
  try {
    // Get structured data for processing
    const response = await reviewExportClient.getExportData({
      workspace_id: workspaceId,
      status: 'submitted',
    })
    
    console.log(`Found ${response.count} submissions`)
    
    // Process each submission
    for (const submission of response.data) {
      console.log(`Processing ${submission.applicant_name}`)
      
      // Access form data
      const gpa = submission.form_data.gpa
      const essay = submission.form_data.essay
      
      // Check recommendation status
      if (submission.recommendations_submitted < submission.recommendations_count) {
        console.log(`  ⚠️  Waiting on ${submission.recommendations_pending} recommendations`)
      }
    }
    
    // Or export to CSV
    await reviewExportClient.downloadCSV(
      { workspace_id: workspaceId, status: 'submitted' },
      `weekly-review-${new Date().toISOString().split('T')[0]}.csv`
    )
    
    return response
  } catch (error) {
    console.error('Export automation failed:', error)
    throw error
  }
}

// Example 4: Custom export with filters
export function AdvancedExportDialog({ workspaceId }: { workspaceId: string }) {
  const [filters, setFilters] = useState({
    formId: '',
    status: 'submitted',
    submittedAfter: '',
    submittedBefore: '',
  })
  
  const handleExport = async () => {
    const exportFilters = {
      workspace_id: workspaceId,
      ...(filters.formId && { form_id: filters.formId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.submittedAfter && { submitted_after: filters.submittedAfter }),
      ...(filters.submittedBefore && { submitted_before: filters.submittedBefore }),
    }
    
    await reviewExportClient.downloadCSV(exportFilters)
  }
  
  return (
    <div className="space-y-4">
      <select 
        value={filters.status} 
        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
      >
        <option value="">All Statuses</option>
        <option value="submitted">Submitted</option>
        <option value="draft">Draft</option>
        <option value="in_progress">In Progress</option>
      </select>
      
      <input 
        type="date" 
        value={filters.submittedAfter}
        onChange={(e) => setFilters({ ...filters, submittedAfter: e.target.value })}
        placeholder="Submitted after"
      />
      
      <button onClick={handleExport}>
        Export Filtered Data
      </button>
    </div>
  )
}
