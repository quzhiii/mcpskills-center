import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDefaultPaths } from '../config/paths.js';
import { executeSetupCommand } from './setup-commands.js';
import type { CliArgs } from '../cli.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

async function makePaths() {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-setup-command-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const paths = createDefaultPaths(join(root, 'package', 'dist'), {
    platform: 'linux', homeDir: join(root, 'home'), xdgDataHome: join(root, 'data'),
  });
  await mkdir(paths.bundledProfilesDir, { recursive: true });
  await Promise.all([
    writeFile(paths.bundledAgentConfigPath, '{"agents":[]}'),
    writeFile(paths.bundledRoutingPolicyPath, '{"version":"1","taskCategories":[],"fallbackOrder":[]}'),
  ]);
  return paths;
}

function cli(command: CliArgs['command'], subcommand?: string): CliArgs {
  return {
    command,
    options: {
      dryRun: false, apply: false, force: false, confirm: false, active: false,
      allowCommands: [], timeoutMs: 3000, subcommand,
    },
  };
}

test('config path reports candidate and effective sources without creating user data', async () => {
  const paths = await makePaths();

  const output = await executeSetupCommand(cli('config', 'path'), paths);

  assert.match(output ?? '', /agents.*bundled/);
  assert.match(output ?? '', /sync.*default/);
  assert.match(output ?? '', new RegExp(escapeRegex(paths.userConfigDir)));
  await assert.rejects(() => access(paths.userDataRoot), { code: 'ENOENT' });
});

test('config validate returns an aggregated validation summary', async () => {
  const paths = await makePaths();

  const output = await executeSetupCommand(cli('config', 'validate'), paths);

  assert.match(output ?? '', /Configuration validation/);
  assert.match(output ?? '', /\[OK\]/);
  assert.match(output ?? '', /agents\.config/);
  await assert.rejects(() => access(paths.governanceDbPath), { code: 'ENOENT' });
});

test('executeSetupCommand returns null for normal governance commands', async () => {
  const paths = await makePaths();
  assert.equal(await executeSetupCommand(cli('scan'), paths), null);
});

test('doctor runs before database initialization', async () => {
  const paths = await makePaths();

  const output = await executeSetupCommand(cli('doctor'), paths);

  assert.match(output ?? '', /MCPskills Center doctor/);
  await assert.rejects(() => access(paths.governanceDbPath), { code: 'ENOENT' });
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
