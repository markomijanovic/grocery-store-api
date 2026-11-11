# Business assumptions

The task leaves some behavior unspecified. These choices are explicit and can be revised independently of the storage or HTTP layers.

1. Each account has exactly one role and one assigned node.
2. Employees are read-only, including for their own profile.
3. Managers can manage other managers at the same node and in descendants. There is no additional seniority or administrator role.
4. Account roles are immutable through PATCH. The route selects the type on creation. Password changes/reset are not part of this API.
5. Moving a user requires access to both the original and destination nodes.
6. The organization structure is initialized from the supplied diagram. Node CRUD and branch reorganization are outside the required scope.
7. Managers may delete themselves. Their next request is unauthenticated because the account no longer exists. There is no special last-root-manager safeguard.
8. A requested node must itself be in scope. Asking for an ancestor does not return a silently clipped subset.
9. Out-of-scope resources return the same 404 response as nonexistent resources. Role-level prohibitions return 403 before a target lookup.
10. Lists are flat, have stable ordering and pagination, and include the starting node only once in descendant mode.
11. No public registration, refresh token, logout revocation, email workflow or audit subsystem is implemented. Tokens expire after 15 minutes; deletion is checked immediately by reloading the identity.
12. Failed-login limiting is per process and IP, suitable for this local demo. Reverse-proxy trust is not enabled. Multiple instances would need a deliberately configured shared limiter and trusted proxy policy.
13. Local Docker MongoDB is reachable only on localhost from the host. This environment is for local review, not public deployment.
14. Changing `SEED_PASSWORD` does not reset existing accounts; insert-only seed behavior preserves their current hashes.
15. Demo accounts are identified by canonical email during seeding. Renaming or deleting a fixture account allows its canonical email to be recreated with a new MongoDB-generated ID. Accounts with different emails are retained.
