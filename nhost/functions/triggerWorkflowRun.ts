import type { IncomingMessage, ServerResponse } from 'http';
import { verifyOrgMember, checkQuota, AuthError, QuotaError } from './lib/auth';
import { getWorkflowWithOrg, createWorkflowRun } from './lib/db';
import { runEngine } from './lib/runEngine';
import type { HasuraActionPayload, WorkflowStep } from './lib/types';

interface TriggerInput {
  workflow_id: string;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405).end('Method Not Allowed');
    return;
  }

  // Parse body (supports both pre-parsed req.body in Nhost Cloud and raw stream)
  let payload: HasuraActionPayload<TriggerInput>;
  try {
    const reqAny = req as any;
    if (reqAny.body) {
      payload = typeof reqAny.body === 'string' ? JSON.parse(reqAny.body) : reqAny.body;
    } else {
      const raw = await readBody(req);
      payload = JSON.parse(raw);
    }
  } catch {
    res.writeHead(400).end(JSON.stringify({ message: 'Invalid JSON' }));
    return;
  }

  const { workflow_id } = payload.input;
  const userId = payload.session_variables['x-hasura-user-id'];

  if (!userId) {
    res.writeHead(401).end(JSON.stringify({ message: 'Unauthorized: missing user session' }));
    return;
  }

  try {
    // ── Layer 1: Org membership + role check ────────────────────────────────
    const { orgId } = await verifyOrgMember(userId, workflow_id, ['owner', 'editor']);

    // ── Quota check ─────────────────────────────────────────────────────────
    await checkQuota(orgId);

    // ── Load workflow + steps ───────────────────────────────────────────────
    const workflow = await getWorkflowWithOrg(workflow_id);
    if (!workflow) {
      throw new AuthError('Workflow not found', 404);
    }

    // ── Create workflow_run ─────────────────────────────────────────────────
    const workflowRunId = await createWorkflowRun(workflow_id, userId, 'manual');

    // ── Execute steps (async — returns after pausing or completing) ─────────
    const finalStatus = await runEngine({
      workflowRunId,
      steps: workflow.workflow_steps as WorkflowStep[],
      startFromOrder: 0,
      orgId,
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        workflow_run_id: workflowRunId,
        status: finalStatus,
        message:
          finalStatus === 'paused'
            ? 'Workflow paused at approval gate'
            : finalStatus === 'completed'
            ? 'Workflow completed successfully'
            : 'Workflow run failed',
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
      console.error('[triggerWorkflowRun] Unexpected error:', err);
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
