export type CampusCode = 'Islamabad' | 'Lahore' | 'Abbottabad';
export type ProgramCode = 'BS CS' | 'BS SE' | 'BS EE';
export type StudentStatus = 'Active' | 'On leave' | 'Graduated';
export type UserRole = 'admin' | 'faculty' | 'student';

export type FieldStatusType = 'synced' | 'pending' | 'syncing' | 'conflict' | 'rejected' | 'locked';

export interface StudentRecord {
  id: string; // Client-generated UUID
  reg_no: string; // Unique, e.g. CS-2026-0147
  cnic: string; // Unique, 13 digits
  full_name: string;
  program: ProgramCode;
  campus: CampusCode;
  semester: number; // 1 to 8
  status: StudentStatus;
  phone: string; // e.g. 0300-1234567
  email: string;
  address: string;
  emergency_contact: string;
  attendance: number; // 0 to 100
  remarks?: string;
  field_versions: Record<string, number>;
  version: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  last_editor_id: string;
}

export interface OutboxOperation {
  opId: string; // UUID for idempotency
  studentId: string;
  field: string;
  newValue: any;
  oldValue?: any;
  baseVersion: number;
  deviceId: string;
  type: 'create' | 'edit' | 'resolve' | 'restore';
  status: 'pending' | 'syncing' | 'failed' | 'conflict' | 'rejected';
  retryCount: number;
  createdAt: string;
  errorReason?: string;
}

export interface ConflictItem {
  id: string;
  studentId: string;
  studentName?: string;
  reg_no?: string;
  field: string;
  baseVersion: number;
  serverValue: any;
  serverVersion: number;
  incomingValue: any;
  actor: string;
  campus: string;
  device: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface HistoryItem {
  id: number; // doubles as sync cursor
  studentId: string;
  studentName: string;
  reg_no: string;
  field: string;
  oldValue: any;
  newValue: any;
  fieldVersionAfter: number;
  type: 'create' | 'edit' | 'resolve' | 'restore';
  actorName: string;
  actorRole: UserRole;
  actorCampus: string;
  device: string;
  opId: string;
  isPending?: boolean;
  createdAt: string;
}

export interface IntegrityCheck {
  id: string;
  name: string;
  invariant: string;
  description: string;
  status: 'idle' | 'running' | 'passed' | 'failed';
  offendingRowsCount: number;
  details?: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  campus?: CampusCode;
  student_id?: string;
}

export interface SimulatorState {
  isOffline: boolean;
  isSlowNetwork: boolean;
  dropNextRequest: boolean;
  dropNextResponse: boolean; // KEY DEMO MOMENT: server commits, response lost, client retries opId
  currentDeviceId: 'Device A (Admin/Campus)' | 'Device B (Student/Mobile)';
}
