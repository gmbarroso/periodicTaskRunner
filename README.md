# Periodic Task Runner

This project automates periodic cleanup of PostgreSQL tables using Node.js.

## Features

- Cleans the `revoked_token` table weekly (every Friday at 23:59).
- Marks `booking` records as inactive (soft delete) quarterly (first day of January, April, July, and October at 00:00) when older than 3 months based on `startTime`.
- Permanently deletes inactive `booking` records every six months (first day of January and July at 00:00) when inactive for more than 6 months.
- Uses `.env` for secure DB configuration.
- Logs job scheduling, start, success/failure, duration, affected rows, and heartbeat via `winston`.

## Prerequisites

- Node.js (v22 or higher)
- PostgreSQL database
- `npm`

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
   - Create `.env` in the root directory with:
     ```plaintext
     DATABASE_USER=your_database_user
     DATABASE_HOST=your_database_host
     DATABASE_NAME=your_database_name
     DATABASE_PASSWORD=your_database_password
     DATABASE_PORT=5432
     ```

4. Ensure `.env` is excluded from version control.

## Usage

1. Start the application:
   ```bash
   npm start
   ```

2. The application schedules:
   - `cleanRevokedTokens` weekly.
   - `cleanBookings` quarterly.
   - `cleanInactiveBookings` semiannually.

3. Logs are generated in daily rotated files (`logs/app-YYYY-MM-DD.log`) and in console output.

## Project Structure

```text
periodicTaskRunner/
├── tasks/
│   ├── cleanBookings.js
│   ├── cleanRevokedTokens.js
│   ├── cleanInactiveBookings.js
│   └── cleanTasks.js
├── utils/
│   ├── db.js
│   └── logger.js
├── .env
├── .gitignore
├── index.js
├── package.json
└── README.md
```

## Dependencies

- [pg](https://www.npmjs.com/package/pg)
- [node-schedule](https://www.npmjs.com/package/node-schedule)
- [winston](https://www.npmjs.com/package/winston)
- [dotenv](https://www.npmjs.com/package/dotenv)

## Logs

Logs include:

- `job.scheduled`
- `job.start`
- `job.success`
- `job.failed`
- `worker.heartbeat`

## Operational Policy

- Run this service as exactly one replica in Railway.
- If replicas are increased above `1`, implement distributed execution control first.

## Operations Runbook

See [`OPERATIONS.md`](./OPERATIONS.md).
