import { readFile } from 'node:fs/promises';
import { parseJsonConfig } from '../config/parse.js';

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
  return validateRoutingPolicy(parseJsonConfig<unknown>(raw));
}

export function validateRoutingPolicy(value: unknown): RoutingPolicy {
  if (!isRecord(value) || !isNonEmptyString(value.version) || !value.taskCategories || !value.fallbackOrder) {
    throw new Error('Invalid routing policy: missing required fields');
  }
  if (!Array.isArray(value.taskCategories) || !isStringArray(value.fallbackOrder)) {
    throw new Error('Invalid routing policy: taskCategories and fallbackOrder must be arrays');
  }

  const taskCategories = value.taskCategories.map((category, index) => validateTaskCategory(category, index));
  const ids = new Set<string>();
  for (const category of taskCategories) {
    if (ids.has(category.id)) throw new Error(`Invalid routing policy: duplicate task category id ${category.id}`);
    ids.add(category.id);
  }

  return {
    version: value.version,
    taskCategories,
    fallbackOrder: value.fallbackOrder,
  };
}

export function matchTaskCategory(policy: RoutingPolicy, taskDescription: string): TaskCategory | undefined {
  const lower = taskDescription.toLowerCase();
  return policy.taskCategories.find(cat =>
    cat.keywords.some(kw => lower.includes(kw.toLowerCase())),
  );
}

function validateTaskCategory(value: unknown, index: number): TaskCategory {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isStringArray(value.keywords) ||
    !isStringArray(value.requiredCapabilities) ||
    !isStringArray(value.eligibleAgents) ||
    (value.preferredAgent !== undefined && !isNonEmptyString(value.preferredAgent))
  ) {
    throw new Error(`Invalid routing policy task category at index ${index}`);
  }

  return {
    id: value.id,
    keywords: value.keywords,
    requiredCapabilities: value.requiredCapabilities,
    eligibleAgents: value.eligibleAgents,
    preferredAgent: value.preferredAgent,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}
