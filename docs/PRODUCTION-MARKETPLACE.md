# Shared community marketplace

The shipped GitHub Pages marketplace is a local demo. Uploads, counts, votes,
ratings and reports are stored in localStorage and are editable by the user.
No moderation service receives reports. “Schema passed” is never a malware verdict.
No example popularity numbers are presented as real community statistics.

GitHub Pages cannot accept authenticated writes or keep a database. To launch
shared community features, add a separately hosted API (for example a small
TypeScript service with Postgres and object storage). Keep the static frontend
on Pages. The API is intentionally not represented as already implemented.

## API contract

| Endpoint                            | Purpose                               | Enforcement                                        |
| ----------------------------------- | ------------------------------------- | -------------------------------------------------- |
| GET /v1/macros?category=&q=&cursor= | Approved listings and aggregate stats | Pagination; escape display strings                 |
| POST /v1/macros                     | Upload name and JSON contents         | Auth, 256 KB limit, same strict schema, rate limit |
| GET /v1/macros/:id/download         | Serve approved JSON                   | Object hash verification, count server-side        |
| PUT /v1/macros/:id/vote             | -1, 0 or +1                           | Unique user/listing vote, transactional aggregates |
| PUT /v1/macros/:id/rating           | Integer 1–5                           | Unique user/listing rating                         |
| POST /v1/macros/:id/reports         | Reason plus evidence                  | Auth/rate limit, private moderation queue          |
| DELETE /v1/macros/:id               | Author deletion                       | Ownership; built-in listings cannot be deleted     |

## Storage model

users(id, auth_subject unique, display_name)
macros(id, author_id, name, object_key, sha256, status, created_at)
votes(user_id, macro_id, value, PRIMARY KEY(user_id, macro_id))
ratings(user_id, macro_id, value, PRIMARY KEY(user_id, macro_id))
downloads(id, macro_id, user_id nullable, created_at)
reports(id, reporter_id, macro_id, reason, status, created_at)
reviews(id, macro_id, schema_version, outcome, reviewer_id, created_at)

Set status to pending until server validation and moderation complete. Revalidate
in the app on import: approved JSON may still perform unwanted input. Malware
scanners can inspect file bytes, but they cannot certify benign macro intent.
Never accept JS, Python, DLLs, executable attachments, shell commands, arbitrary
network blocks or hooks. Do not run uploaded files in a privileged process.

Use an OAuth provider with a server-side flow; never ship private API keys or
GitHub write tokens to Pages. Restrict CORS to the exact Pages/custom-domain
origin. Count downloads with rate limits and deduplication; identify exactly what
a count measures. Reports go to moderators rather than becoming public accusations.

Replace the demo's saved/mutate/upload functions with an API client once the
service exists. Change labels from “local” only after writes and aggregates work
across accounts and browsers. Preserve starter IDs and server-side locked status.
