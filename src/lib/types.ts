export type UserRole = 'user' | 'coordinator' | 'admin';

export type RegistrationType = 'iste' | 'non-iste';
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';
export type RegistrationStatus = 'reserved' | 'confirmed' | 'cancelled';
export type AttendanceStatus = 'pending' | 'checked_in' | 'absent';
export type SubmissionStatus = 'not_started' | 'draft' | 'submitted' | 'under_review' | 'evaluated';
export type SupportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type SupportCategory = 
  | 'Registration'
  | 'Payment'
  | 'Ticket'
  | 'Attendance'
  | 'Team'
  | 'Submission'
  | 'Certificate'
  | 'Other';

export type CoordinatorPermission = 
  | 'CHECKIN_VIEW'
  | 'CHECKIN_MANAGE'
  | 'PARTICIPANT_VIEW'
  | 'REGISTRATION_VERIFY'
  | 'SUPPORT_VIEW'
  | 'SUPPORT_REPLY';

export interface User {
  id: string;
  auth_id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: 'active' | 'inactive';
  password?: string;
  created_at: string;
}

export interface ParticipantProfile {
  id: string;
  user_id: string;
  certificate_name: string;
  mobile: string;
  roll_number: string;
  year: '1st Year' | '2nd Year' | '3rd Year' | '4th Year';
  branch: 'AI & DS' | 'IT' | 'CSE' | 'ECE' | 'EEE' | 'Mechanical' | 'Civil';
  section: string; // typed by the student, stored upper-case (e.g. A, B2)
  iste_member: boolean;
  iste_sm_number?: string;
  has_laptop: boolean;
  linkedin_portfolio?: string;
  created_at: string;
}

export interface Registration {
  id: string;
  registration_number: string; // e.g. P2P-2026-A8F92X
  participant_id: string;
  event_id: string;
  registration_type: RegistrationType;
  fee: number; // 50 or 100
  payment_status: PaymentStatus;
  registration_status: RegistrationStatus;
  utr_number?: string;
  payment_proof_path?: string;
  payment_submitted_at?: string;
  rejection_reason?: string;
  verified_at?: string;
  verified_by_name?: string;
  created_at: string;
}

export interface Payment {
  id: string;
  registration_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  amount: number;
  status: PaymentStatus;
  payment_method?: string;
  utr_number?: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  registration_id: string;
  ticket_number: string;
  qr_token: string;
  wallet_pass_url?: string;
  status: 'active' | 'used' | 'cancelled';
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  ticket_id: string;
  registration_number: string;
  participant_name: string;
  roll_number: string;
  branch: string;
  year: string;
  section: string;
  iste_member: boolean;
  checked_in_by: string; // coordinator user id or name
  check_in_time: string;
  check_in_at?: string;
  status: 'checked_in' | 'absent';
}

export interface CoordinatorInfo {
  id: string;
  user_id: string;
  name: string;
  email: string;
  employee_or_student_id: string;
  status: 'active' | 'disabled';
  permissions: CoordinatorPermission[];
  created_at: string;
}

export interface EventResource {
  id: string;
  title: string;
  description: string;
  resource_type: 'pdf' | 'guide' | 'code' | 'presentation' | 'video' | 'link';
  file_url: string;
  file_size?: string;
  published: boolean;
  created_by: string;
  created_at: string;
}

export interface Team {
  id: string;
  event_id: string;
  name: string;
  invite_code: string; // e.g. P2P-AI42
  leader_id: string;
  leader_name: string;
  created_at: string;
  members: TeamMember[];
}

export interface TeamMember {
  id: string;
  team_id: string;
  participant_id: string;
  name: string;
  roll_number: string;
  branch: string;
  is_leader: boolean;
  joined_at: string;
}

export interface ProjectSubmission {
  id: string;
  team_id: string;
  team_name: string;
  project_name: string;
  problem_statement: string;
  description: string;
  technologies: string[];
  github_url?: string;
  demo_url?: string;
  presentation_url?: string;
  file_url?: string;
  status: SubmissionStatus;
  scores?: {
    innovation: number; // 0-10
    tools_tech?: number; // 0-20
    ui_ux?: number; // 0-10
    production_ready?: number; // 0-10
    ai_prompting?: number; // legacy alias (0-20)
    tech_execution?: number; // legacy alias (0-10)
    presentation?: number; // legacy alias (0-10)
    total: number; // 0-50
    feedback?: string;
  };
  submitted_at: string;
}

export interface SupportTicketMessage {
  id: string;
  sender_name: string;
  sender_role: UserRole;
  message: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  ticket_code: string; // SUP-2026-001
  user_id: string;
  user_name: string;
  registration_id?: string;
  category: SupportCategory;
  subject: string;
  message: string;
  attachment_url?: string;
  status: SupportStatus;
  assigned_to?: string;
  responses: SupportTicketMessage[];
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'urgent';
  category: 'general' | 'schedule' | 'challenge' | 'wifi' | 'certificate';
  published: boolean;
  created_at: string;
}

export interface Certificate {
  id: string;
  certificate_id: string; // CERT-P2P-2026-089
  registration_id: string;
  participant_name: string;
  roll_number: string;
  branch: string;
  college_name: string;
  type: 'participation' | 'winner' | 'runner_up' | 'merit';
  rank?: string;
  issue_date: string;
  verification_url: string;
  status: 'issued' | 'revoked';
}

export interface EventConfig {
  name: string;
  subtitle: string;
  organized_by: string;
  associated_with: string;
  date: string;
  date_formatted: string;
  time: string;
  venue: string;
  capacity: number;
  registration_open: boolean;
  iste_fee: number;
  non_iste_fee: number;
  max_team_size: number;
  description: string;
  event_end_at?: string;
  submission_deadline_at?: string;
  upi_id?: string;
  upi_payee_name?: string;
  support_contact_name?: string;
  support_whatsapp?: string;
}
