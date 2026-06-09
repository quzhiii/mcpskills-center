import type { ParsedMcpConfigServer, McpAdapterScope } from '../../types/index.js';

export interface McpConfigAdapter {
  parse(content: string): ParsedMcpConfigServer[];
}

export type { ParsedMcpConfigServer, McpAdapterScope };
