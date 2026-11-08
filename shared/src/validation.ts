import { z } from 'zod';
import type { UserRole, CampusCode, StudentRecord } from './types.js';

export const Campuses = ['Islamabad', 'Lahore', 'Abbottabad'] as const;
export const Programs = ['BS CS', 'BS SE', 'BS EE'] as const;
export const StudentStatuses = ['Active', 'On leave', 'Graduated'] as const;

// Pakistani CNIC: 13 digits, optional hyphens (e.g. 35201-1234567-1 or 3520112345671)
export const CNIC_REGEX = /^\d{5}-?\d{7}-?\d{1}$/;

// Pakistani Mobile: starts with 03, 11 digits total (e.g. 0300-1234567 or 03001234567)
export const PAK_PHONE_REGEX = /^(03\d{2}-?\d{7})$/;

// Reg No: e.g. CS-2026-0147
export const REG_NO_REGEX = /^[A-Z]{2,4}-\d{4}-\d{3,5}$/;

export const StudentSchema = z.object({
  id: z.string().uuid({ message: 'Record ID must be a valid UUID' }),
  reg_no: z.string().regex(REG_NO_REGEX, { message: 'Registration number must match format e.g. CS-2026-0147' }),
  cnic: z.string().regex(CNIC_REGEX, { message: 'CNIC must be 13 digits' }),
  full_name: z.string().min(2, 'Full name must be at least 2 characters').max(80, 'Full name cannot exceed 80 characters'),
  program: z.enum(Programs, { errorMap: () => ({ message: 'Invalid program selection' }) }),
  campus: z.enum(Campuses, { errorMap: () => ({ message: 'Invalid campus selection' }) }),
  semester: z.number().int().min(1, 'Semester must be at least 1').max(8, 'Semester cannot exceed 8'),
  status: z.enum(StudentStatuses, { errorMap: () => ({ message: 'Invalid status' }) }),
  phone: z.string().regex(PAK_PHONE_REGEX, { message: 'Invalid Pakistani mobile number format (e.g. 0300-1234567)' }),
  email: z.string().email('Invalid email address format'),
  address: z.string().min(5, 'Address must be at least 5 characters').max(200, 'Address cannot exceed 200 characters'),
  emergency_contact: z.string().min(3, 'Emergency contact name/phone required').max(100),
  attendance: z.number().min(0, 'Attendance must be between 0 and 100').max(100, 'Attendance must be between 0 and 100'),
  remarks: z.string().max(500, 'Remarks cannot exceed 500 characters').optional().nullable(),
}).refine(
  (data) => {
    // Cross-field rule: if status is Graduated, semester must be 8
    if (data.status === 'Graduated' && data.semester !== 8) {
      return false;
    }
    return true;
  },
  {
    message: 'Graduated students must be in Semester 8',
    path: ['semester'],
  }
);

// Individual field validators for partial edits
export const FieldValidators: Record<string, z.ZodType<any>> = {
  reg_no: z.string().regex(REG_NO_REGEX, 'Format must match CS-2026-0147'),
  cnic: z.string().regex(CNIC_REGEX, 'CNIC must be 13 digits'),
  full_name: z.string().min(2).max(80),
  program: z.enum(Programs),
  campus: z.enum(Campuses),
  semester: z.number().int().min(1).max(8),
  status: z.enum(StudentStatuses),
  phone: z.string().regex(PAK_PHONE_REGEX, 'Must be valid Pakistani mobile (e.g. 0300-1234567)'),
  email: z.string().email('Must be valid email'),
  address: z.string().min(5).max(200),
  emergency_contact: z.string().min(3).max(100),
  attendance: z.number().min(0).max(100),
  remarks: z.string().max(500).optional().nullable(),
};

// Role-based field edit permissions
export const PERSONAL_FIELDS = ['phone', 'email', 'address', 'emergency_contact'] as const;
export const ACADEMIC_FIELDS = ['attendance', 'remarks'] as const;
export const OFFICIAL_FIELDS = ['full_name', 'program', 'campus', 'semester', 'status', 'reg_no', 'cnic'] as const;

export function canUserEditField(
  role: UserRole,
  userCampus: CampusCode | undefined,
  userStudentId: string | undefined,
  field: string,
  targetStudent: StudentRecord
): { allowed: boolean; reason?: string } {
  if (role === 'admin') {
    return { allowed: true };
  }

  if (role === 'faculty') {
    if (userCampus && userCampus !== targetStudent.campus) {
      return { allowed: false, reason: 'Faculty may only edit records on their own campus' };
    }
    if (ACADEMIC_FIELDS.includes(field as any)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Faculty may only edit academic fields (attendance, remarks)' };
  }

  if (role === 'student') {
    if (!userStudentId || userStudentId !== targetStudent.id) {
      return { allowed: false, reason: 'Students can only edit their own record' };
    }
    if (PERSONAL_FIELDS.includes(field as any)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Students may only edit personal contact fields' };
  }

  return { allowed: false, reason: 'Unauthorized role' };
}
