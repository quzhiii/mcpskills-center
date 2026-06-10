import { readdir, readFile, stat, lstat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { BaseScanner } from './base.js';
import { parseClaudeCodeMcpConfig } from '../mcp/adapters/claude-code.js';
import type { Skill, MCPServer } from '../types/index.js';

export class ClaudeCodeScanner extends BaseScanner {
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
        let lastModified: Date | undefined;

        try {
          const skillStat = await lstat(skillPath);
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
          isSymlink: false,
          hasSkillMd,
          frontmatterValid,
          isDuplicate: false,
          lastModified,
        });
      }
    } catch (err) {
      console.warn(`Warning: Could not read Claude Code skills dir: ${skillsDir}`, (err as Error).message);
    }

    return skills;
  }

  async scanMCP(): Promise<MCPServer[]> {
    const mcpFile = this.agentConfig.mcpConfigFile;

    if (!mcpFile) {
      return [];
    }

    try {
      const content = await readFile(mcpFile, 'utf-8');
      return parseClaudeCodeMcpConfig(content).map(server => ({
            id: server.id,
            agentSources: [this.agentConfig.name],
            definitions: [
              {
                agentName: this.agentConfig.name,
                transport: server.transport,
                command: server.command,
                host: server.host,
                isEnabled: server.isEnabled,
                canStart: null,
                hasSensitiveEnv: server.hasSensitiveEnv,
                scope: server.scope,
              },
            ],
            transport: server.transport,
            command: server.command,
            host: server.host,
            isDuplicate: false,
            isEnabled: server.isEnabled,
            canStart: null,
            hasSensitiveEnv: server.hasSensitiveEnv,
          }));
    } catch (err) {
      console.warn(`Warning: Could not read Claude Code MCP config: ${mcpFile}`, (err as Error).message);
      return [];
    }
  }

  private validateFrontmatter(content: string): boolean {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return false;

    const fm = match[1];
    return fm.includes('name:') && fm.includes('description:');
  }

}
