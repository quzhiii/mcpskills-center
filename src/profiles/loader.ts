import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseJsonConfig } from '../config/parse.js';
import type { Profile } from '../types/index.js';

export async function loadProfiles(profilesDir: string): Promise<Profile[]> {
  const entries = await readdir(profilesDir, { withFileTypes: true });
  const profiles: Profile[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

    const content = await readFile(join(profilesDir, entry.name), 'utf-8');
    profiles.push(validateProfile(parseJsonConfig<unknown>(content)));
  }

  return profiles.sort((a, b) => a.name.localeCompare(b.name));
}

export function validateProfile(value: unknown): Profile {
  if (!isRecord(value)) {
    throw new Error('Profile must be a JSON object');
  }

  const name = value.name;
  const description = value.description;
  const agents = value.agents;
  const mcpServers = value.mcpServers;
  const skills = value.skills;
  const disabledMcpServers = value.disabledMcpServers;

  if (!isNonEmptyString(name)) throw new Error('Profile name must be a non-empty string');
  if (!isNonEmptyString(description)) throw new Error('Profile description must be a non-empty string');
  if (!isStringArray(agents)) throw new Error('Profile agents must be an array of strings');
  if (!isStringArray(mcpServers)) throw new Error('Profile mcpServers must be an array of strings');
  if (!isStringArray(skills)) throw new Error('Profile skills must be an array of strings');
  if (disabledMcpServers !== undefined && !isStringArray(disabledMcpServers)) {
    throw new Error('Profile disabledMcpServers must be an array of strings');
  }

  return {
    name,
    description,
    agents,
    mcpServers,
    skills,
    disabledMcpServers,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}
