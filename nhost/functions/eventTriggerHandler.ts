import type { IncomingMessage, ServerResponse } from 'http';
import { gqlAdmin, createWorkflowRun } from './lib/db';
import { checkQuota } from './lib/auth';
import { runEngine } from './lib/runEngine';
import type { WorkflowStep } from './lib/types';

interface HasuraEventPayload {
  event: {
    op: 'INSERT' | 'UPDATE' | 'DELETE' | 'MANUAL';
    data: {
      old: Record<string, unknown> | null;
      new: Record<string, unknown> | null;
    };
  };
  table: { schema: string; name: string };
  trigger: { name: string };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405).end('Method Not Allowed');
    return;
  }

  const body = await readBody(req);
  let event: HasuraEventPayload;
  try {
    event = JSON.parse(body);
  } catch {
    res.writeHead(400).end(JSON.stringify({ message: 'Invalid JSON' }));
    return;
  }

  console.log('[eventTrigger] Received event from table:', event.table.name, 'op:', event.event.op);

  try {
    // Find workflow_triggers with type=database_event that watch this table
    const data = await gqlAdmin<{
      workflow_triggers: {
        id: string;
        workflow_id: string;
        config: { watched_table?: string; watched_op?: string };
        workflow: {
          id: string;
          org_id: string;
          workflow_steps: WorkflowStep[];
        };
      }[];
    }>(
      `query GetDatabaseEventTriggers {
        workflow_triggers(where: { type: { _eq: "database_event" } }) {
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

    const tableName = `${event.table.schema}.${event.table.name}`;
    const matchingTriggers = data.workflow_triggers.filter((t) => {
      const watchedTable = t.config.watched_table;
      const watchedOp = t.config.watched_op;
      return (
        (!watchedTable || watchedTable === tableName) &&
        (!watchedOp || watchedOp === event.event.op)
      );
    });

    console.log(`[eventTrigger] Matched ${matchingTriggers.length} workflow triggers`);

    for (const trigger of matchingTriggers) {
      try {
        await checkQuota(trigger.workflow.org_id);
        const workflowRunId = await createWorkflowRun(trigger.workflow_id, null, 'database_event');

        await runEngine({
          workflowRunId,
          steps: trigger.workflow.workflow_steps,
          startFromOrder: 0,
          orgId: trigger.workflow.org_id,
        });
      } catch (err) {
        console.error(`[eventTrigger] Failed to run workflow ${trigger.workflow_id}:`, err);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ processed: matchingTriggers.length }));
  } catch (err) {
    console.error('[eventTrigger] Fatal error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Event trigger handler failed' }));
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}
