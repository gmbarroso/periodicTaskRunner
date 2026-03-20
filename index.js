require('dotenv').config();
const schedule = require('node-schedule');
const logger = require('./utils/logger');
const { cleanRevokedTokens, cleanBookings, cleanInactiveBookings, pollInboundEmailReplies } = require('./tasks/cleanTasks');

const requiredEnvVars = ['DATABASE_USER', 'DATABASE_HOST', 'DATABASE_NAME', 'DATABASE_PASSWORD', 'DATABASE_PORT'];
const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingEnvVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

function boolFromEnv(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return defaultValue;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

const JOB_DEFINITIONS = [
  {
    name: 'cleanRevokedTokens',
    cron: '59 23 * * 5',
    run: cleanRevokedTokens,
    description: 'Delete expired tokens from revoked_token table',
  },
  {
    name: 'cleanBookings',
    cron: '0 0 1 1,4,7,10 *',
    run: cleanBookings,
    description: 'Set inactive=true for old bookings',
  },
  {
    name: 'cleanInactiveBookings',
    cron: '0 0 1 1,7 *',
    run: cleanInactiveBookings,
    description: 'Delete old inactive bookings',
  },
];

if (boolFromEnv('INBOUND_EMAIL_ENABLED', false)) {
  JOB_DEFINITIONS.push({
    name: 'pollInboundEmailReplies',
    cron: (process.env.INBOUND_EMAIL_POLL_CRON || '*/1 * * * *').trim(),
    run: pollInboundEmailReplies,
    description: 'Ingest resident email replies into app conversations',
  });
}

function logStructured(level, event, payload) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...payload,
  };
  logger[level](JSON.stringify(entry));
}

async function runScheduledJob(jobDefinition) {
  if (jobDefinition._running) {
    logStructured('warn', 'job.skipped_already_running', {
      jobName: jobDefinition.name,
      cron: jobDefinition.cron,
    });
    return;
  }

  jobDefinition._running = true;
  const startedAt = Date.now();
  const runId = `${jobDefinition.name}-${startedAt}`;

  logStructured('info', 'job.start', {
    runId,
    jobName: jobDefinition.name,
    cron: jobDefinition.cron,
    description: jobDefinition.description,
  });

  try {
    const rowCount = await jobDefinition.run();
    const durationMs = Date.now() - startedAt;

    if (rowCount === null) {
      logStructured('error', 'job.failed', {
        runId,
        jobName: jobDefinition.name,
        durationMs,
        reason: 'task returned null',
      });
      return;
    }

    logStructured('info', 'job.success', {
      runId,
      jobName: jobDefinition.name,
      durationMs,
      rowCount,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logStructured('error', 'job.failed', {
      runId,
      jobName: jobDefinition.name,
      durationMs,
      errorMessage: error.message,
      errorStack: error.stack,
    });
  } finally {
    jobDefinition._running = false;
  }
}

JOB_DEFINITIONS.forEach((jobDefinition) => {
  const scheduledJob = schedule.scheduleJob(jobDefinition.cron, async () => {
    await runScheduledJob(jobDefinition);
  });

  if (!scheduledJob) {
    logStructured('error', 'job.schedule_failed', {
      jobName: jobDefinition.name,
      cron: jobDefinition.cron,
      reason: 'invalid cron expression',
    });
    process.exit(1);
  }

  logStructured('info', 'job.scheduled', {
    jobName: jobDefinition.name,
    cron: jobDefinition.cron,
    nextRun: scheduledJob.nextInvocation() ? String(scheduledJob.nextInvocation()) : null,
  });
});

logger.info('Tasks successfully scheduled with enhanced execution logging.');

setInterval(() => {
  logStructured('info', 'worker.heartbeat', {
    pid: process.pid,
    uptimeSeconds: Math.floor(process.uptime()),
  });
}, 60 * 60 * 1000); 
