import { loadRoutingPolicy, matchTaskCategory } from './policy.js';
import type { AgentConfig } from '../types/index.js';

export interface RouteResult {
  recommendedAgent: string;
  reasoning: string;
  category: string;
  alternatives: string[];
}

export async function routeTask(
  taskDescription: string,
  policyPath: string,
  agents: AgentConfig[],
): Promise<RouteResult> {
  const policy = await loadRoutingPolicy(policyPath);
  const category = matchTaskCategory(policy, taskDescription);

  if (!category) {
    return {
      recommendedAgent: policy.fallbackOrder[0],
      reasoning: `No specific category matched for "${taskDescription}". Using fallback priority.`,
      category: 'unclassified',
      alternatives: policy.fallbackOrder.slice(1),
    };
  }

  const recommended = category.preferredAgent ?? category.eligibleAgents[0];
  const alternatives = category.eligibleAgents.filter(a => a !== recommended);

  return {
    recommendedAgent: recommended,
    reasoning: `Task matches category "${category.id}". Preferred agent is ${recommended}.`,
    category: category.id,
    alternatives,
  };
}
