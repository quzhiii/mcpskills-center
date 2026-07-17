import { Dirent } from 'node:fs';
import { lstat, readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { BaseScanner } from './base.js';
import type { MCPServer, Skill } from '../types/index.js';
import { isMissingPathError } from './errors.js';

export class GenericScanner extends BaseScanner {
  async scanSkills(): Promise<Skill[]> {
    const skills: Skill[] = [];
    const skillsDir = this.agentConfig.skillsDir;

    try {
      const entries = await readdir(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        const skillPath = join(skillsDir, entry.name);
        if (!(await shouldScanSkillEntry(entry, skillPath))) continue;

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
            frontmatterValid = validateFrontmatter(await readFile(skillMdPath, 'utf-8'));
          }
        } catch {
          // Missing or unreadable SKILL.md keeps the skill visible for review.
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
      if (!isMissingPathError(err)) {
        console.warn(`Warning: Could not read generic skills dir: ${skillsDir}`, (err as Error).message);
      }
    }

    return skills;
  }

  async scanMCP(): Promise<MCPServer[]> {
    return [];
  }
}

async function shouldScanSkillEntry(entry: Dirent, skillPath: string): Promise<boolean> {
  if (entry.isDirectory()) return true;

  try {
    const linkStat = await lstat(skillPath);
    if (!linkStat.isSymbolicLink()) return false;

    const targetStat = await stat(skillPath);
    return targetStat.isDirectory();
  } catch {
    return false;
  }
}

function validateFrontmatter(content: string): boolean {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return false;

  const keys = new Set(
    match[1]
      .split(/\r?\n/)
      .map(line => line.match(/^([A-Za-z0-9_-]+)\s*:/)?.[1])
      .filter((key): key is string => Boolean(key))
  );

  return keys.has('name') && keys.has('description');
}
