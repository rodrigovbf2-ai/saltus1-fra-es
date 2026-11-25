# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **Parent Integrity**: A `Unit`, `UnitPrivateNote`, or `ActivityLog` cannot exist without an existing parent `Development` document at `/developments/{developmentId}` matching `developmentId`.
2. **Identity Integrity**: On creation, `ownerId` (or `actorUid`) MUST equal `request.auth.uid`, and `request.auth.token.email_verified == true`. On update, `ownerId` and `createdAt` are immutable.
3. **Temporal Integrity**: `createdAt` on create and `updatedAt` on create/update MUST equal `request.time`.
4. **PII Isolation**: Buyer name, phone/email contact, and internal reservation notes live exclusively in `/developments/{developmentId}/unitNotes/{unitId}`, readable and writable ONLY by verified admins or the development owner. Public catalog reads on `/developments` and `/units` contain zero PII.
5. **Status State Constraints**: `Unit.status` MUST strictly be one of `'disponivel'`, `'reservado'`, `'vendido'`. Coordinates (`x`, `y`, `width`, `height`) are bounded within `0..100` (and `width >= 2`, `height >= 2`).
6. **Privilege Escalation Prevention**: Users cannot write to `/admins/{userId}` from client SDKs unless already a verified super-admin.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Unit Mutation**: Unauthenticated client updates `Unit.status` to `'vendido'` -> **DENIED**.
2. **Unverified Email Spoofing**: Signed-in user with `email: "rmcbcc@gmail.com"` and `email_verified: false` tries to update a development -> **DENIED**.
3. **Shadow Field Injection (Ghost Field)**: Admin/Owner creates a `Unit` with extra field `isFeatured: true` -> **DENIED** by `hasOnly`.
4. **Owner Spoofing on Create**: Signed-in user creates a `Development` with `ownerId: "victim-uid"` -> **DENIED**.
5. **Owner Hijack on Update**: Owner tries to include `ownerId` in `affectedKeys()` during update -> **DENIED**.
6. **Invalid Status Enumeration**: Admin attempts `status: "gratis"` or `status: 123` -> **DENIED**.
7. **Coordinate Out-of-Bounds / Type Poisoning**: Admin sets `x: 999` or `width: "wide"` -> **DENIED**.
8. **ID Poisoning**: Client writes to `/developments/invalid$id!@#` or a 2KB document ID -> **DENIED** by `isValidId`.
9. **Resource Exhaustion / Payload Bomb**: Client writes a 2MB string into `code` or `floorPlanUrl` -> **DENIED** by `.size()` bounds.
10. **Orphaned Unit Write**: Client creates a `Unit` under a non-existent `developmentId` -> **DENIED** by `exists(parent)`.
11. **PII Leak Attempt**: Unauthenticated or non-owner user attempts `get` or `list` on `/developments/{id}/unitNotes` -> **DENIED**.
12. **Self-Assigned Admin Escalation**: Non-admin user writes `/admins/{ownUid}` with `role: "admin"` -> **DENIED**.

## 3. Red Team Audit Checklist
- Global safety net `match /{document=**} { allow read, write: if false; }` present.
- No `request.resource` usage inside `get`, `list`, or `delete` rules.
- Every string field enforces `.size()` limits.
- Every `allow list` rule evaluates `resource.data` explicitly (or `isAdmin()` / owner checks).
- Every `update` rule begins with `isValid[Entity](incoming())` and enforces `affectedKeys().hasOnly(...)` + immutable `createdAt`/`ownerId`.
