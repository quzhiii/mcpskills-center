import { loadRoutingPolicy, matchTaskCategory } from './policy.js';
import { insertRoutingLog } from '../db/index.js';
import type { AgentConfig } from '../types/index.js';
import type Database from 'better-sqlite3';

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
  db?: Database.Database,
): Promise<RouteResult> {
  const policy = await loadRoutingPolicy(policyPath);
  const category = matchTaskCategory(policy, taskDescription);

  if (!category) {
    const result = {
      recommendedAgent: policy.fallbackOrder[0],
      reasoning: `No specific category matched for "${taskDescription}". Using fallback priority.`,
      category: 'unclassified',
      alternatives: policy.fallbackOrder.slice(1),
    };
    if (db) {
      insertRoutingLog(db, {
        timestamp: new Date().toISOString(),
        taskDescription,
        recommendedAgent: result.recommendedAgent,
        category: result.category,
        alternatives: result.alternatives.join(', '),
        reasoning: result.reasoning,
      });
    }
    return result;
  }

  const recommended = category.preferredAgent ?? category.eligibleAgents[0];
  const alternatives = category.eligibleAgents.filter(a => a !== recommended);

  const result = {
    recommendedAgent: recommended,
    reasoning: `Task matches category "${category.id}". Preferred agent is ${recommended}.`,
    category: category.id,
    alternatives,
  };

  if (db) {
    insertRoutingLog(db, {
      timestamp: new Date().toISOString(),
      taskDescription,
      recommendedAgent: result.recommendedAgent,
      category: result.category,
      alternatives: result.alternatives.join(', '),
      reasoning: result.reasoning,
    });
  }

  return result;
}
