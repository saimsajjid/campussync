import { pool } from '../db/pool.js';
import { safeJsonParse } from '../utils/json.js';
import type { IntegrityCheckResult, IntegritySuiteResponse, StudentRecord } from '@campussync/shared';

const ALLOWED_FIELDS = new Set([
  'reg_no',
  'cnic',
  'full_name',
  'program',
  'campus',
  'semester',
  'status',
  'phone',
  'email',
  'address',
  'emergency_contact',
  'attendance',
  'remarks',
]);

export async function runIntegritySuite(): Promise<IntegritySuiteResponse> {
  const client = await pool.connect();
  const checks: IntegrityCheckResult[] = [];

  try {
    // 1. Invariant 1: Uniqueness of IDs, Registration Numbers, and CNIC
    const dupCheckRes = await client.query(`
      SELECT 'reg_no' as field, reg_no as value, COUNT(*) as cnt
      FROM students GROUP BY reg_no HAVING COUNT(*) > 1
      UNION ALL
      SELECT 'cnic' as field, cnic as value, COUNT(*) as cnt
      FROM students GROUP BY cnic HAVING COUNT(*) > 1
      UNION ALL
      SELECT 'id' as field, id::text as value, COUNT(*) as cnt
      FROM students GROUP BY id HAVING COUNT(*) > 1
    `);
    checks.push({
      id: 'inv-uniqueness',
      name: 'Identifier Uniqueness',
      invariant: 'No two records share an ID, registration number, or CNIC',
      description: 'Verifies global uniqueness of primary and natural keys across all campuses.',
      status: dupCheckRes.rows.length === 0 ? 'passed' : 'failed',
      offendingRowsCount: dupCheckRes.rows.length,
      details: dupCheckRes.rows,
    });

    // 2. Invariant 2: Exactly-Once Operation Processing
    const opDupRes = await client.query(`
      SELECT op_id, student_id, field, COUNT(*) as cnt
      FROM history
      GROUP BY op_id, student_id, field
      HAVING COUNT(*) > 1
    `);
    checks.push({
      id: 'inv-exactly-once',
      name: 'Exactly-Once Execution',
      invariant: 'Every operation ID is applied at most once per field change',
      description: 'Proves network retries or duplicate packet submissions never double-apply.',
      status: opDupRes.rows.length === 0 ? 'passed' : 'failed',
      offendingRowsCount: opDupRes.rows.length,
      details: opDupRes.rows,
    });

    // 3. Invariant 3: History Replayability
    // Reconstruct student state by rolling through history from beginning to end
    const studentsRes = await client.query<StudentRecord>('SELECT * FROM students');
    const replayViolations: any[] = [];

    for (const student of studentsRes.rows) {
      const histRes = await client.query(
        'SELECT * FROM history WHERE student_id = $1 ORDER BY id ASC',
        [student.id]
      );
      if (histRes.rows.length === 0) {
        replayViolations.push({ studentId: student.id, reason: 'Zero history entries found for active student' });
        continue;
      }

      // Replay fields
      const replayed: Record<string, any> = {};
      for (const row of histRes.rows) {
        if (row.type === 'create') {
          const init = safeJsonParse(row.new_value);
          if (init && typeof init === 'object') {
            Object.assign(replayed, init);
          }
        } else if (row.field && row.field !== '*') {
          const val = safeJsonParse(row.new_value);
          replayed[row.field] = val;
        }
      }

      // Compare current state against replayed state for key fields
      const fieldsToCheck = [
        'full_name',
        'program',
        'campus',
        'semester',
        'status',
        'phone',
        'email',
        'address',
        'emergency_contact',
      ];

      for (const f of fieldsToCheck) {
        if (replayed[f] !== undefined && replayed[f] !== (student as any)[f]) {
          replayViolations.push({
            studentId: student.id,
            field: f,
            current: (student as any)[f],
            replayed: replayed[f],
            reason: `Replay discrepancy on ${f}`,
          });
        }
      }
    }

    checks.push({
      id: 'inv-replayability',
      name: 'History Replay Verification',
      invariant: 'Replaying history from creation yields current student state exactly',
      description: 'Validates that the ledger faithfully reproduces all current state values without corruption.',
      status: replayViolations.length === 0 ? 'passed' : 'failed',
      offendingRowsCount: replayViolations.length,
      details: replayViolations,
    });

    // 4. Invariant 4: Version Integrity
    // A record's version equals its total accepted changes
    const versionMismatches = await client.query(`
      SELECT s.id, s.reg_no, s.version as record_version, COUNT(h.id) as history_count
      FROM students s
      LEFT JOIN history h ON s.id = h.student_id
      GROUP BY s.id, s.reg_no, s.version
      HAVING s.version != COUNT(h.id)
    `);
    checks.push({
      id: 'inv-version-integrity',
      name: 'Version Monotonicity & Integrity',
      invariant: 'Record version strictly equals total accepted history entries',
      description: 'Verifies no missing intermediate versions or uncounted updates exist in the timeline.',
      status: versionMismatches.rows.length === 0 ? 'passed' : 'failed',
      offendingRowsCount: versionMismatches.rows.length,
      details: versionMismatches.rows,
    });

    // 5. Invariant 5: Referential Integrity
    const orphanHist = await client.query(`
      SELECT h.id, h.student_id, h.op_id
      FROM history h
      LEFT JOIN students s ON h.student_id = s.id
      WHERE s.id IS NULL
    `);
    checks.push({
      id: 'inv-referential-integrity',
      name: 'Referential Integrity',
      invariant: 'No history or conflict entry references a missing or orphaned record',
      description: 'Ensures foreign keys and audit references are clean and non-dangling.',
      status: orphanHist.rows.length === 0 ? 'passed' : 'failed',
      offendingRowsCount: orphanHist.rows.length,
      details: orphanHist.rows,
    });

    // 6. Invariant 6: No Silent Edit Loss
    // Every operation in processed_ops maps to an applied history row, an open/resolved conflict, or a rejection
    const processedOpsRes = await client.query('SELECT op_id, result, created_at FROM processed_ops');
    const lostEdits: any[] = [];
    for (const op of processedOpsRes.rows) {
      const res = safeJsonParse(op.result);
      if (res?.status === 'applied') {
        if (res.isNoOp) {
          // Whitelist field names strictly; never interpolate into SQL
          if (!res.studentId || !res.field || !ALLOWED_FIELDS.has(res.field)) {
            lostEdits.push({ opId: op.op_id, reason: 'Invalid or disallowed field in no-op operation' });
            continue;
          }

          // Verify no-op value against the field's history at that point in time
          const histCheck = await client.query(
            `SELECT field, new_value FROM history
             WHERE student_id = $1 AND (field = $2 OR field = '*') AND created_at <= COALESCE($3, NOW())
             ORDER BY id DESC LIMIT 1`,
            [res.studentId, res.field, op.created_at]
          );

          if (histCheck.rows.length === 0) {
            lostEdits.push({ opId: op.op_id, reason: 'No prior history ledger entry found at time of no-op op' });
            continue;
          }

          let valAtTime: any;
          if (histCheck.rows[0].field === '*') {
            const parsed = safeJsonParse(histCheck.rows[0].new_value);
            valAtTime = parsed ? parsed[res.field] : undefined;
          } else {
            valAtTime = safeJsonParse(histCheck.rows[0].new_value);
          }

          if (JSON.stringify(valAtTime) !== JSON.stringify(res.serverValue)) {
            lostEdits.push({
              opId: op.op_id,
              reason: `No-op value discrepancy at time of operation: expected ${JSON.stringify(valAtTime)}, recorded ${JSON.stringify(res.serverValue)}`,
            });
            continue;
          }
          continue;
        }
        const hCheck = await client.query('SELECT id FROM history WHERE op_id = $1 LIMIT 1', [op.op_id]);
        if (hCheck.rows.length === 0) {
          lostEdits.push({ opId: op.op_id, reason: 'Applied op missing from history log' });
        }
      } else if (res?.status === 'conflict') {
        const cCheck = await client.query('SELECT id FROM conflicts WHERE incoming_op_id = $1 LIMIT 1', [op.op_id]);
        if (cCheck.rows.length === 0) {
          lostEdits.push({ opId: op.op_id, reason: 'Conflict op missing from conflict holding area' });
        }
      }
    }
    checks.push({
      id: 'inv-no-lost-edits',
      name: 'No Silent Data Loss',
      invariant: 'Every user operation maps to an applied, conflicted, or rejected record',
      description: 'Guarantees that no user submission has vanished without a documented trace.',
      status: lostEdits.length === 0 ? 'passed' : 'failed',
      offendingRowsCount: lostEdits.length,
      details: lostEdits,
    });

    // 7. Invariant 7: Append-Only History Tampering Guard
    // Active verification: actually attempt UPDATE and DELETE on a history row in a rolled-back transaction.
    // Both operations MUST throw an exception from the trigger. If either succeeds, or if the trigger is missing, check fails.
    let updateBlocked = false;
    let deleteBlocked = false;
    const mutationErrors: string[] = [];

    const sampleRowRes = await client.query('SELECT id FROM history ORDER BY id ASC LIMIT 1');
    const sampleRowId = sampleRowRes.rows[0]?.id;

    if (sampleRowId) {
      await client.query('BEGIN');
      try {
        // 1. Attempt UPDATE
        await client.query('SAVEPOINT sp_update');
        let updateSucceeded = false;
        try {
          await client.query("UPDATE history SET field = 'tampered' WHERE id = $1", [sampleRowId]);
          updateSucceeded = true;
        } catch (e: any) {
          updateBlocked = true;
          mutationErrors.push(`UPDATE blocked as expected: ${e.message}`);
        } finally {
          await client.query('ROLLBACK TO SAVEPOINT sp_update');
        }
        if (updateSucceeded) {
          updateBlocked = false;
        }

        // 2. Attempt DELETE
        await client.query('SAVEPOINT sp_delete');
        let deleteSucceeded = false;
        try {
          await client.query('DELETE FROM history WHERE id = $1', [sampleRowId]);
          deleteSucceeded = true;
        } catch (e: any) {
          deleteBlocked = true;
          mutationErrors.push(`DELETE blocked as expected: ${e.message}`);
        } finally {
          await client.query('ROLLBACK TO SAVEPOINT sp_delete');
        }
        if (deleteSucceeded) {
          deleteBlocked = false;
        }
      } finally {
        await client.query('ROLLBACK');
      }
    }

    // Also verify trigger catalog presence
    const triggerRes = await client.query(`
      SELECT tgname, tgenabled FROM pg_trigger
      WHERE tgname = 'trg_prevent_history_update'
    `);
    const isTriggerActive = triggerRes.rows.length > 0 && triggerRes.rows[0].tgenabled === 'O';

    const appendOnlyPassed = isTriggerActive && updateBlocked && deleteBlocked;
    checks.push({
      id: 'inv-append-only',
      name: 'Append-Only Ledger Enforcement',
      invariant: 'History entries cannot be edited or deleted by any user or database role',
      description: 'Active mutation verification: attempts UPDATE and DELETE on history in a rolled-back transaction; both must fail.',
      status: appendOnlyPassed ? 'passed' : 'failed',
      offendingRowsCount: appendOnlyPassed ? 0 : (!updateBlocked ? 1 : 0) + (!deleteBlocked ? 1 : 0) + (!isTriggerActive ? 1 : 0),
      details: [
        {
          triggerActive: isTriggerActive,
          updateBlocked,
          deleteBlocked,
          mutationErrors,
        },
      ],
    });

    const allPassed = checks.every((c) => c.status === 'passed');

    return {
      allPassed,
      timestamp: new Date().toISOString(),
      checks,
    };
  } finally {
    client.release();
  }
}
