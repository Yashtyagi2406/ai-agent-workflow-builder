import http from 'http';
import fs from 'fs';
import path from 'path';

// Parse root .env if present
try {
  const envPath = path.resolve(process.cwd(), '../../.env');
  const rootEnvPath = path.resolve(process.cwd(), '.env');
  const targetEnv = fs.existsSync(envPath) ? envPath : fs.existsSync(rootEnvPath) ? rootEnvPath : null;
  if (targetEnv) {
    const content = fs.readFileSync(targetEnv, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
      }
    }
  }
} catch {
  // Ignore env read error
}

import triggerWorkflowRun from './triggerWorkflowRun';
import approveStep from './approveStep';
import webhookTrigger from './webhookTrigger';
import scheduledRunner from './scheduledRunner';
import eventTriggerHandler from './eventTriggerHandler';

const PORT = process.env.FUNCTIONS_PORT ? parseInt(process.env.FUNCTIONS_PORT, 10) : 5005;

const routes: Record<string, (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>> = {
  '/triggerWorkflowRun': triggerWorkflowRun,
  '/approveStep': approveStep,
  '/webhookTrigger': webhookTrigger,
  '/scheduledRunner': scheduledRunner,
  '/eventTriggerHandler': eventTriggerHandler,
};

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-hasura-admin-secret, x-hasura-user-id, x-hasura-role');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const handler = routes[urlPath];
  if (handler) {
    try {
      await handler(req, res);
    } catch (err) {
      console.error(`[functions-server] Error on ${urlPath}:`, err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Internal Server Error' }));
      }
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: `Function handler not found for path: ${urlPath}` }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Nhost Functions server running on http://localhost:${PORT}`);
});
