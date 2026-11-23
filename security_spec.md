# Security Specification — Sinaliza Libras Firestore Rules

## 1. Data Invariants
1. Every document under `/users/{userId}/private/account` belongs strictly to `request.auth.uid == userId` and must carry `ownerId == request.auth.uid`.
2. Unauthenticated or unverified users (`request.auth == null` or `email_verified != true`) cannot create, update, or delete any document.
3. Collection `list` queries on `/users/{userId}/private` are unconditionally denied (`allow list: if false`) to prevent enumeration.
4. `ownerId` and `createdAt` are immutable once created; `createdAt` and `updatedAt` must equal `request.time` on create/update respectively.
5. All strings, arrays (`completedModuleIds <= 100`, `practicedSignIds <= 500`, `studyDates <= 366`), maps (`xpByDate <= 366`), and numeric values (`xp` in `0..1000000`, `dailyXpGoal` in `10..500`, `defaultSpeed` in `[0.7, 1, 1.4]`, `defaultAvatar` in `['icaro', 'hosana', 'guga']`) are strictly validated and bounded.
6. Unexpected or shadow fields are rejected via `hasAll` + `hasOnly` on `create` and `affectedKeys().hasOnly(...)` on `update`.

## 2. Adversarial Payloads ("Dirty Dozen")
1. Unauthenticated read (`get /users/u1/private/account`, `auth = null`) -> `PERMISSION_DENIED`.
2. Cross-user read (`get /users/u1/private/account`, `auth.uid = 'u2'`) -> `PERMISSION_DENIED`.
3. Collection list query (`list /users/u1/private`, `auth.uid = 'u1'`) -> `PERMISSION_DENIED`.
4. Unverified email write (`create` with `email_verified = false`) -> `PERMISSION_DENIED`.
5. Identity spoofing (`create` at `/users/u1/private/account` with `ownerId: 'u2'`) -> `PERMISSION_DENIED`.
6. Wrong subcollection doc ID (`create` at `/users/u1/private/other`) -> `PERMISSION_DENIED`.
7. Shadow field injection (`create`/`update` adding `isAdmin: true`) -> `PERMISSION_DENIED`.
8. Invalid path ID (`get /users/invalid$id/private/account`) -> `PERMISSION_DENIED`.
9. Client-forged timestamps (`create` with `createdAt` != `request.time`) -> `PERMISSION_DENIED`.
10. Immutable field mutation (`update` changing `ownerId` or `createdAt`) -> `PERMISSION_DENIED`.
11. Oversized name or negative XP (`userName` of 100 chars or `xp: -50`) -> `PERMISSION_DENIED`.
12. Invalid settings enum (`defaultAvatar: 'unknown'` or `defaultSpeed: 99`) -> `PERMISSION_DENIED`.
