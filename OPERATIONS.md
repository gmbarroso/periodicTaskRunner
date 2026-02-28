# Periodic Task Runner Operations Runbook

## Scope

This runbook covers day-to-day operation of `periodicTaskRunner` in Railway with the current policy:

- Worker replicas: `1`
- Monitoring source: application logs
- Deferred items: execution-history table, distributed lock, external alert integrations

## Required Runtime Policy

- Keep Railway replicas for this service at exactly `1`.
- Do not increase replicas above `1` without first implementing distributed execution control.

## Job Schedule Reference

- `cleanRevokedTokens`: `59 23 * * 5` (weekly, Friday 23:59)
- `cleanBookings`: `0 0 1 1,4,7,10 *` (quarterly, Jan/Apr/Jul/Oct day 1 at 00:00)
- `cleanInactiveBookings`: `0 0 1 1,7 *` (semiannual, Jan/Jul day 1 at 00:00)

## Post-Deploy Checklist (Railway)

1. Open Railway logs for the worker service.
2. Confirm startup includes three `job.scheduled` events (one per job).
3. Confirm hourly `worker.heartbeat` appears.
4. Confirm no `job.failed` appears immediately after startup.

## Regular Health Check

At least once per week:

1. Verify worker service still has `1` replica.
2. Check logs for recent:
- `job.start`
- `job.success` with `durationMs` and `rowCount`
3. Check for any `job.failed` in the same period.

## Log Events to Watch

- `job.scheduled`: scheduling succeeded and shows `nextRun`.
- `job.start`: a scheduled execution started.
- `job.success`: execution finished normally.
- `job.failed`: execution failed or returned invalid result.
- `worker.heartbeat`: process is still alive.

## Incident Response (When `job.failed` Appears)

1. Capture failure logs:
- From the `job.failed` entry, record `jobName`, `runId`, and failure fields.
- If `job.failed` contains only `reason: "task returned null"`, also capture the immediately preceding task error entry emitted by `handleTaskError` (contains detailed error message/stack/query).
2. Confirm DB connectivity and environment variables in Railway.
3. Re-check subsequent runs:
- If next run succeeds, keep monitoring.
- If failures repeat, treat as active incident.
4. For repeated failures:
- Temporarily run investigation with higher log verbosity (`LOG_LEVEL=debug`).
- Validate affected SQL directly in DB with safe read queries first.

## Recovery and Closure Criteria

An incident is considered resolved when:

- At least one subsequent run for the affected job completes with `job.success`.
- No repeated `job.failed` for the same root cause in the next expected window.

## Triggers to Revisit Deferred Hardening

Implement execution-history records and distributed lock when any of these happen:

- Worker replicas planned to become `>1`.
- Missed cleanup cannot be proven/explained via logs.
- Recurrent failures require historical run analytics.
- Ownership/operations move beyond a single maintainer flow.
