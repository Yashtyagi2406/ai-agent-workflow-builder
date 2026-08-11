import type { IncomingMessage, ServerResponse } from 'http';
import { verifyOrgMemberByOrgId, AuthError } from './lib/auth';
import { getStepRun, updateStepRun, updateWorkflowRunStatus } from './lib/db';
import { runEngine, getWorkflowStepsFromOrder } from './lib/runEngine';
import type { HasuraActionPayload, WorkflowStep } from './lib/types';

interface ApproveInput {
  step_run_id: string;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405).end('Method Not Allowed');
    return;
  }

  // Parse body (supports both pre-parsed req.body in Nhost Cloud and raw stream)
  let payload: HasuraActionPayload<ApproveInput>;
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

  const { step_run_id } = payload.input;
  const userId = payload.session_variables['x-hasura-user-id'];

  if (!userId) {
    res.writeHead(401).end(JSON.stringify({ message: 'Unauthorized: missing user session' }));
    return;
  }

  try {
    // ── Fetch step_run context ──────────────────────────────────────────────
    const stepRun = await getStepRun(step_run_id);
    if (!stepRun) {
      res.writeHead(404).end(JSON.stringify({ message: 'Step run not found' }));
      return;
    }

    if (stepRun.status !== 'paused_awaiting_approval') {
      res.writeHead(400).end(
        JSON.stringify({ message: `Step is not awaiting approval (current status: ${stepRun.status})` })
      );
      return;
    }

    const orgId = stepRun.workflow_run.workflow.org_id;
    const workflowRunId = stepRun.workflow_run_id;

    // ── Layer 2: Role check in handler (NOT just Hasura permissions) ────────
    // This is the critical enforcement point — the spec explicitly says
    // "this can't be a database permission alone"
    await verifyOrgMemberByOrgId(userId, orgId, ['owner', 'editor']);

    // ── Mark step as approved + succeeded ──────────────────────────────────
    await updateStepRun(step_run_id, {
      status: 'succeeded',
      approved_by: userId,
      approved_at: new Date().toISOString(),
      output: { approved: true, approved_by: userId },
    });

    // ── Resume workflow_run ─────────────────────────────────────────────────
    await updateWorkflowRunStatus(workflowRunId, 'running');

    // ── Continue from the next step ─────────────────────────────────────────
    const nextOrder = stepRun.workflow_step.step_order + 1;
    const remainingSteps = await getWorkflowStepsFromOrder(workflowRunId, nextOrder);

    const finalStatus = await runEngine({
      workflowRunId,
      steps: remainingSteps as WorkflowStep[],
      startFromOrder: nextOrder,
      orgId,
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        step_run_id,
        status: finalStatus,
        message:
          finalStatus === 'paused'
            ? 'Workflow paused at another approval gate'
            : finalStatus === 'completed'
            ? 'Workflow completed after approval'
            : 'Workflow failed after approval',
      })
    );
  } catch (err) {
    if (err instanceof AuthError) {
      res.writeHead(err.statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: err.message }));
    } else {
      console.error('[approveStep] Unexpected error:', err);
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
