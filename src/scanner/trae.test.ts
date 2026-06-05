import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TraeScanner } from './trae.js';
import { createTempAgentRoot, withSuppressedConsoleWarn } from './test-utils.js';
import type { AgentConfig } from '../types/index.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

test('Trae scanner reads skills and cline_mcp_settings.json config', async () => {
  const fixture = await createTempAgentRoot('mcpskills-trae-');
  cleanups.push(fixture.cleanup);

  const skillPath = join(fixture.skillsDir, 'lark-doc');
  await mkdir(skillPath, { recursive: true });
  await writeFile(join(skillPath, 'SKILL.md'), '---\nname: lark-doc\ndescription: Works\n---\n', 'utf-8');

  const mcpConfigFile = join(fixture.root, 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
  await mkdir(join(fixture.root, 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings'), { recursive: true });
  await writeFile(
    mcpConfigFile,
    JSON.stringify({
      mcpServers: {
        reader: {
          url: 'https://example.com/sse',
        },
      },
    }),
    'utf-8'
  );

  const config: AgentConfig = {
    name: 'trae',
    scannerType: 'trae',
    configDir: fixture.root,
    skillsDir: fixture.skillsDir,
    mcpConfigFile,
  };

  const scanner = new TraeScanner(config);
  const skills = await scanner.scanSkills();
  const servers = await scanner.scanMCP();

  assert.equal(skills.length, 1);
  assert.equal(skills[0].id, 'lark-doc');
  assert.equal(skills[0].hasSkillMd, true);
  assert.equal(servers.length, 1);
  assert.equal(servers[0].id, 'reader');
  assert.equal(servers[0].transport, 'sse');
  assert.equal(servers[0].host, 'https://example.com/sse');
});

test('Trae scanner returns no servers for missing cline_mcp_settings.json', async () => {
  const fixture = await createTempAgentRoot('mcpskills-trae-missing-');
  cleanups.push(fixture.cleanup);

  const config: AgentConfig = {
    name: 'trae',
    scannerType: 'trae',
    configDir: fixture.root,
    skillsDir: fixture.skillsDir,
    mcpConfigFile: join(fixture.root, 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
  };

  const servers = await withSuppressedConsoleWarn(() => new TraeScanner(config).scanMCP());

  assert.deepEqual(servers, []);
});
