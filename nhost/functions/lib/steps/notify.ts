import type { NotifyConfig, StepExecutionResult } from '../types';

/**
 * Notify step handler.
 * Sends a Slack webhook notification or logs if not configured.
 * Only org owners can add this step type.
 */
export async function executeNotify(
  config: NotifyConfig,
  previousOutput: Record<string, unknown>,
  workflowRunId: string
): Promise<StepExecutionResult> {
  const message = resolveMessage(
    config.message_template || 'Workflow step completed. Run ID: {{runId}}',
    { ...previousOutput, runId: workflowRunId }
  );

  // ── Slack notification ───────────────────────────────────────────────────
  if (config.slack_webhook_url) {
    const payload: Record<string, unknown> = {
      text: message,
    };

    if (config.channel) {
      payload.channel = config.channel;
    }

    const response = await fetch(config.slack_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Slack webhook error ${response.status}: ${err}`);
    }

    return {
      status: 'succeeded',
      output: {
        channel: 'slack',
        message,
        delivered: true,
      },
    };
  }

  // ── Fallback: log to console ─────────────────────────────────────────────
  console.log(`[notify] No Slack webhook URL configured. Message: "${message}"`);
  return {
    status: 'succeeded',
    output: {
      channel: 'console',
      message,
      delivered: false,
      note: 'No slack_webhook_url configured — logged to console',
    },
  };
}

function resolveMessage(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const value = context[key.trim()];
    return value !== undefined ? String(value) : `{{${key}}}`;
  });
}
