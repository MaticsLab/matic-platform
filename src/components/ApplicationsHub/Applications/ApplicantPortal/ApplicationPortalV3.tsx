import { useEffect, useState } from 'react'
import { Field, Section } from '@/types/portal'
import { Button } from '@/ui-components/button'
import { fetchSubmissionByIdDirect, fetchFormResponsesBySubmissionId } from '@/lib/api/supabase-direct'
import { supabase } from '@/lib/supabase'

interface ApplicationPortalV3Props {
  submissionId: string
  sections: Section[]
}

export function ApplicationPortalV3({ submissionId, sections }: ApplicationPortalV3Props) {
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const responses = await fetchFormResponsesBySubmissionId(submissionId)
      setResponses(responses)
      setLoading(false)
    }
    load()
  }, [submissionId])

  const handleChange = (fieldId: string, value: any) => {
    setResponses(prev => ({ ...prev, [fieldId]: value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    // Save each field response to form_responses (upsert)
    const updates = Object.entries(responses).map(([field_id, value]) => ({
      submission_id: submissionId,
      field_id,
      value_text: typeof value === 'string' ? value : null,
      value_number: typeof value === 'number' ? value : null,
      value_date: value instanceof Date ? value.toISOString() : null,
      value_json: typeof value === 'object' && value !== null && !(value instanceof Date) ? value : null,
    }))
    const { error } = await supabase
      .from('form_responses')
      .upsert(updates, { onConflict: ['submission_id', 'field_id'] })
    setIsSaving(false)
    if (error) {
      alert('Save failed: ' + error.message)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-8">
      {sections.map(section => (
        <div key={section.id}>
          <h2 className="text-xl font-bold mb-2">{section.title}</h2>
          <div className="grid grid-cols-12 gap-6">
            {section.fields.map(field => (
              <div key={field.id} className="col-span-12">
                <label className="block mb-1 font-medium">{field.label}</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  value={responses[field.id] || ''}
                  onChange={e => handleChange(field.id, e.target.value)}
                  placeholder={field.placeholder || ''}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save'}
      </Button>
    </div>
  )
}
