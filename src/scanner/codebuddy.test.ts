import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CodeBuddyScanner } from './codebuddy.js';
import { createTempAgentRoot, withSuppressedConsoleWarn } from './test-utils.js';
import type { AgentConfig } from '../types/index.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

test('CodeBuddy scanner reads marketplace skills and mcp.json config', async () => {
  const fixture = await createTempAgentRoot('mcpskills-codebuddy-');
  cleanups.push(fixture.cleanup);

  const skillsDir = join(fixture.root, 'skills-marketplace', 'skills');
  const skillPath = join(skillsDir, 'find-skills');
  await mkdir(skillPath, { recursive: true });
  await writeFile(join(skillPath, 'SKILL.md'), '---\nname: find-skills\ndescription: Works\n---\n', 'utf-8');

  const mcpConfigFile = join(fixture.root, 'mcp.json');
  await writeFile(
    mcpConfigFile,
    JSON.stringify({
      mcpServers: {
        github: {
          command: ['npx', '-y', '@modelcontextprotocol/server-github'],
          env: {
            GITHUB_TOKEN: 'redacted',
          },
        },
      },
    }),
    'utf-8'
  );

  const config: AgentConfig = {
    name: 'codebuddy',
    scannerType: 'codebuddy',
    configDir: fixture.root,
    skillsDir,
    mcpConfigFile,
  };

  const scanner = new CodeBuddyScanner(config);
  const skills = await scanner.scanSkills();
  const servers = await scanner.scanMCP();

  assert.equal(skills.length, 1);
  assert.equal(skills[0].id, 'find-skills');
  assert.equal(skills[0].hasSkillMd, true);
  assert.equal(servers.length, 1);
  assert.equal(servers[0].id, 'github');
  assert.equal(servers[0].transport, 'stdio');
  assert.equal(servers[0].command, 'npx');
  assert.equal(servers[0].hasSensitiveEnv, true);
});

test('CodeBuddy scanner returns no servers for missing mcp.json', async () => {
  const fixture = await createTempAgentRoot('mcpskills-codebuddy-missing-');
  cleanups.push(fixture.cleanup);

  const config: AgentConfig = {
    name: 'codebuddy',
    scannerType: 'codebuddy',
    configDir: fixture.root,
    skillsDir: join(fixture.root, 'skills-marketplace', 'skills'),
    mcpConfigFile: join(fixture.root, 'mcp.json'),
  };

  const servers = await withSuppressedConsoleWarn(() => new CodeBuddyScanner(config).scanMCP());

  assert.deepEqual(servers, []);
});
