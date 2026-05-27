import type { AgentConfig, Skill, MCPServer } from '../types/index.js';

export abstract class BaseScanner {
  protected agentConfig: AgentConfig;

  constructor(config: AgentConfig) {
    this.agentConfig = config;
  }

  abstract scanSkills(): Promise<Skill[]>;
  abstract scanMCP(): Promise<MCPServer[]>;

  getAgentConfig(): AgentConfig {
    return this.agentConfig;
  }
}
