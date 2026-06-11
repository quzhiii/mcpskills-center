import { readFile } from 'node:fs/promises';

export interface RoutingPolicy {
  version: string;
  taskCategories: TaskCategory[];
  fallbackOrder: string[];
}

export interface TaskCategory {
  id: string;
  keywords: string[];
  requiredCapabilities: string[];
  eligibleAgents: string[];
  preferredAgent?: string;
}

export async function loadRoutingPolicy(configPath: string): Promise<RoutingPolicy> {
  const raw = await readFile(configPath, 'utf-8');
  const policy = JSON.parse(raw) as RoutingPolicy;
  validateRoutingPolicy(policy);
  return policy;
}

function validateRoutingPolicy(policy: RoutingPolicy): void {
  if (!policy.version || !policy.taskCategories || !policy.fallbackOrder) {
    throw new Error('Invalid routing policy: missing required fields');
  }
  if (!Array.isArray(policy.taskCategories) || !Array.isArray(policy.fallbackOrder)) {
    throw new Error('Invalid routing policy: taskCategories and fallbackOrder must be arrays');
  }
}

export function matchTaskCategory(policy: RoutingPolicy, taskDescription: string): TaskCategory | undefined {
  const lower = taskDescription.toLowerCase();
  return policy.taskCategories.find(cat =>
    cat.keywords.some(kw => lower.includes(kw.toLowerCase())),
  );
}
