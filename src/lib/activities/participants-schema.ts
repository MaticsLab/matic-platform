/**
 * Participants Table Schema Definition
 * Uses the platform's data_tables architecture to store participant data
 */

import { TableColumn } from '@/types/data-tables'

export const PARTICIPANTS_TABLE_NAME = 'Participants'
export const PARTICIPANTS_TABLE_SLUG = 'participants'
export const PARTICIPANTS_TABLE_DESCRIPTION = 'Manage student/participant enrollment and information'

/**
 * Column definitions for the Participants table
 * Matches the CPS Student Data form structure
 */
const participantColumnDefs: Partial<TableColumn>[] = [
  // Primary identification
  {
    name: 'full_name',
    label: 'Full Name',
    column_type: 'text',
    is_primary: true,
    is_visible: true,
    position: 0,
    width: 200,
    settings: {
      is_computed: true,
      formula: "CONCAT(first_name, ' ', last_name)"
    },
    validation: {}
  },
  
  // Basic Student Information
  {
    name: 'student_id',
    label: 'Student ID',
    column_type: 'text',
    is_visible: true,
    width: 120,
    validation: {
      required: true,
      unique: true
    }
  },
  {
    name: 'first_name',
    label: 'First Name',
    column_type: 'text',
    is_visible: true,
    width: 150,
    validation: {
      required: true
    }
  },
  {
    name: 'last_name',
    label: 'Last Name',
    column_type: 'text',
    is_visible: true,
    width: 150,
    validation: {
      required: true
    }
  },
  {
    name: 'consent_on_file',
    label: 'Consent on File',
    column_type: 'checkbox',
    is_visible: true,
    width: 100,
    settings: {},
    validation: {}
  },
  {
    name: 'school_code',
    label: 'School Code',
    column_type: 'text',
    is_visible: true,
    width: 120,
    validation: {}
  },
  {
    name: 'student_phone',
    label: 'Student Phone',
    column_type: 'phone',
    is_visible: false,
    width: 140,
    validation: {}
  },
  
  // Address Information
  {
    name: 'street_number',
    label: 'Street Number',
    column_type: 'text',
    is_visible: false,
    width: 120,
    validation: {}
  },
  {
    name: 'address_direction',
    label: 'Address Direction',
    column_type: 'select',
    is_visible: false,
    width: 100,
    settings: {
      options: [
        { value: 'N', label: 'N', color: '#3B82F6' },
        { value: 'S', label: 'S', color: '#10B981' },
        { value: 'E', label: 'E', color: '#F59E0B' },
        { value: 'W', label: 'W', color: '#EF4444' }
      ]
    },
    validation: {}
  },
  {
    name: 'street_name',
    label: 'Street Name',
    column_type: 'text',
    is_visible: false,
    width: 150,
    validation: {}
  },
  {
    name: 'street_type',
    label: 'Street Type',
    column_type: 'text',
    is_visible: false,
    width: 100,
    settings: {
      placeholder: 'AVE, ST, BLVD, etc.'
    },
    validation: {}
  },
  {
    name: 'postal_code',
    label: 'Postal Code',
    column_type: 'text',
    is_visible: true,
    width: 100,
    validation: {}
  },
  
  // Demographics
  {
    name: 'birth_date',
    label: 'Birth Date',
    column_type: 'date',
    is_visible: true,
    width: 120,
    validation: {}
  },
  {
    name: 'age',
    label: 'Age',
    column_type: 'number',
    is_visible: true,
    width: 80,
    settings: {},
    validation: {}
  },
  {
    name: 'gender',
    label: 'Gender',
    column_type: 'select',
    is_visible: true,
    width: 120,
    settings: {
      options: [
        { value: 'Female', label: 'Female', color: '#EC4899' },
        { value: 'Male', label: 'Male', color: '#3B82F6' },
        { value: 'Other', label: 'Other', color: '#8B5CF6' },
        { value: 'Prefer not to say', label: 'Prefer not to say', color: '#6B7280' }
      ]
    },
    validation: {}
  },
  {
    name: 'ethnicity',
    label: 'Ethnicity',
    column_type: 'text',
    is_visible: true,
    width: 120,
    validation: {}
  },
  
  // Education Information
  {
    name: 'grade_level',
    label: 'Grade Level',
    column_type: 'select',
    is_visible: true,
    width: 100,
    settings: {
      options: [
        { value: 'K', label: 'K', color: '#F59E0B' },
        { value: '1', label: '1', color: '#10B981' },
        { value: '2', label: '2', color: '#3B82F6' },
        { value: '3', label: '3', color: '#8B5CF6' },
        { value: '4', label: '4', color: '#EC4899' },
        { value: '5', label: '5', color: '#EF4444' },
        { value: '6', label: '6', color: '#F59E0B' },
        { value: '7', label: '7', color: '#10B981' },
        { value: '8', label: '8', color: '#3B82F6' },
        { value: '9', label: '9', color: '#8B5CF6' },
        { value: '10', label: '10', color: '#EC4899' },
        { value: '11', label: '11', color: '#EF4444' },
        { value: '12', label: '12', color: '#F59E0B' }
      ]
    },
    validation: {}
  },
  {
    name: 'feeder_school_student',
    label: 'Feeder School Student?',
    column_type: 'checkbox',
    is_visible: false,
    width: 120,
    validation: {}
  },
  {
    name: 'feeder_school',
    label: 'Feeder School',
    column_type: 'text',
    is_visible: false,
    width: 150,
    validation: {}
  },
  {
    name: 'feeder_school_other',
    label: 'Feeder School Other',
    column_type: 'text',
    is_visible: false,
    width: 150,
    validation: {}
  },
  {
    name: 'special_ed',
    label: 'Special Ed',
    column_type: 'checkbox',
    is_visible: false,
    width: 100,
    validation: {}
  },
  {
    name: 'ell_student',
    label: 'ELL Student',
    column_type: 'checkbox',
    is_visible: true,
    width: 100,
    validation: {}
  },
  {
    name: 'primary_disability',
    label: 'Primary Disability',
    column_type: 'text',
    is_visible: false,
    width: 150,
    validation: {}
  },
  {
    name: 'primary_language',
    label: 'Primary Language',
    column_type: 'text',
    is_visible: false,
    width: 120,
    validation: {}
  },
  {
    name: 'iep',
    label: 'IEP',
    column_type: 'checkbox',
    is_visible: false,
    width: 80,
    validation: {}
  },
  {
    name: 'free_reduced_meal',
    label: 'Free/Reduced Meal',
    column_type: 'select',
    is_visible: false,
    width: 140,
    settings: {
      options: [
        { value: 'Free', label: 'Free', color: '#10B981' },
        { value: 'Reduced', label: 'Reduced', color: '#F59E0B' },
        { value: 'Paid', label: 'Paid', color: '#6B7280' }
      ]
    },
    validation: {}
  },
  {
    name: 'number_of_family_members',
    label: 'Number of Family Members',
    column_type: 'number',
    is_visible: false,
    width: 120,
    validation: {}
  },
  
  // Contact Person
  {
    name: 'contact_first_name',
    label: 'Contact First Name',
    column_type: 'text',
    is_visible: false,
    width: 150,
    validation: {}
  },
  {
    name: 'contact_last_name',
    label: 'Contact Last Name',
    column_type: 'text',
    is_visible: false,
    width: 150,
    validation: {}
  },
  {
    name: 'contact_relation',
    label: 'Contact Relation',
    column_type: 'select',
    is_visible: true,
    width: 120,
    settings: {
      options: [
        { value: 'Mother', label: 'Mother', color: '#EC4899' },
        { value: 'Father', label: 'Father', color: '#3B82F6' },
        { value: 'Guardian', label: 'Guardian', color: '#8B5CF6' },
        { value: 'Other', label: 'Other', color: '#6B7280' }
      ]
    },
    validation: {}
  },
  {
    name: 'contact_phone',
    label: 'Contact Phone',
    column_type: 'phone',
    is_visible: true,
    width: 140,
    validation: {}
  },
  {
    name: 'contact_email',
    label: 'Contact Email',
    column_type: 'email',
    is_visible: true,
    width: 200,
    validation: {}
  },
  
  // Program Enrollment (link to activities table)
  // This column shows which table is connected (Activities table)
  {
    name: 'enrolled_programs',
    label: 'Enrolled Programs',
    column_type: 'link',
    is_visible: true,
    width: 250,
    position: 350, // Position after contact fields
    settings: {
      // Will be set dynamically to link to activities table
      allowMultiple: true,
      linkedTableName: 'activities',
      linkedTableLabel: 'Activities', // Shows which table this links to
      displayFields: ['name', 'category', 'status']
    },
    validation: {}
  },
  
  // Status tracking
  {
    name: 'enrollment_status',
    label: 'Enrollment Status',
    column_type: 'select',
    is_visible: true,
    width: 120,
    position: 352,
    settings: {
      options: [
        { value: 'active', label: 'Active', color: '#10B981' },
        { value: 'inactive', label: 'Inactive', color: '#6B7280' },
        { value: 'completed', label: 'Completed', color: '#3B82F6' },
        { value: 'withdrawn', label: 'Withdrawn', color: '#EF4444' }
      ]
    },
    validation: {}
  }
]

/**
 * Default view configuration for the Participants table
 */
export const PARTICIPANTS_DEFAULT_VIEW = {
  name: 'All Participants',
  view_type: 'grid' as const,
  settings: {
    columnVisibility: {
      full_name: true,
      student_id: true,
      grade_level: true,
      enrolled_programs: true,
      contact_email: true,
      contact_phone: true,
      enrollment_status: true
    },
    columnOrder: [
      'full_name',
      'student_id',
      'grade_level',
      'enrolled_programs',
      'contact_email',
      'contact_phone',
      'enrollment_status'
    ]
  },
  filters: [],
  sorts: [
    {
      columnId: 'full_name',
      direction: 'asc'
    }
  ]
}

/**
 * Generate table columns with positions
 * Ensures all columns have explicit positions, following the same pattern as activities table
 */
export function getParticipantsColumns(): Omit<TableColumn, 'id'>[] {
  return participantColumnDefs.map((col, index) => ({
    ...col,
    // Use explicit position if provided, otherwise use index
    position: col.position !== undefined ? col.position : index,
    is_primary: col.is_primary || false,
    is_visible: col.is_visible !== undefined ? col.is_visible : true,
    width: col.width || 150,
    settings: col.settings || {},
    validation: col.validation || {}
  })) as Omit<TableColumn, 'id'>[]
}
/**
 * Additional view: Active Enrollments
 */
export const PARTICIPANTS_ACTIVE_VIEW = {
  name: 'Active Enrollments',
  view_type: 'grid' as const,
  settings: {
    columnVisibility: {
      full_name: true,
      student_id: true,
      grade_level: true,
      enrolled_programs: true,
      enrollment_status: true
    }
  },
  filters: [
    {
      columnId: 'enrollment_status',
      operator: 'equals',
      value: 'active'
    }
  ],
  sorts: [
    {
      columnId: 'full_name',
      direction: 'asc'
    }
  ]
}
