# Phase 2-D3A: Safe, manual cover distribution draft

## Scope

This is the **first bounded slice** of 2-D3, not full production approval.

- A date-specific local cover draft; only valid Sunday–Thursday calendar dates.
- Absent teacher roster per date, and manual selection of one substitute per missed lesson.
- A substitute is offered only if the absent teacher's and substitute's day schedules are explicitly verified complete, the substitute is not absent, is not busy with an original lesson, and is not already assigned in the same period.
- Candidate ordering is a **transparent, advisory** least-existing-valid-draft-assignments count. It is not a contractual workload balance or an automatic allocation.
- A duplicate cover for the same lesson is blocked. Deleting an assignment is supported.
- Any changes to absence or teacher schedule invalidate existing drafts for review instead of silently treating them as valid.
- Drafts persist only in browser localStorage; no official confirmation, messages, exports, quota changes, or integration with school attendance. A local draft is **not a record of completed substitution**.

## Non-goals and acceptance gate

- The actual school's Excel schedule template has **not** been supplied or tested. This gate remains blocking for production-grade automatic assignment.
- School-specific allocation rules (teacher exemptions, period limits, departmental preference, daily/weekly balances, authority and approvals) have not been approved. They must not be guessed.
- This phase does not implement automated allocation, actual duty balances, WhatsApp, or school-wide multi-user sync.
- Existing 2-D2 verified-day gate remains mandatory.
- Unit tests for dates, busy/absent exclusion, duplicates, persistence, and stale drafts, plus browser E2E desktop/phone and CI, must pass before merge.
