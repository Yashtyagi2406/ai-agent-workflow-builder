import type { IncomingMessage, ServerResponse } from 'http';
import { getWorkflowWithOrg, createWorkflowRun, gqlAdmin } from './lib/db';
import { checkQuota, AuthError, QuotaError } from './lib/auth';
import { runEngine } from './lib/runEngine';
import type { WorkflowStep } from './lib/types';

interface WebhookTriggerInput {
  workflow_id: string;
  api_key: string;
  payload?: Record<string, unknown>;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405).end('Method Not Allowed');
    return;
  }

  const body = await readBody(req);
  let input: { input: WebhookTriggerInput };
  try {
    input = JSON.parse(body);
  } catch {
    res.writeHead(400).end(JSON.stringify({ message: 'Invalid JSON' }));
    return;
  }

  const { workflow_id, api_key, payload: webhookPayload } = input.input;

  try {
    // ── Load workflow ───────────────────────────────────────────────────────
    const workflow = await getWorkflowWithOrg(workflow_id);
    if (!workflow) {
      res.writeHead(404).end(JSON.stringify({ message: 'Workflow not found' }));
      return;
    }

    // ── Validate API key from workflow_triggers config ──────────────────────
    const triggerData = await gqlAdmin<{
      workflow_triggers: { id: string; config: { api_key?: string } }[];
    }>(
      `query GetWebhookTrigger($workflow_id: uuid!) {
        workflow_triggers(where: {
          workflow_id: { _eq: $workflow_id },
          type: { _eq: "webhook" }
        }) { id config }
      }`,
      { workflow_id }
    );

    const trigger = triggerData.workflow_triggers[0];
    if (!trigger) {
      res.writeHead(404).end(JSON.stringify({ message: 'No webhook trigger configured for this workflow' }));
      return;
    }

    if (!trigger.config.api_key || trigger.config.api_key !== api_key) {
      res.writeHead(401).end(JSON.stringify({ message: 'Invalid API key' }));
      return;
    }

    // ── Quota check ─────────────────────────────────────────────────────────
    await checkQuota(workflow.org_id);

    // ── Create workflow_run ─────────────────────────────────────────────────
    const workflowRunId = await createWorkflowRun(workflow_id, null, 'webhook');

    // ── Execute steps ───────────────────────────────────────────────────────
    const finalStatus = await runEngine({
      workflowRunId,
      steps: workflow.workflow_steps as WorkflowStep[],
      startFromOrder: 0,
      orgId: workflow.org_id,
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        workflow_run_id: workflowRunId,
        status: finalStatus,
        message: `Webhook triggered run ${finalStatus}`,
      })
    );
  } catch (err) {
    if (err instanceof AuthError) {
      res.writeHead(err.statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: err.message }));
    } else if (err instanceof QuotaError) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: err.message }));
    } else {
      console.error('[webhookTrigger] Error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Internal server error' }));
    }
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
