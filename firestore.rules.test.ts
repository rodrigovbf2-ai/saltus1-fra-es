/**
 * Payload-First Security Rule Verification Suite ("Dirty Dozen" Adversarial Payloads)
 * Maps each attack vector from security_spec.md to its expected PERMISSION_DENIED outcome.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'get' | 'list';
  payload: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const dirtyDozenPayloads: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Unit Mutation',
    collectionPath: 'developments/dev_1/units/unit_a',
    operation: 'update',
    payload: { status: 'vendido' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Spoofing',
    collectionPath: 'developments/dev_1',
    operation: 'update',
    payload: { name: 'Spoofed Name', authToken: { email: 'rmcbcc@gmail.com', email_verified: false } },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection (Ghost Field)',
    collectionPath: 'developments/dev_1/units/unit_a',
    operation: 'create',
    payload: { code: 'A1', status: 'disponivel', isFeatured: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Owner Spoofing on Create',
    collectionPath: 'developments/dev_spoof',
    operation: 'create',
    payload: { name: 'Fake', ownerId: 'victim_uid' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Owner Hijack on Update',
    collectionPath: 'developments/dev_1',
    operation: 'update',
    payload: { ownerId: 'attacker_uid' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Invalid Status Enumeration',
    collectionPath: 'developments/dev_1/units/unit_a',
    operation: 'update',
    payload: { status: 'gratis' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Coordinate Out-of-Bounds / Type Poisoning',
    collectionPath: 'developments/dev_1/units/unit_a',
    operation: 'update',
    payload: { x: 999, width: 'wide' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'ID Poisoning',
    collectionPath: 'developments/invalid$id!@#',
    operation: 'create',
    payload: { name: 'Poisoned' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Resource Exhaustion / Payload Bomb',
    collectionPath: 'developments/dev_1/units/unit_a',
    operation: 'update',
    payload: { code: 'A'.repeat(5000) },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Orphaned Unit Write',
    collectionPath: 'developments/nonexistent_dev/units/unit_orphan',
    operation: 'create',
    payload: { developmentId: 'nonexistent_dev', code: 'O1', status: 'disponivel' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'PII Leak Attempt on unitNotes',
    collectionPath: 'developments/dev_1/unitNotes/unit_a',
    operation: 'get',
    payload: {},
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Self-Assigned Admin Escalation',
    collectionPath: 'admins/attacker_uid',
    operation: 'create',
    payload: { email: 'attacker@example.com', role: 'admin' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
