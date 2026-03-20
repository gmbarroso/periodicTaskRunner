# Periodic Task Runner

This project automates the periodic cleanup of PostgreSQL tables using Node.js. It is designed to run scheduled tasks for cleaning up the `revoked_token` and `booking` tables.

## Features

- **Automated Cleanup**:
  - Cleans the `revoked_token` table weekly (every Friday at 23:59).
  - Marks `booking` records as inactive (soft delete) quarterly (on the first day of January, April, July, and October at 00:00) if they are older than 3 months based on the `startTime` field.
  - Permanently deletes inactive `booking` records every six months (on the first day of January and July at 00:00) if they have been inactive for more than 6 months.
- **Environment Variables**:
  - Uses `.env` for secure configuration of database credentials.
- **Logging**:
  - Logs task scheduling, start, success/failure, duration, affected rows, and heartbeat using the `winston` library.
- **Modular Design**:
  - Each task is isolated for better maintainability.
- **Inbound Contact Reply Sync (optional)**:
  - Polls mailbox replies via IMAP.
  - Forwards thread headers (`In-Reply-To`/`References`) and recipient addresses (`To`, `Delivered-To`, `X-Original-To`) to API `POST /messages/inbound/email`.
  - API resolves thread with strategy 1+2:
    - Header threading first.
    - Signed plus-address reply token fallback (`+grillrent.<token>`).

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- `npm` (Node Package Manager)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd periodicTaskRunner
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Create a `.env` file in the root directory.
   - Add the following variables:
     ```plaintext
     DATABASE_USER=your_database_user
     DATABASE_HOST=your_database_host
     DATABASE_NAME=your_database_name
     DATABASE_PASSWORD=your_database_password
     DATABASE_PORT=5432
     API_BASE_URL=http://localhost:3000
     CONTACT_EMAIL_INBOUND_SECRET=replace_with_strong_random_secret
     ```

   - Optional inbound mailbox sync:
     ```plaintext
     INBOUND_EMAIL_ENABLED=true
     INBOUND_EMAIL_POLL_CRON=*/1 * * * *
     INBOUND_EMAIL_MAX_PER_RUN=20
     INBOUND_EMAIL_UNSEEN_ONLY=true
     INBOUND_EMAIL_IMAP_HOST=imap.gmail.com
     INBOUND_EMAIL_IMAP_PORT=993
     INBOUND_EMAIL_IMAP_SECURE=true
     INBOUND_EMAIL_IMAP_CONNECT_TIMEOUT_MS=30000
     INBOUND_EMAIL_IMAP_SOCKET_TIMEOUT_MS=45000
     INBOUND_EMAIL_IMAP_USER=faleconosco@example.com
     INBOUND_EMAIL_IMAP_PASSWORD=app_password
     INBOUND_EMAIL_IMAP_MAILBOX=INBOX
     ```

4. Ensure the `.env` file is excluded from version control by checking the `.gitignore` file.

## Usage

1. Start the application:
   ```bash
   npm start
   ```

2. The application will:
  - Schedule the cleanup of the `revoked_token` table every Friday at 23:59.
  - Schedule the soft delete of `booking` records quarterly at 00:00 on the first day of January, April, July, and October, based on the `startTime` field.
  - Schedule the permanent deletion of inactive `booking` records every six months at 00:00 on the first day of January and July.
  - If enabled, schedule mailbox polling for inbound contact email replies.

3. Logs will be generated in daily rotated files (`logs/app-YYYY-MM-DD.log`) and displayed in the console.

## Project Structure

```
periodicTaskRunner/
├── tasks/
│   ├── cleanBookings.js           # Task to soft delete booking records
│   ├── cleanRevokedTokens.js      # Task to clean the revoked_token table
│   ├── cleanInactiveBookings.js   # Task to permanently delete inactive booking records
│   ├── cleanTasks.js              # Aggregates all task modules
├── utils/
│   ├── db.js                      # Database connection module
│   ├── logger.js                  # Logging module
├── .env                           # Environment variables (not versioned)
├── .gitignore                     # Git ignore file
├── index.js                       # Main entry point
├── package.json                   # Project metadata and dependencies
└── README.md                      # Project documentation
```

## Dependencies

- [pg](https://www.npmjs.com/package/pg): PostgreSQL client for Node.js.
- [node-schedule](https://www.npmjs.com/package/node-schedule): Cron-like and not-cron-like job scheduling for Node.js.
- [winston](https://www.npmjs.com/package/winston): Logging library for Node.js.
- [dotenv](https://www.npmjs.com/package/dotenv): Loads environment variables from a `.env` file.
- [imapflow](https://www.npmjs.com/package/imapflow): IMAP client for mailbox polling.
- [mailparser](https://www.npmjs.com/package/mailparser): Parses inbound email content/headers.

## Logs

Logs are stored in daily rotated files under `logs/` and include:
- `job.scheduled` with cron and next run details.
- `job.start` and `job.success` with duration and row counts.
- `job.failed` with error details.
- `worker.heartbeat` every hour.

## Multitenancy Status and Next Step

Current inbound email sync is designed for one mailbox configuration from environment variables. This is suitable for one organization or a shared mailbox setup.

For full multitenancy (many clients/mailboxes), the next evolution is:
1. Store mailbox config per organization in the database.
2. Poll per organization, or preferably use provider webhook/push per organization.
3. Process inbound events through a queue with organization-scoped workers/checkpoints.

Summary:
- Works now for one organization (or one shared inbox).
- Not the final architecture for many organization-specific mailboxes.

## Inbound Email Threading Requirements

- API env vars (in `grillrentapi`):
  - `CONTACT_EMAIL_REPLY_TOKEN_SECRET` (required)
  - `CONTACT_EMAIL_REPLY_TOKEN_TTL_HOURS` (required, e.g. `720`)
  - `CONTACT_EMAIL_REPLY_BASE_ADDRESS` (required, mailbox base for tokenized `Reply-To`)
- Mailbox requirement:
  - The reply mailbox used in outbound `Reply-To` must accept plus-addressing aliases, e.g. `faleconosco+grillrent.<token>@domain.com`.

## Rollout Checklist

1. Configure `CONTACT_EMAIL_REPLY_TOKEN_SECRET` and `CONTACT_EMAIL_REPLY_TOKEN_TTL_HOURS` in `grillrentapi`.
2. Ensure outbound contact emails use a reply mailbox that supports plus-addressing.
3. Deploy `grillrentapi` and `periodicTaskRunner` together so the worker forwards the new inbound payload fields.
4. Send a real end-to-end email reply and verify the admin inbox thread is updated in-app.
5. Confirm duplicate inbound provider IDs are deduplicated (no duplicate reply rows).

## Troubleshooting

- `thread_not_found`:
  - Header IDs are unknown and no valid plus-token recipient was found.
  - Check if outbound email had `In-Reply-To`/`References` and tokenized `Reply-To`.
- `invalid_reply_token`:
  - Plus-token missing, tampered, or expired.
  - Verify `CONTACT_EMAIL_REPLY_TOKEN_SECRET` consistency across deployments and TTL value.
- `sender_mismatch`:
  - `fromEmail` does not match resident sender expected by message/thread token.
- `duplicate_external_message`:
  - Inbound provider message ID already ingested; dedupe is working by design.

## Operational Policy (Current Stage)

- Run this service as exactly one replica in Railway.
- Treat this service as singleton until traffic/complexity requires horizontal scale.
- If replicas are increased above `1`, distributed locking or equivalent execution control must be implemented first.

## Deferred Reliability Items

For now, the following are intentionally deferred:
- Persistent execution history table in database.
- External alerting integrations (Slack/email/webhook).
- Distributed lock for multi-replica worker execution.

These should be implemented when the worker is scaled or when logs are no longer enough for incident diagnosis.

## Operations Runbook

- See [`OPERATIONS.md`](./OPERATIONS.md) for Railway checks, failure handling, and revisit triggers.

## Contributing

Feel free to fork this repository and submit pull requests. Contributions are welcome!

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
