import type { ParsedMcpConfigServer, McpAdapterScope } from '../../types/index.js';

export interface McpConfigAdapter {
  parse(content: string): ParsedMcpConfigServer[];
  serialize(servers: ParsedMcpConfigServer[]): string;
}

export type { ParsedMcpConfigServer, McpAdapterScope };
