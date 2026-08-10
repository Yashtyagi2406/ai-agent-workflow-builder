import { getWorkflowWithOrg, getOrgMember, getOrganization } from './db';
import type { OrgRole } from './types';

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

export class QuotaError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = 'QuotaError';
    this.statusCode = 429;
  }
}

/**
 * Verify that `userId` is a member of the org that owns `workflowId`
 * with at least the minimum required role.
 * Returns { role, orgId } on success, throws AuthError on failure.
 */
export async function verifyOrgMember(
  userId: string,
  workflowId: string,
  minRoles: OrgRole[] = ['owner', 'editor']
): Promise<{ role: OrgRole; orgId: string }> {
  const workflow = await getWorkflowWithOrg(workflowId);
  if (!workflow) {
    throw new AuthError('Workflow not found', 404);
  }

  const member = await getOrgMember(workflow.org_id, userId);
  if (!member) {
    throw new AuthError('You are not a member of this organization');
  }

  if (!minRoles.includes(member.role as OrgRole)) {
    throw new AuthError(
      `Insufficient permissions. Required: ${minRoles.join(' or ')}. Your role: ${member.role}`
    );
  }

  return { role: member.role as OrgRole, orgId: workflow.org_id };
}

/**
 * Verify org membership by orgId directly (used in approveStep and webhookTrigger)
 */
export async function verifyOrgMemberByOrgId(
  userId: string,
  orgId: string,
  minRoles: OrgRole[] = ['owner', 'editor']
): Promise<{ role: OrgRole }> {
  const member = await getOrgMember(orgId, userId);
  if (!member) {
    throw new AuthError('You are not a member of this organization');
  }

  if (!minRoles.includes(member.role as OrgRole)) {
    throw new AuthError(
      `Insufficient permissions. Required: ${minRoles.join(' or ')}. Your role: ${member.role}`
    );
  }

  return { role: member.role as OrgRole };
}

/**
 * Check whether the org's quota allows more runs.
 * Throws QuotaError if exhausted.
 */
export async function checkQuota(orgId: string): Promise<void> {
  const org = await getOrganization(orgId);
  if (!org) {
    throw new AuthError('Organization not found', 404);
  }

  if (org.calls_used >= org.calls_allowed) {
    throw new QuotaError(
      `Quota exhausted: ${org.calls_used}/${org.calls_allowed} calls used this period`
    );
  }
}
