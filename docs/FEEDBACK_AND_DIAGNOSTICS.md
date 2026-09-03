# Feedback and diagnostics

LoreSight only sends a diagnostic report after a user opens **Settings → Send feedback** and presses **Send feedback**. Reporting is never automatic.

## What is captured

- bounded console warnings/errors, uncaught browser errors, and rejected promises;
- short, explicitly authored lifecycle breadcrumbs;
- error timestamps, bounded messages, and bounded stack traces;
- the app path without query parameters or fragments;
- viewport size, browser language, online status, display mode, theme, and whether a story was loaded.

## What is not captured

- story transcripts or source files;
- commands typed by the player;
- feedback form contents inside the diagnostic attachment;
- passwords, authorization headers, API keys, cookies, or tokens;
- URL query parameters or fragments;
- arbitrary console objects.

Diagnostics live in an in-memory ring buffer of at most 80 entries. They are not written to browser storage. Users can uncheck the attachment before submitting.

## Server contract

`POST /api/feedback` accepts JSON with an allowlisted category, a 10–4,000 character message, optional contact information, an optional diagnostic snapshot, and limited display context. The server validates and redacts the payload again, caps it at 96 KB, and permits five submissions per source address per hour.

Local/private-alpha reports are appended to `.storyframe-data/feedback.jsonl`. Set `STORYFRAME_FEEDBACK_FILE` to use another path. The file is created with owner-only permissions and is excluded from Git. Production deployments should move this contract to an authenticated database or support system, define a retention period, and restrict access to authorized support operators.

Each record has an opaque report ID and receipt timestamp. Authorized operators can retrieve the latest reports from `GET /admin/api/feedback` using the same bearer password as the rest of the admin API. `readFeedbackRecords()` in `server/src/feedback.ts` also provides a bounded, newest-first reader for an admin inbox or export worker.
