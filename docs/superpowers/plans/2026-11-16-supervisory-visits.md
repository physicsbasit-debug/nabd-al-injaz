# Supervisory Visits Implementation Plan

**Goal:** Provide a practical locally stored supervisory visit record, optionally linked to one original plan activity, with evidence protected by the full backup.

**Architecture:** Keep visit records separate from plan activities and reference their IDs without changing plan progress. Store visit evidence in its own browser database. Extend existing locked backup validation and rollback, preserving visit data when restoring older backups.

**Constraints:** Arabic RTL and mobile compatibility; no invented staff or school data; no automatic official judgments; no loss of existing plans, files or old backups; same GitHub Pages deployment.

## Tasks

- [x] Add tested visit validation and evidence archive functions, including corrupt-data rejection.
- [x] Add the supervisory visits interface, optional plan link, safe record editing and evidence handling.
- [x] Include records and files in full backups, reject incomplete archives, preserve visits on legacy restore, and roll back on failure.
- [ ] Exercise the new workflow and backups in desktop and phone browser tests; run all required checks before publication.

## Review focus

- Deleted or archived linked activities must not delete visit records or evidence.
- An old backup must not erase visit records or files it never contained.
- A partial or corrupted backup must be rejected before overwriting local data.
- A failed restore must roll back visits and their files alongside existing data.
- Concurrent editing or file deletion must not silently lose visit data.
