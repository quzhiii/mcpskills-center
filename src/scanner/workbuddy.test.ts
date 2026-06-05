import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { WorkBuddyScanner } from './workbuddy.js';
import { createTempAgentRoot, withSuppressedConsoleWarn } from './test-utils.js';
import type { AgentConfig } from '../types/index.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

test('WorkBuddy scanner reads skills and .mcp.json config', async () => {
  const fixture = await createTempAgentRoot('mcpskills-workbuddy-');
  cleanups.push(fixture.cleanup);

  const skillPath = join(fixture.skillsDir, 'paper-reorganizer');
  await mkdir(skillPath, { recursive: true });
  await writeFile(join(skillPath, 'SKILL.md'), '---\nname: paper-reorganizer\ndescription: Works\n---\n', 'utf-8');

  const mcpConfigFile = join(fixture.root, '.mcp.json');
  await writeFile(
    mcpConfigFile,
    JSON.stringify({
      mcpServers: {
        'connector-proxy': {
          type: 'http',
          url: 'http://127.0.0.1:10709/mcp',
        },
      },
    }),
    'utf-8'
  );

  const config: AgentConfig = {
    name: 'workbuddy',
    scannerType: 'workbuddy',
    configDir: fixture.root,
    skillsDir: fixture.skillsDir,
    mcpConfigFile,
  };

  const scanner = new WorkBuddyScanner(config);
  const skills = await scanner.scanSkills();
  const servers = await scanner.scanMCP();

  assert.equal(skills.length, 1);
  assert.equal(skills[0].id, 'paper-reorganizer');
  assert.equal(skills[0].hasSkillMd, true);
  assert.equal(skills[0].frontmatterValid, true);
  assert.equal(servers.length, 1);
  assert.equal(servers[0].id, 'connector-proxy');
  assert.equal(servers[0].transport, 'http');
  assert.equal(servers[0].host, 'http://127.0.0.1:10709/mcp');
});

test('WorkBuddy scanner returns no servers for missing .mcp.json', async () => {
  const fixture = await createTempAgentRoot('mcpskills-workbuddy-missing-');
  cleanups.push(fixture.cleanup);

  const config: AgentConfig = {
    name: 'workbuddy',
    scannerType: 'workbuddy',
    configDir: fixture.root,
    skillsDir: fixture.skillsDir,
    mcpConfigFile: join(fixture.root, '.mcp.json'),
  };

  const servers = await withSuppressedConsoleWarn(() => new WorkBuddyScanner(config).scanMCP());

  assert.deepEqual(servers, []);
});
