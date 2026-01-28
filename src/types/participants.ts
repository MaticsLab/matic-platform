/**
 * Participant Type Definitions
 * Represents a participant/student in the system with their enrollment data
 */

export interface EnrolledProgram {
  id: string // row_link_id for unenrolling
  participant_id: string
  activity_id: string
  activity_name: string
  enrolled_date: string
  status: string
  notes: string
}

export interface Participant {
  id: string
  workspace_id: string
  
  // Student Information
  consent_on_file: boolean
  student_id: string
  school_code: string
  first_name: string
  last_name: string
  student_phone?: string
  
  // Address
  street_number?: string
  address_direction?: string
  street_name?: string
  street_type?: string
  postal_code?: string
  
  // Demographics
  birth_date?: string
  age?: number
  gender?: string
  ethnicity?: string
  
  // Education
  feeder_school_student?: boolean
  feeder_school?: string
  feeder_school_other?: string
  grade_level?: string
  special_ed?: boolean
  ell_student?: boolean
  primary_disability?: string
  primary_language?: string
  iep?: boolean
  free_reduced_meal?: string
  number_of_family_members?: number
  
  // Contact
  contact_first_name?: string
  contact_last_name?: string
  contact_relation?: string
  contact_phone?: string
  contact_email?: string
  
  // Programs (from table_row_links)
  enrolled_programs: EnrolledProgram[]
  
  // Metadata
  created_at: string
  updated_at: string
  created_by: string
}
