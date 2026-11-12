# Local Aula authorization check

Run `bash scripts/aula-security-check/run.sh` with PostgreSQL's `initdb`,
`pg_ctl` and `psql` installed (or set `PG_BIN` to their directory). The runner
creates a disposable local cluster, disables TCP listening, applies the original
Aula migrations and the scope-integrity migration twice, then checks real
database roles and synthetic JWT subjects. It does not accept a remote database
URL or use application credentials.

Verified locally on 12 November 2026 with PostgreSQL 17.11: the transaction-wrapped
migration applied twice and all nine assertion groups passed (runner exit status
0).

The assertions cover anonymous reads/writes, both directions of cohort search
isolation, attachment filename joins, hidden malformed legacy metadata, direct
self-join denial, valid member edits/replies/uploads, immutable message/channel
cohorts, parent/channel cohort consistency, and mutation denial after departure.
Expected write failures must have the expected authorization or check-constraint
SQLSTATE; unrelated SQL errors fail the run. Final owner reads verify that denied
writes did not change the fixtures. Fixture-only grants model the normal
Supabase table permissions; the new migration grants no permissions.
Service-role maintenance still bypasses membership RLS for valid reads, edits
and attachment inserts, while the same cohort-integrity triggers continue to
apply. The migration adds distinct scope triggers and preserves the original
fill/channel-validation functions and triggers.

These results establish behavior for the versioned policies in an isolated
database. They do not establish that production has the same policy catalog or
that a signed-in production session has been tested across cohorts. Existing
malformed attachment rows are hidden from members, retained for an authorized
administrator to review, and never automatically rewritten or deleted.

Cohort membership still follows the account's self-declared programme, year and
study mode through the existing profile trigger. It is not independently
verified university enrollment. The historical SECURITY DEFINER
`ensure_cohort_for_profile(uuid)` function also has no caller-identity guard in
the existing migrations; it derives enrollment from the selected account's own
profile rather than accepting a cohort ID. That separate RPC access contract is
outside this scope-integrity migration.
