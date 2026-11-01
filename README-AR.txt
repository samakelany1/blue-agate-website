BLUE AGATE — QR CHECK-IN PATCH v3 (TEST BUILD)

Files to upload/replace in the GitHub repository root:
- index.html
- profile.css
- profile.js

New files to add:
- reception.html
- reception.css
- reception.js

IMPORTANT FIRESTORE RULES NOTE:
- firestore-rules-qr.txt is a FULL rules file reconstructed from the rules previously shared for this project, with one targeted change: an authenticated admin may create a member attendance document when its uid and dateKey match the member/document IDs.
- Do NOT paste the whole file blindly if your currently published rules have changed since they were last shared. Compare them first. If they are still exactly the previously shared rules, the targeted change is in members/{userId}/attendance/{attendanceId}.
- This change is necessary because the reception account is an admin, not the member whose attendance is being recorded.

SAFE TEST SEQUENCE:
1. First test in a separate Firebase test project if available. Do not test against real membership balances.
2. Create/confirm one test member and one admin account. The admin needs admins/{ADMIN_UID} with role: "admin".
3. Publish the merged Firestore rules only after comparing them with the currently published rules.
4. Upload the 3 replacement files and 3 new reception files to the repository root.
5. Sign in as the test member and confirm the QR appears on the profile page.
6. Sign in as admin at /reception.html, allow camera permission, and scan the test QR.
7. Confirm members/{MEMBER_UID}/attendance/YYYY-MM-DD is created once and contains matching uid and dateKey.
8. Scan again on the same day: it must say already registered and must not deduct another day.
9. Check the member document: first successful scan initializes 30 basic days and 7 grace absence days, then consumes one basic day, leaving 29 and 7.
10. Test membership inactive, exhausted balance, and a second test date with an absence before using real members.

KNOWN LIMITATIONS — NOT PRODUCTION READY:
- The code reconciles missed days only when the member next checks in; it does not run at midnight. True daily automation needs a trusted scheduled backend.
- Fridays and per-member excludedAbsenceDates are skipped. A global club closure calendar and approved pause workflow are not implemented yet.
- Existing membershipType/startDate/endDate values are not migrated automatically.
- QR contains a static Firebase UID and can be copied. For production, use a short-lived signed QR token or a staff identity verification step.
- Admin member-document updates are allowed by the existing rules. If you want tighter least-privilege rules, the admin dashboard's write operations must be reviewed before restricting fields.
- This is a TEST BUILD. Do not use real balances until end-to-end tests and rule review pass.
