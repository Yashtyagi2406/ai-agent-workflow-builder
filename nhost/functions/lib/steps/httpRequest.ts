import type { HttpRequestConfig, StepExecutionResult } from '../types';

/**
 * HTTP Request step handler.
 * Makes a generic HTTP call to any external API.
 */
export async function executeHttpRequest(
  config: HttpRequestConfig,
  previousOutput: Record<string, unknown>
): Promise<StepExecutionResult> {
  const url = resolveTemplate(config.url, previousOutput);
  const method = config.method || 'GET';

  let body: string | undefined;
  let resolvedBody: Record<string, unknown> | undefined;

  if (config.body && method !== 'GET') {
    resolvedBody = resolveBodyTemplate(config.body, previousOutput);
    body = JSON.stringify(resolvedBody);
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'AI-Workflow-Builder/1.0',
      ...config.headers,
    },
    body,
  });

  let responseData: unknown;
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    responseData = await response.json();
  } else {
    responseData = await response.text();
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(responseData).slice(0, 200)}`);
  }

  return {
    status: 'succeeded',
    output: {
      status_code: response.status,
      data: responseData,
      url,
      method,
    },
  };
}

function resolveTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const value = path.trim().split('.').reduce((obj: unknown, key: string) => {
      if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[key];
      return undefined;
    }, { previousOutput: context });
    return value !== undefined ? String(value) : `{{${path}}}`;
  });
}

function resolveBodyTemplate(
  body: Record<string, unknown>,
  context: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      result[key] = resolveTemplate(value, context);
    } else {
      result[key] = value;
    }
  }
  return result;
}
