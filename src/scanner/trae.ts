import { GenericScanner } from './generic.js';
import { scanJsonMcpServers } from './json-mcp.js';
import type { MCPServer } from '../types/index.js';

export class TraeScanner extends GenericScanner {
  async scanMCP(): Promise<MCPServer[]> {
    return scanJsonMcpServers(this.getAgentConfig().name, this.getAgentConfig().mcpConfigFile, 'Trae');
  }
}
