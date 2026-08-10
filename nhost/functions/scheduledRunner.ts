import type { IncomingMessage, ServerResponse } from 'http';
import { gqlAdmin, createWorkflowRun } from './lib/db';
import { checkQuota } from './lib/auth';
import { runEngine } from './lib/runEngine';
import type { WorkflowStep, WorkflowTrigger } from './lib/types';

// Simple cron expression evaluator — checks if the cron is due within this minute
function isCronDue(cronExpr: string): boolean {
  const [minute, hour, dom, month, dow] = cronExpr.split(' ');
  const now = new Date();
  const matches = (field: string, value: number): boolean => {
    if (field === '*') return true;
    if (field.startsWith('*/')) {
      const step = parseInt(field.slice(2), 10);
      return value % step === 0;
    }
    return parseInt(field, 10) === value;
  };

  return (
    matches(minute, now.getMinutes()) &&
    matches(hour, now.getHours()) &&
    matches(dom, now.getDate()) &&
    matches(month, now.getMonth() + 1) &&
    matches(dow, now.getDay())
  );
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  console.log('[scheduledRunner] Cron trigger fired at', new Date().toISOString());

  try {
    // Find all scheduled workflow triggers
    const data = await gqlAdmin<{
      workflow_triggers: {
        id: string;
        workflow_id: string;
        config: { cron?: string };
        workflow: {
          id: string;
          org_id: string;
          workflow_steps: WorkflowStep[];
        };
      }[];
    }>(
      `query GetScheduledTriggers {
        workflow_triggers(where: { type: { _eq: "scheduled" } }) {
          id workflow_id config
          workflow {
            id org_id
            workflow_steps(order_by: { step_order: asc }) {
              id workflow_id step_order type config
            }
          }
        }
      }`
    );

    const triggers = data.workflow_triggers;
    console.log(`[scheduledRunner] Found ${triggers.length} scheduled triggers`);

    const results: { workflow_id: string; status: string }[] = [];

    for (const trigger of triggers) {
      const cronExpr = trigger.config.cron || '*/5 * * * *';

      if (!isCronDue(cronExpr)) {
        continue;
      }

      try {
        await checkQuota(trigger.workflow.org_id);
        const workflowRunId = await createWorkflowRun(trigger.workflow_id, null, 'scheduled');

        const finalStatus = await runEngine({
          workflowRunId,
          steps: trigger.workflow.workflow_steps,
          startFromOrder: 0,
          orgId: trigger.workflow.org_id,
        });

        results.push({ workflow_id: trigger.workflow_id, status: finalStatus });
      } catch (err) {
        console.error(`[scheduledRunner] Failed to run workflow ${trigger.workflow_id}:`, err);
        results.push({ workflow_id: trigger.workflow_id, status: 'error' });
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ triggered: results.length, results }));
  } catch (err) {
    console.error('[scheduledRunner] Fatal error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Scheduled runner failed' }));
  }
}
