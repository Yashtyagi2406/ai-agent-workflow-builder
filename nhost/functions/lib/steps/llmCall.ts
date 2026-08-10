import type { LlmCallConfig, StepExecutionResult } from '../types';

const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'groq';

/**
 * LLM Call step handler.
 * Supports Groq (default) and OpenRouter.
 * If no API key is provided, returns a disclosed stub response with a delay.
 */
export async function executeLlmCall(
  config: LlmCallConfig,
  previousOutput: Record<string, unknown>
): Promise<StepExecutionResult> {
  // Resolve prompt — allow template variables like {{previousOutput.text}}
  const resolvedPrompt = resolveTemplate(config.prompt, previousOutput);

  // ── Stubbed mode ─────────────────────────────────────────────────────────
  if (!LLM_API_KEY) {
    console.warn('[llm_call] No LLM_API_KEY set — using stubbed response (disclosed artificial delay)');
    await sleep(800);
    return {
      status: 'succeeded',
      output: {
        stub: true,
        text: `[STUB] LLM response to: "${resolvedPrompt.slice(0, 60)}..."`,
        model: 'stub-model',
        prompt: resolvedPrompt,
        sentiment: resolvedPrompt.toLowerCase().includes('negative') ? 'negative' : 'positive',
      },
    };
  }

  // ── Real API call ─────────────────────────────────────────────────────────
  const messages = [];
  if (config.system) {
    messages.push({ role: 'system', content: config.system });
  }
  messages.push({ role: 'user', content: resolvedPrompt });

  let apiUrl: string;
  let model: string;
  let authHeader: string;

  if (LLM_PROVIDER === 'openrouter') {
    apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    model = config.model || 'openai/gpt-3.5-turbo';
    authHeader = `Bearer ${LLM_API_KEY}`;
  } else {
    // Default: Groq
    apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    model = config.model || 'llama3-8b-8192';
    authHeader = `Bearer ${LLM_API_KEY}`;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API error ${response.status}: ${err}`);
  }

  const json = await response.json() as {
    choices: { message: { content: string } }[];
    model: string;
    usage: { total_tokens: number };
  };

  const text = json.choices[0]?.message?.content ?? '';

  return {
    status: 'succeeded',
    output: {
      text,
      model: json.model,
      tokens: json.usage?.total_tokens,
      prompt: resolvedPrompt,
      // Basic sentiment extraction for conditional_branch demo
      sentiment: text.toLowerCase().includes('negative') ||
                 text.toLowerCase().includes('fail') ||
                 text.toLowerCase().includes('error')
        ? 'negative'
        : 'positive',
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
