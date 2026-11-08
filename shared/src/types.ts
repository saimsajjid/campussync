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

export type OperationType = 'create' | 'edit' | 'resolve' | 'restore';

export interface OutboxOperation {
  opId: string; // UUID for idempotency
  studentId: string;
  field: string;
  newValue: any;
  oldValue?: any;
  baseVersion: number;
  deviceId: string;
  type: OperationType;
  status: 'pending' | 'syncing' | 'failed' | 'conflict' | 'rejected' | 'applied' | 'duplicate';
  retryCount: number;
  createdAt: string;
  errorReason?: string;
}

export interface HistoryItem {
  id: number; // doubles as sync cursor (bigserial)
  studentId: string;
  studentName: string;
  reg_no: string;
  field: string;
  oldValue: any;
  newValue: any;
  fieldVersionAfter: number;
  type: OperationType;
  actorName: string;
  actorRole: UserRole;
  actorCampus: string;
  device: string;
  opId: string;
  createdAt: string;
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
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  campus?: CampusCode;
  student_id?: string;
}

// Sync Protocol Payloads
export interface PushBatchRequest {
  operations: Array<{
    opId: string;
    studentId: string;
    field: string;
    newValue: any;
    baseVersion: number;
    deviceId: string;
    type: OperationType;
    studentData?: Partial<StudentRecord>; // Used for 'create' operation
  }>;
}

export type OperationResultStatus = 'applied' | 'duplicate' | 'conflict' | 'rejected' | 'duplicate_record';

export interface OperationResult {
  opId: string;
  status: OperationResultStatus;
  isNoOp?: boolean;
  studentId?: string;
  field?: string;
  serverVersion?: number;
  fieldVersion?: number;
  serverValue?: any;
  conflictId?: string;
  reason?: string;
  existingRecordId?: string;
}

export interface PushBatchResponse {
  results: OperationResult[];
  latestCursor: number;
}

export interface PullResponse {
  changes: HistoryItem[];
  latestCursor: number;
}

export interface SnapshotResponse {
  students: StudentRecord[];
  conflicts: ConflictItem[];
  latestCursor: number;
}

export interface IntegrityCheckResult {
  id: string;
  name: string;
  invariant: string;
  description: string;
  status: 'passed' | 'failed';
  offendingRowsCount: number;
  details?: any[];
}

export interface IntegritySuiteResponse {
  allPassed: boolean;
  timestamp: string;
  checks: IntegrityCheckResult[];
}
