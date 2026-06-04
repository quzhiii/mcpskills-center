import { readdir, readFile, stat, lstat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { BaseScanner } from './base.js';
import { parseJsonConfig } from '../config/parse.js';
import type { Skill, MCPServer } from '../types/index.js';

export class OpenCodeScanner extends BaseScanner {
  async scanSkills(): Promise<Skill[]> {
    const skills: Skill[] = [];
    const skillsDir = this.agentConfig.skillsDir;

    try {
      const entries = await readdir(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillPath = join(skillsDir, entry.name);
        const skillMdPath = join(skillPath, 'SKILL.md');

        let hasSkillMd = false;
        let frontmatterValid = false;
        let isSymlink = false;
        let lastModified: Date | undefined;

        try {
          const skillStat = await lstat(skillPath);
          isSymlink = skillStat.isSymbolicLink();
          lastModified = skillStat.mtime;

          const mdStat = await stat(skillMdPath);
          hasSkillMd = mdStat.isFile();

          if (hasSkillMd) {
            const content = await readFile(skillMdPath, 'utf-8');
            frontmatterValid = this.validateFrontmatter(content);
          }
        } catch {
          // SKILL.md not found or unreadable
        }

        skills.push({
          id: entry.name,
          displayName: entry.name,
          sourcePath: skillPath,
          agentInstallPaths: [skillPath],
          isCanonical: false,
          isSymlink,
          hasSkillMd,
          frontmatterValid,
          isDuplicate: false,
          lastModified,
        });
      }
    } catch (err) {
      console.warn(`Warning: Could not read OpenCode skills dir: ${skillsDir}`, (err as Error).message);
    }

    return skills;
  }

  async scanMCP(): Promise<MCPServer[]> {
    const servers: MCPServer[] = [];
    const mcpFile = this.agentConfig.mcpConfigFile;

    if (!mcpFile) {
      return servers;
    }

    try {
      const content = await readFile(mcpFile, 'utf-8');
      const config = parseJsonConfig<Record<string, any>>(content);
      const mcpServers = config.mcp || {};

      for (const [name, serverConfig] of Object.entries(mcpServers)) {
        const cfg = serverConfig as Record<string, unknown>;
        const command = this.extractCommand(cfg);
        const host = typeof cfg.url === 'string' ? cfg.url : undefined;
        const transport = this.detectTransport(cfg);

        servers.push({
          id: name,
          agentSources: [this.agentConfig.name],
          transport,
          command,
          host,
          isDuplicate: false,
          isEnabled: true,
          canStart: null,
          hasSensitiveEnv: this.checkSensitiveEnv(cfg),
        });
      }
    } catch (err) {
      console.warn(`Warning: Could not read OpenCode MCP config: ${mcpFile}`, (err as Error).message);
    }

    return servers;
  }

  private validateFrontmatter(content: string): boolean {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return false;

    const fm = match[1];
    return fm.includes('name:') && fm.includes('description:');
  }

  private detectTransport(cfg: Record<string, unknown>): 'stdio' | 'http' | 'sse' | 'unknown' {
    if (cfg.command) return 'stdio';
    if (cfg.url) {
      const url = String(cfg.url);
      if (url.includes('/sse')) return 'sse';
      return 'http';
    }
    return 'unknown';
  }

  private extractCommand(cfg: Record<string, unknown>): string | undefined {
    if (typeof cfg.command === 'string') {
      return cfg.command;
    }

    if (Array.isArray(cfg.command) && typeof cfg.command[0] === 'string') {
      return cfg.command[0];
    }

    return undefined;
  }

  private checkSensitiveEnv(cfg: Record<string, unknown>): boolean {
    const env = cfg.env as Record<string, string> | undefined;
    if (!env) return false;

    const sensitiveKeys = ['api_key', 'apikey', 'token', 'secret', 'password', 'auth'];
    return Object.keys(env).some(key =>
      sensitiveKeys.some(s => key.toLowerCase().includes(s))
    );
  }
}
