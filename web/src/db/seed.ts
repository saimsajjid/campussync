import { db } from './index';
import type { StudentRecord, ConflictItem, HistoryItem } from '../types';

export const INITIAL_STUDENTS: StudentRecord[] = [
  {
    id: 'e01a8f90-8431-4822-92ab-1101aa000001',
    reg_no: 'CS-2026-0101',
    cnic: '37405-1234567-1',
    full_name: 'Muhammad Ahmed',
    program: 'BS CS',
    campus: 'Islamabad',
    semester: 4,
    status: 'Active',
    phone: '0300-5551234',
    email: 'm.ahmed@campussync.edu.pk',
    address: 'House 14-B, Sector F-8/2, Islamabad',
    emergency_contact: 'Naveed Ahmed (0300-5551200)',
    attendance: 88,
    remarks: 'Consistent academic performance and strong lab presence',
    field_versions: {
      phone: 1,
      email: 1,
      address: 1,
      emergency_contact: 1,
      attendance: 1,
      remarks: 1,
      semester: 1,
      status: 1
    },
    version: 8,
    active: true,
    created_at: '2026-11-01T08:00:00Z',
    updated_at: '2026-11-06T14:30:00Z',
    last_editor_id: 'admin_isb_01'
  },
  {
    id: 'e01a8f90-8431-4822-92ab-1101aa000002',
    reg_no: 'CS-2026-0102',
    cnic: '35201-9876543-2',
    full_name: 'Fatima Zahra',
    program: 'BS SE',
    campus: 'Lahore',
    semester: 6,
    status: 'Active',
    phone: '0321-4445678',
    email: 'f.zahra@campussync.edu.pk',
    address: 'Flat 402, Al-Rehman Heights, Gulberg III, Lahore',
    emergency_contact: 'Zahra Begum (0321-4445600)',
    attendance: 94,
    remarks: 'Dean Honor Roll candidate; active software society lead',
    field_versions: {
      phone: 2,
      email: 1,
      address: 1,
      emergency_contact: 1,
      attendance: 2,
      remarks: 1,
      semester: 1,
      status: 1
    },
    version: 10,
    active: true,
    created_at: '2026-11-01T08:30:00Z',
    updated_at: '2026-11-07T11:20:00Z',
    last_editor_id: 'admin_lhr_02'
  },
  {
    id: 'e01a8f90-8431-4822-92ab-1101aa000003',
    reg_no: 'CS-2026-0103',
    cnic: '13101-5556677-3',
    full_name: 'Hamza Tariq',
    program: 'BS EE',
    campus: 'Abbottabad',
    semester: 2,
    status: 'Active',
    phone: '0333-8889900',
    email: 'h.tariq@campussync.edu.pk',
    address: 'House 42, Street 8, Supply Bazaar, Abbottabad',
    emergency_contact: 'Tariq Mehmood (0333-8889901)',
    attendance: 76,
    remarks: 'Requires regular attendance in Circuit Analysis lab',
    field_versions: {
      phone: 1,
      email: 1,
      address: 2,
      emergency_contact: 1,
      attendance: 1,
      remarks: 1,
      semester: 1,
      status: 1
    },
    version: 9,
    active: true,
    created_at: '2026-11-02T09:15:00Z',
    updated_at: '2026-11-07T16:45:00Z',
    last_editor_id: 'faculty_abt_01'
  },
  {
    id: 'e01a8f90-8431-4822-92ab-1101aa000004',
    reg_no: 'CS-2026-0104',
    cnic: '61101-2233445-4',
    full_name: 'Ayesha Malik',
    program: 'BS CS',
    campus: 'Islamabad',
    semester: 8,
    status: 'Graduated',
    phone: '0345-1122334',
    email: 'ayesha.m@campussync.edu.pk',
    address: 'Street 9, Sector G-10/4, Islamabad',
    emergency_contact: 'Rashid Malik (0345-1122330)',
    attendance: 92,
    remarks: 'Final Year Project completed with distinction (AI Diagnostic Tool)',
    field_versions: {
      phone: 1,
      email: 1,
      address: 1,
      emergency_contact: 1,
      attendance: 1,
      remarks: 1,
      semester: 8,
      status: 3
    },
    version: 15,
    active: true,
    created_at: '2026-10-25T10:00:00Z',
    updated_at: '2026-11-05T12:00:00Z',
    last_editor_id: 'admin_isb_01'
  },
  {
    id: 'e01a8f90-8431-4822-92ab-1101aa000005',
    reg_no: 'CS-2026-0105',
    cnic: '38403-7788990-5',
    full_name: 'Bilal Hassan',
    program: 'BS SE',
    campus: 'Lahore',
    semester: 3,
    status: 'On leave',
    phone: '0312-7778899',
    email: 'b.hassan@campussync.edu.pk',
    address: 'Main Canal Road, Muslim Town, Lahore',
    emergency_contact: 'Hassan Ali (0312-7778800)',
    attendance: 64,
    remarks: 'Medical leave approved for semester duration',
    field_versions: {
      phone: 1,
      email: 1,
      address: 1,
      emergency_contact: 1,
      attendance: 1,
      remarks: 2,
      semester: 1,
      status: 2
    },
    version: 9,
    active: true,
    created_at: '2026-11-03T11:00:00Z',
    updated_at: '2026-11-06T15:20:00Z',
    last_editor_id: 'admin_lhr_02'
  },
  {
    id: 'e01a8f90-8431-4822-92ab-1101aa000006',
    reg_no: 'CS-2026-0106',
    cnic: '17301-4455667-6',
    full_name: 'Zainab Bibi',
    program: 'BS CS',
    campus: 'Abbottabad',
    semester: 5,
    status: 'Active',
    phone: '0301-9988776',
    email: 'z.bibi@campussync.edu.pk',
    address: 'Pine View Heights, Mandian, Abbottabad',
    emergency_contact: 'Kareem Dad (0301-9988770)',
    attendance: 85,
    remarks: 'Active member of university programming competition team',
    field_versions: {
      phone: 1,
      email: 1,
      address: 1,
      emergency_contact: 1,
      attendance: 1,
      remarks: 1,
      semester: 1,
      status: 1
    },
    version: 8,
    active: true,
    created_at: '2026-11-04T08:45:00Z',
    updated_at: '2026-11-07T09:30:00Z',
    last_editor_id: 'faculty_abt_01'
  }
];

export const INITIAL_CONFLICTS: ConflictItem[] = [
  {
    id: 'conf-2026-001',
    studentId: 'e01a8f90-8431-4822-92ab-1101aa000002',
    studentName: 'Fatima Zahra',
    reg_no: 'CS-2026-0102',
    field: 'phone',
    baseVersion: 1,
    serverValue: '0321-4445678',
    serverVersion: 2,
    incomingValue: '0321-9998877',
    actor: 'Student (Fatima Zahra)',
    campus: 'Lahore',
    device: 'Mobile (Safari PWA)',
    status: 'open',
    createdAt: '2026-11-08T09:15:00Z'
  },
  {
    id: 'conf-2026-002',
    studentId: 'e01a8f90-8431-4822-92ab-1101aa000003',
    studentName: 'Hamza Tariq',
    reg_no: 'CS-2026-0103',
    field: 'address',
    baseVersion: 1,
    serverValue: 'House 42, Street 8, Supply Bazaar, Abbottabad',
    serverVersion: 2,
    incomingValue: 'Hostel 3, Room 104, Campus Residency, Abbottabad',
    actor: 'Admin Tariq (Central)',
    campus: 'Abbottabad',
    device: 'Desktop Workstation',
    status: 'open',
    createdAt: '2026-11-08T10:05:00Z'
  }
];

export const INITIAL_HISTORY: HistoryItem[] = [
  {
    id: 1045,
    studentId: 'e01a8f90-8431-4822-92ab-1101aa000001',
    studentName: 'Muhammad Ahmed',
    reg_no: 'CS-2026-0101',
    field: 'attendance',
    oldValue: 84,
    newValue: 88,
    fieldVersionAfter: 2,
    type: 'edit',
    actorName: 'Prof. Tariq Mahmood',
    actorRole: 'faculty',
    actorCampus: 'Islamabad',
    device: 'Faculty Portal',
    opId: 'op-001-att-update',
    createdAt: '2026-11-08T08:30:00Z'
  },
  {
    id: 1044,
    studentId: 'e01a8f90-8431-4822-92ab-1101aa000004',
    studentName: 'Ayesha Malik',
    reg_no: 'CS-2026-0104',
    field: 'status',
    oldValue: 'Active',
    newValue: 'Graduated',
    fieldVersionAfter: 3,
    type: 'edit',
    actorName: 'Saim Sajid (Admin)',
    actorRole: 'admin',
    actorCampus: 'Islamabad',
    device: 'Admin Terminal',
    opId: 'op-002-status-grad',
    createdAt: '2026-11-08T07:45:00Z'
  },
  {
    id: 1043,
    studentId: 'e01a8f90-8431-4822-92ab-1101aa000002',
    studentName: 'Fatima Zahra',
    reg_no: 'CS-2026-0102',
    field: 'address',
    oldValue: 'Old Anarkali, Lahore',
    newValue: 'Flat 402, Al-Rehman Heights, Gulberg III, Lahore',
    fieldVersionAfter: 2,
    type: 'resolve',
    actorName: 'Saim Sajid (Admin)',
    actorRole: 'admin',
    actorCampus: 'Lahore',
    device: 'Central Server',
    opId: 'op-003-conf-resolve',
    createdAt: '2026-11-07T17:10:00Z'
  }
];

export async function initializeSeedData(): Promise<void> {
  const count = await db.students.count();
  if (count === 0) {
    await db.students.bulkAdd(INITIAL_STUDENTS);
    await db.conflicts.bulkAdd(INITIAL_CONFLICTS);
    await db.history.bulkAdd(INITIAL_HISTORY);
    await db.meta.put({ key: 'lastSyncCursor', value: 1045 });
    await db.meta.put({ key: 'lastSyncedAt', value: new Date().toISOString() });
  }
}
