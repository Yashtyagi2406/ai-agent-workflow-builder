import type { ConditionalBranchConfig, StepExecutionResult } from '../types';

/**
 * Conditional Branch step handler.
 * Evaluates a condition against the previous step's output and sets
 * a branch flag in the output. The run engine uses this to decide
 * whether to skip subsequent steps.
 *
 * Config shape:
 * {
 *   condition: "previousOutput.sentiment === 'positive'",
 *   truthy_skip_next: false  // if true, skip the immediately next step when condition is true
 * }
 */
export async function executeConditionalBranch(
  config: ConditionalBranchConfig,
  previousOutput: Record<string, unknown>
): Promise<StepExecutionResult> {
  let conditionResult: boolean;

  try {
    // Safe eval using Function constructor — context-limited to previousOutput
    const evaluator = new Function(
      'previousOutput',
      `"use strict"; return Boolean(${config.condition});`
    );
    conditionResult = evaluator(previousOutput) as boolean;
  } catch (err) {
    throw new Error(
      `conditional_branch: Failed to evaluate condition "${config.condition}": ${String(err)}`
    );
  }

  return {
    status: 'succeeded',
    output: {
      condition: config.condition,
      result: conditionResult,
      branch: conditionResult ? 'true' : 'false',
      skip_next: conditionResult ? (config.truthy_skip_next ?? false) : false,
      previousOutput,
    },
  };
}
