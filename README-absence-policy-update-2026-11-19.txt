Blue Agate absence policy update (19 Nov 2026)

Policy implemented in both process-daily-absences.js and scripts/process-daily-absences.js:
- The club does not use attendance check-in as the source of subscription-day deductions.
- Friday and recorded club closure handling remain as in the previous implementation.
- An ordinary scheduled day with no approved absence request deducts one subscription day, regardless of whether the member attended.
- A pending absence request pauses processing from that date onward for that member until an administrator approves or rejects it.
- An approved absence request consumes one base allowance day (up to 7) first, then an administrative extra allowance day, and only after both are exhausted deducts one subscription day.
- A rejected request is treated as an ordinary scheduled day and deducts one subscription day.
- The daily processor marks approved requests as balanceApplied in the same Firestore transaction as the member balance update to prevent duplicate deductions.
- Extra allowance is stored in graceAbsenceExtraDaysRemaining and is not reset when the base monthly cycle renews.

Admin request review:
- Approval no longer reads attendance documents or applies a conflicting same-day-only deduction.
- It marks the request approved; the daily processor applies the allowance/subscription deduction when that date is processed.
- Requests for already-processed dates are rejected to avoid retroactive double accounting.

Member request form:
- Does not use attendance documents to determine whether a date is available.
- The request limit includes the member's extra allowance.

IMPORTANT:
- This package does not migrate or restore existing member balances.
- This package does not yet include the requested admin UI for arbitrary restoration, granting extra days, or archive/restore controls. The extra allowance field is supported by the processing engine, but must be granted through a properly secured admin interface before use.
- Firestore rules and live Firebase behavior have not been deployed or tested. Review rules and test on a separate Firebase project before production deployment.
- Do not upload this package to production until a test project verifies pending/approved/rejected flows, month rollover, extra allowance, club closure, Friday, and idempotency.
