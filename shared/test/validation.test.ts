import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  StudentSchema,
  FieldValidators,
  canUserEditField,
  type StudentRecord,
} from '../src/index.js';

const mockStudent: StudentRecord = {
  id: '10000000-0000-0000-0000-000000000001',
  reg_no: 'CS-2026-0147',
  cnic: '35201-1234567-1',
  full_name: 'Ayesha Khan',
  program: 'BS CS',
  campus: 'Lahore',
  semester: 4,
  status: 'Active',
  phone: '0300-1234567',
  email: 'ayesha.khan@campussync.local',
  address: 'Model Town, Block C, Lahore',
  emergency_contact: 'Tariq Khan (Father) - 0300-9988776',
  attendance: 92.5,
  remarks: 'Excellent coursework progress.',
  field_versions: {},
  version: 1,
  active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_editor_id: 'Central Admin',
};

describe('Section 4: Field Validation (Zod Schemas)', () => {
  it('VA-1: Registration number validator', () => {
    assert.equal(FieldValidators.reg_no.safeParse('CS-2026-0147').success, true);
    assert.equal(FieldValidators.reg_no.safeParse('SE-2025-9999').success, true);
    assert.equal(FieldValidators.reg_no.safeParse('abc').success, false);
    assert.equal(FieldValidators.reg_no.safeParse("CS-2026-0147' OR '1'='1").success, false);
    assert.equal(FieldValidators.reg_no.safeParse('').success, false);
  });

  it('VA-2: CNIC 13-digit validator', () => {
    assert.equal(FieldValidators.cnic.safeParse('35201-1234567-1').success, true);
    assert.equal(FieldValidators.cnic.safeParse('3520112345671').success, true);
    assert.equal(FieldValidators.cnic.safeParse('12345').success, false); // too short
    assert.equal(FieldValidators.cnic.safeParse('35201-1234567-123').success, false); // too long
    assert.equal(FieldValidators.cnic.safeParse('35201-abcdefg-1').success, false); // letters
  });

  it('VA-3: Full name length 2-80 chars', () => {
    assert.equal(FieldValidators.full_name.safeParse('Ali Raza').success, true);
    assert.equal(FieldValidators.full_name.safeParse('A').success, false);
    assert.equal(FieldValidators.full_name.safeParse('a'.repeat(81)).success, false);
  });

  it('VA-4 & VA-5: Program and Campus fixed choices', () => {
    assert.equal(FieldValidators.program.safeParse('BS CS').success, true);
    assert.equal(FieldValidators.program.safeParse('BS SE').success, true);
    assert.equal(FieldValidators.program.safeParse('BS EE').success, true);
    assert.equal(FieldValidators.program.safeParse('BS IT').success, false);

    assert.equal(FieldValidators.campus.safeParse('Lahore').success, true);
    assert.equal(FieldValidators.campus.safeParse('Islamabad').success, true);
    assert.equal(FieldValidators.campus.safeParse('Abbottabad').success, true);
    assert.equal(FieldValidators.campus.safeParse('Karachi').success, false);
  });

  it('VA-6: Semester range 1 to 8', () => {
    assert.equal(FieldValidators.semester.safeParse(1).success, true);
    assert.equal(FieldValidators.semester.safeParse(8).success, true);
    assert.equal(FieldValidators.semester.safeParse(0).success, false);
    assert.equal(FieldValidators.semester.safeParse(9).success, false);
    assert.equal(FieldValidators.semester.safeParse(4.5).success, false);
  });

  it('VA-8: Pakistani mobile phone format', () => {
    assert.equal(FieldValidators.phone.safeParse('0300-1234567').success, true);
    assert.equal(FieldValidators.phone.safeParse('03331234567').success, true);
    assert.equal(FieldValidators.phone.safeParse('042-3588990').success, false); // landline
    assert.equal(FieldValidators.phone.safeParse('123456').success, false);
  });

  it('VA-9: Email format validation', () => {
    assert.equal(FieldValidators.email.safeParse('student@campussync.local').success, true);
    assert.equal(FieldValidators.email.safeParse('not-an-email').success, false);
    assert.equal(FieldValidators.email.safeParse('@missinguser.com').success, false);
  });

  it('VA-12: Attendance range 0 to 100', () => {
    assert.equal(FieldValidators.attendance.safeParse(0).success, true);
    assert.equal(FieldValidators.attendance.safeParse(100).success, true);
    assert.equal(FieldValidators.attendance.safeParse(85.5).success, true);
    assert.equal(FieldValidators.attendance.safeParse(-5).success, false);
    assert.equal(FieldValidators.attendance.safeParse(105).success, false);
  });

  it('VA-14: Cross-field rule: Graduated students MUST be in Semester 8', () => {
    // Valid graduated student in semester 8
    const validGraduated = {
      ...mockStudent,
      status: 'Graduated' as const,
      semester: 8,
    };
    assert.equal(StudentSchema.safeParse(validGraduated).success, true);

    // Invalid graduated student in semester 6 (MUST FAIL)
    const invalidGraduated = {
      ...mockStudent,
      status: 'Graduated' as const,
      semester: 6,
    };
    const check = StudentSchema.safeParse(invalidGraduated);
    assert.equal(check.success, false);
    if (!check.success) {
      assert.match(check.error.issues[0].message, /Graduated students must be in Semester 8/i);
    }
  });
});

describe('Section 3.2: Server-Side Permission Matrix', () => {
  it('PM-2: Students can only edit personal/contact fields on their own record', () => {
    // Own record personal field -> allowed
    const p1 = canUserEditField('student', undefined, mockStudent.id, 'phone', mockStudent);
    assert.equal(p1.allowed, true);

    const p2 = canUserEditField('student', undefined, mockStudent.id, 'address', mockStudent);
    assert.equal(p2.allowed, true);

    // Other student's record -> denied
    const pOther = canUserEditField('student', undefined, 'different-uuid', 'phone', mockStudent);
    assert.equal(pOther.allowed, false);

    // Student attempting academic field -> denied
    const pAcademic = canUserEditField('student', undefined, mockStudent.id, 'attendance', mockStudent);
    assert.equal(pAcademic.allowed, false);

    // Student attempting official field -> denied
    const pOfficial = canUserEditField('student', undefined, mockStudent.id, 'program', mockStudent);
    assert.equal(pOfficial.allowed, false);
  });

  it('PM-3: Faculty can only edit academic fields on their own campus', () => {
    // Own campus academic field -> allowed
    const f1 = canUserEditField('faculty', 'Lahore', undefined, 'attendance', mockStudent);
    assert.equal(f1.allowed, true);

    const f2 = canUserEditField('faculty', 'Lahore', undefined, 'remarks', mockStudent);
    assert.equal(f2.allowed, true);

    // Different campus student -> denied
    const fDiffCampus = canUserEditField('faculty', 'Islamabad', undefined, 'attendance', mockStudent);
    assert.equal(fDiffCampus.allowed, false);

    // Faculty attempting contact field -> denied
    const fContact = canUserEditField('faculty', 'Lahore', undefined, 'phone', mockStudent);
    assert.equal(fContact.allowed, false);

    // Faculty attempting official field -> denied
    const fOfficial = canUserEditField('faculty', 'Lahore', undefined, 'semester', mockStudent);
    assert.equal(fOfficial.allowed, false);
  });

  it('PM-4 & PM-5: Admins can edit any field across any campus', () => {
    assert.equal(canUserEditField('admin', undefined, undefined, 'phone', mockStudent).allowed, true);
    assert.equal(canUserEditField('admin', undefined, undefined, 'attendance', mockStudent).allowed, true);
    assert.equal(canUserEditField('admin', undefined, undefined, 'program', mockStudent).allowed, true);
    assert.equal(canUserEditField('admin', undefined, undefined, 'status', mockStudent).allowed, true);
    assert.equal(canUserEditField('admin', undefined, undefined, 'reg_no', mockStudent).allowed, true);
  });
});
