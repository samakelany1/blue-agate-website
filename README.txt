Blue Agate - Member Requests update

Files:
- index.html: adds "طلباتي" view and Firebase Storage SDK.
- admin.html: adds the admin request-review panel and Firebase Storage SDK.
- requests-member.js: member absence and medical request submission/history.
- requests-admin.js: admin request review, file viewing, and approval/rejection.
- requests.css: styles for both interfaces.
- firestore.rules: complete Firestore rules including requests.
- storage.rules: Firebase Storage rules for private member medical attachments.

Important setup:
1. Replace index.html and admin.html in the project root.
2. Add requests-member.js, requests-admin.js, requests.css to the project root.
3. Replace Firestore Rules with firestore.rules and Publish.
4. In Firebase Console > Storage, create/enable the default bucket, then publish storage.rules.
5. Confirm firebase-config.js contains storageBucket for the same Firebase project.
6. Do not run the daily GitHub Action until request workflows and current daily processor have been reviewed and tested.

Policy:
- Absence requests are notifications; an approved ordinary absence still counts under the absence allowance.
- Approved medical requests add an approved attendancePauseRanges entry to the member. The daily processor applies medical extension for dates when it processes them.
- Medical request date range is limited to 31 days and begins today or later.
- Attachments are JPG, PNG, or PDF, max 5 MB.
