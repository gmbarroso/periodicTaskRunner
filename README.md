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
  - Logs task execution and errors using the `winston` library.
- **Modular Design**:
  - Each task is isolated for better maintainability.

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
     DB_USER=your_database_user
     DB_HOST=your_database_host
     DB_NAME=your_database_name
     DB_PASSWORD=your_database_password
     DB_PORT=5432
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

3. Logs will be generated in the `logs/app.log` file and displayed in the console.

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

## Logs

Logs are stored in the `logs/app.log` file and include:
- Task execution details.
- Errors encountered during execution.

## Contributing

Feel free to fork this repository and submit pull requests. Contributions are welcome!

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
