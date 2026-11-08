/**
 * CampusSync Test Plan - Section 26: Security & Negative Injection Suite
 *
 * Verifies SQL injection resistance, XSS safety, IDOR prevention,
 * role authorization barriers, and absence of sensitive server leakage.
 */

const BASE_URL = process.env.TEST_TARGET || 'http://150.136.103.208.sslip.io';

interface TestResult {
  id: string;
  category: string;
  description: string;
  passed: boolean;
  details?: any;
  error?: string;
}

const results: TestResult[] = [];

function record(id: string, category: string, description: string, passed: boolean, details?: any, error?: string) {
  results.push({ id, category, description, passed, details, error });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${id}] ${category}: ${description}`);
  if (!passed && (details || error)) {
    console.error(`   Details:`, details || error);
  }
}

async function login(email: string, password = 'password123'): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  }
  return data.token;
}

async function runSecuritySuite() {
  console.log(`\n======================================================`);
  console.log(`CampusSync Security & Injection Test Suite`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`======================================================\n`);

  const adminToken = await login('admin@campussync.local');
  const facultyToken = await login('faculty@campussync.local'); // Lahore faculty
  const studentToken = await login('student@campussync.local'); // Ali Raza (Lahore student)

  // 1. SE-1: SQL Injection in text fields and push operations
  try {
    const sqliPayload = "'; DROP TABLE students; -- ' OR '1'='1";
    const pushRes = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        operations: [
          {
            opId: 'op-sqli-test-' + Date.now(),
            studentId: '10000000-0000-0000-0000-000000000001',
            field: 'remarks',
            newValue: sqliPayload,
            baseVersion: 1,
            deviceId: 'sqli-tester',
            type: 'edit',
          },
        ],
      }),
    });

    const pushData = await pushRes.json();
    // Verify table students still exists and healthy
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();

    const snapshotRes = await fetch(`${BASE_URL}/sync/snapshot`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const snapData = await snapshotRes.json();
    const targetStudent = snapData.students?.find((s: any) => s.id === '10000000-0000-0000-0000-000000000001');

    record(
      'SE-1',
      'SQL Injection',
      'SQL injection payloads treated purely as data; database and schema unharmed',
      healthRes.ok && healthData.status === 'ok' && targetStudent !== undefined,
      { health: healthData.status, studentFound: Boolean(targetStudent) }
    );
  } catch (err: any) {
    record('SE-1', 'SQL Injection', 'SQL injection test', false, null, err.message);
  }

  // 2. SE-2: XSS payloads in address, remarks, emergency contact
  try {
    const snapRes = await fetch(`${BASE_URL}/sync/snapshot`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const snap = await snapRes.json();
    const s1 = snap.students.find((s: any) => s.id === '10000000-0000-0000-0000-000000000001');
    const currentAddressVersion = s1?.field_versions?.address || 1;

    const xssPayload = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
    const xssOpId = 'op-xss-test-' + Date.now();
    const pushRes = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        operations: [
          {
            opId: xssOpId,
            studentId: '10000000-0000-0000-0000-000000000001',
            field: 'address',
            newValue: 'Street 42, ' + xssPayload,
            baseVersion: currentAddressVersion,
            deviceId: 'xss-tester',
            type: 'edit',
          },
        ],
      }),
    });
    const pushData = await pushRes.json();

    // Pull changes from history
    const historyRes = await fetch(`${BASE_URL}/students/10000000-0000-0000-0000-000000000001/history`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const historyData = await historyRes.json();
    const latestEntry = historyData.history?.find((h: any) => h.opId === xssOpId);

    // Verify stored verbatim without execution
    record(
      'SE-2',
      'XSS Protection',
      'XSS string stored verbatim without executing or mutating HTML contexts',
      latestEntry?.newValue?.includes('<script>'),
      { storedValue: latestEntry?.newValue }
    );
  } catch (err: any) {
    record('SE-2', 'XSS Protection', 'XSS payload storage', false, null, err.message);
  }

  // 3. SE-3 & SE-4: IDOR Prevention
  // Student trying to query history of another student (Islamabad student: 10000000-0000-0000-0000-000000000002)
  try {
    const foreignStudentId = '10000000-0000-0000-0000-000000000002';
    const foreignHistRes = await fetch(`${BASE_URL}/students/${foreignStudentId}/history`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    record(
      'SE-4.1',
      'IDOR Protection',
      'Student forbidden from viewing other student history records (403 Forbidden)',
      foreignHistRes.status === 403,
      { status: foreignHistRes.status }
    );
  } catch (err: any) {
    record('SE-4.1', 'IDOR Protection', 'Student IDOR check', false, null, err.message);
  }

  // Faculty trying to view history of student from a different campus
  try {
    const foreignStudentId = '10000000-0000-0000-0000-000000000005'; // Islamabad student, faculty is Lahore
    const foreignHistRes = await fetch(`${BASE_URL}/students/${foreignStudentId}/history`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });

    record(
      'SE-4.2',
      'IDOR Protection',
      'Faculty forbidden from viewing student history from another campus (403 Forbidden)',
      foreignHistRes.status === 403,
      { status: foreignHistRes.status }
    );
  } catch (err: any) {
    record('SE-4.2', 'IDOR Protection', 'Faculty campus scoping', false, null, err.message);
  }

  // 4. SE-5: Token tampering and forgery protection
  try {
    const tamperedToken = adminToken.substring(0, adminToken.length - 8) + 'badbytes';
    const snapRes = await fetch(`${BASE_URL}/sync/snapshot`, {
      headers: { Authorization: `Bearer ${tamperedToken}` },
    });

    record(
      'SE-5',
      'Authentication',
      'Cryptographically invalid token rejected with 401 Unauthorized',
      snapRes.status === 401,
      { status: snapRes.status }
    );
  } catch (err: any) {
    record('SE-5', 'Authentication', 'Tampered token check', false, null, err.message);
  }

  // 5. SE-7: Information Leakage Check
  try {
    const notFoundRes = await fetch(`${BASE_URL}/non-existent-api-endpoint-test-12345`);
    const notFoundText = await notFoundRes.text();

    const containsStackTrace = notFoundText.includes('at ') || notFoundText.includes('node_modules') || notFoundText.includes('/app/server/');

    record(
      'SE-7',
      'Error Handling',
      'Error responses do not leak internal stack traces or filesystem paths',
      !containsStackTrace && notFoundRes.status === 404,
      { status: notFoundRes.status, body: notFoundText.substring(0, 100) }
    );
  } catch (err: any) {
    record('SE-7', 'Error Handling', 'Stack trace leak check', false, null, err.message);
  }

  // 6. Non-admin forbidden from integrity suite
  try {
    const integRes = await fetch(`${BASE_URL}/admin/integrity`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    record(
      'PM-9',
      'Permissions',
      'Student forbidden from invoking admin integrity suite (403 Forbidden)',
      integRes.status === 403,
      { status: integRes.status }
    );
  } catch (err: any) {
    record('PM-9', 'Permissions', 'Student integrity check access', false, null, err.message);
  }

  // 7. Non-admin forbidden from restoring history
  try {
    const restoreRes = await fetch(`${BASE_URL}/students/10000000-0000-0000-0000-000000000001/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        field: 'phone',
        targetValue: '0300-1112233',
      }),
    });
    record(
      'PM-7',
      'Permissions',
      'Student forbidden from restoring historical values (403 Forbidden)',
      restoreRes.status === 403,
      { status: restoreRes.status }
    );
  } catch (err: any) {
    record('PM-7', 'Permissions', 'Student restore access', false, null, err.message);
  }

  console.log(`\n======================================================`);
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`SECURITY TEST SUMMARY:`);
  console.log(`Total:  ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Rate:   ${((passed / total) * 100).toFixed(1)}%`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSecuritySuite().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
