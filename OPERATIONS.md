# Periodic Task Runner Operations Runbook

## Scope

This runbook covers day-to-day operation of `periodicTaskRunner` in Railway with current policy:

- Worker replicas: `1`
- Monitoring source: application logs
- Deferred items: execution-history table, distributed lock, external alert integrations

## Required Runtime Policy

- Keep Railway replicas for this service at exactly `1`.
- Do not increase replicas above `1` without implementing distributed execution control.

## Job Schedule Reference

- `cleanRevokedTokens`: `59 23 * * 5` (weekly, Friday 23:59)
- `cleanBookings`: `0 0 1 1,4,7,10 *` (quarterly, Jan/Apr/Jul/Oct day 1 at 00:00)
- `cleanInactiveBookings`: `0 0 1 1,7 *` (semiannual, Jan/Jul day 1 at 00:00)

## Post-Deploy Checklist (Railway)

1. Open Railway logs for the worker service.
2. Confirm startup includes `job.scheduled` events for all jobs.
3. Confirm hourly `worker.heartbeat` appears.
4. Confirm no `job.failed` appears immediately after startup.

## Regular Health Check

At least once per week:

1. Verify worker service still has `1` replica.
2. Check logs for recent `job.start` and `job.success` entries.
3. Check for any `job.failed` in the same period.

## Log Events to Watch

- `job.scheduled`: scheduling succeeded and includes `nextRun`.
- `job.start`: scheduled execution started.
- `job.success`: execution finished normally.
- `job.failed`: execution failed or returned invalid result.
- `worker.heartbeat`: process is alive.

## Incident Response (When `job.failed` Appears)

1. Capture failure logs.
2. Confirm DB connectivity and required env vars in Railway.
3. Re-check subsequent runs.
4. If failures repeat, treat as active incident and run investigation with higher verbosity (`LOG_LEVEL=debug`).

## Recovery and Closure Criteria

Incident is resolved when:

- At least one subsequent run for the affected job completes with `job.success`.
- No repeated `job.failed` for the same root cause in the next expected run window.

## Triggers to Revisit Deferred Hardening

Implement execution-history records and distributed locking when any of these happen:

- Worker replicas planned to become `>1`.
- Missed cleanup cannot be proven from logs.
- Recurrent failures require historical run analytics.
- Ownership/operations move beyond a single maintainer workflow.
