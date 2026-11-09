import type {
  SnapshotResponse,
  PushBatchRequest,
  PushBatchResponse,
  PullResponse,
  IntegritySuiteResponse,
  HistoryItem,
  ConflictItem,
  CurrentUser,
} from '@campussync/shared';

// Uses relative URLs by default (same-origin in Docker/Fastify), or Vite proxy in dev
const API_BASE = '';

export async function fetchCurrentUser(): Promise<{ user: CurrentUser; demoMode?: boolean }> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Not authenticated: ${res.status}`);
  }
  return res.json();
}

export async function fetchServerConfig(): Promise<{ demoMode: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/config`);
    if (res.ok) {
      return res.json();
    }
  } catch (e) {}
  return { demoMode: true };
}

export async function loginUser(email: string, password = 'password123'): Promise<{ user: CurrentUser }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Login failed: ${res.statusText}`);
  }
  return res.json();
}

export async function logoutUser(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => null);
}

export async function fetchSnapshot(): Promise<SnapshotResponse> {
  const res = await fetch(`${API_BASE}/sync/snapshot`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch snapshot: ${res.statusText}`);
  }
  return res.json();
}

export async function pushBatch(payload: PushBatchRequest): Promise<PushBatchResponse> {
  const res = await fetch(`${API_BASE}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Push batch failed: ${res.statusText}`);
  }
  return res.json();
}

export async function pullChanges(cursor: number): Promise<PullResponse> {
  const res = await fetch(`${API_BASE}/sync/pull?since=${cursor}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Pull changes failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchConflicts(): Promise<{ conflicts: ConflictItem[] }> {
  const res = await fetch(`${API_BASE}/conflicts`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch conflicts: ${res.statusText}`);
  }
  return res.json();
}

export async function resolveConflict(
  conflictId: string,
  choice: 'mine' | 'theirs' | 'custom',
  customValue?: any,
  expectedServerVersion?: number
): Promise<any> {
  const res = await fetch(`${API_BASE}/conflicts/${conflictId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ choice, customValue, expectedServerVersion }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Conflict resolution failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchStudentHistory(studentId: string): Promise<{ history: HistoryItem[] }> {
  const res = await fetch(`${API_BASE}/students/${studentId}/history`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch history: ${res.statusText}`);
  }
  return res.json();
}

export async function restoreStudentField(
  studentId: string,
  field: string,
  targetValue: any
): Promise<any> {
  const res = await fetch(`${API_BASE}/students/${studentId}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ field, targetValue }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Restore failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchIntegrityReport(): Promise<IntegritySuiteResponse> {
  const res = await fetch(`${API_BASE}/admin/integrity`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Integrity report failed: ${res.statusText}`);
  }
  return res.json();
}

export async function resetDemoServer(): Promise<any> {
  const res = await fetch(`${API_BASE}/demo/reset`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Demo reset failed: ${res.statusText}`);
  }
  return res.json();
}

export async function injectRemoteConflictServer(studentId?: string, field?: string, newValue?: any): Promise<any> {
  const res = await fetch(`${API_BASE}/demo/inject-edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ studentId, field, newValue }),
  });
  if (!res.ok) {
    throw new Error(`Remote inject failed: ${res.statusText}`);
  }
  return res.json();
}
