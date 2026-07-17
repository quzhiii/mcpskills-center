import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GenericScanner } from './generic.js';
import { createDefaultScannerRegistry } from './registry.js';
import { createTempAgentRoot } from './test-utils.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

test('GenericScanner scans skill directories without writing', async () => {
  const { root, skillsDir, cleanup } = await createTempAgentRoot('mcpskills-generic-scanner-');
  cleanups.push(cleanup);
  const completeSkillPath = join(skillsDir, 'complete-skill');
  const incompleteSkillPath = join(skillsDir, 'incomplete-skill');

  await mkdir(completeSkillPath, { recursive: true });
  await mkdir(incompleteSkillPath, { recursive: true });
  await writeFile(join(completeSkillPath, 'SKILL.md'), '---\nname: complete-skill\ndescription: Works\n---\n', 'utf-8');

  const scanner = new GenericScanner({
    name: 'qoder',
    scannerType: 'generic',
    configDir: root,
    skillsDir,
  });

  const skills = await scanner.scanSkills();

  assert.deepEqual(skills.map(skill => skill.id).sort(), ['complete-skill', 'incomplete-skill']);
  assert.equal(skills.find(skill => skill.id === 'complete-skill')?.sourcePath, completeSkillPath);
  assert.equal(skills.find(skill => skill.id === 'complete-skill')?.hasSkillMd, true);
  assert.equal(skills.find(skill => skill.id === 'complete-skill')?.frontmatterValid, true);
  assert.equal(skills.find(skill => skill.id === 'incomplete-skill')?.sourcePath, incompleteSkillPath);
  assert.equal(skills.find(skill => skill.id === 'incomplete-skill')?.hasSkillMd, false);
  assert.equal(skills.find(skill => skill.id === 'incomplete-skill')?.frontmatterValid, false);
});

test('GenericScanner preserves symlink metadata for skill directories', async () => {
  const { root, skillsDir, cleanup } = await createTempAgentRoot('mcpskills-generic-symlink-');
  cleanups.push(cleanup);
  const canonicalSkillPath = join(root, 'canonical-skill');
  const linkedSkillPath = join(skillsDir, 'linked-skill');

  await mkdir(canonicalSkillPath, { recursive: true });
  await writeFile(join(canonicalSkillPath, 'SKILL.md'), '---\nname: linked-skill\ndescription: Linked\n---\n', 'utf-8');
  await symlink(canonicalSkillPath, linkedSkillPath, 'junction');

  const scanner = new GenericScanner({
    name: 'trae',
    scannerType: 'generic',
    configDir: root,
    skillsDir,
  });

  const skills = await scanner.scanSkills();

  assert.equal(skills[0].id, 'linked-skill');
  assert.equal(skills[0].isSymlink, true);
  assert.equal(skills[0].hasSkillMd, true);
});

test('GenericScanner rejects misleading frontmatter keys', async () => {
  const { skillsDir, cleanup } = await createTempAgentRoot('mcpskills-generic-frontmatter-');
  cleanups.push(cleanup);
  const misleadingSkillPath = join(skillsDir, 'misleading-skill');

  await mkdir(misleadingSkillPath, { recursive: true });
  await writeFile(join(misleadingSkillPath, 'SKILL.md'), '---\ndisplay_name: misleading\ndescription: Looks valid\n---\n', 'utf-8');

  const scanner = new GenericScanner({
    name: 'qoder',
    scannerType: 'generic',
    configDir: skillsDir,
    skillsDir,
  });

  const skills = await scanner.scanSkills();

  assert.equal(skills[0].hasSkillMd, true);
  assert.equal(skills[0].frontmatterValid, false);
});

test('GenericScanner requires top-level frontmatter keys', async () => {
  const { skillsDir, cleanup } = await createTempAgentRoot('mcpskills-generic-nested-frontmatter-');
  cleanups.push(cleanup);
  const nestedSkillPath = join(skillsDir, 'nested-skill');

  await mkdir(nestedSkillPath, { recursive: true });
  await writeFile(join(nestedSkillPath, 'SKILL.md'), '---\nmetadata:\n  name: nested\ndescription: Looks valid\n---\n', 'utf-8');

  const scanner = new GenericScanner({
    name: 'qoder',
    scannerType: 'generic',
    configDir: skillsDir,
    skillsDir,
  });

  const skills = await scanner.scanSkills();

  assert.equal(skills[0].hasSkillMd, true);
  assert.equal(skills[0].frontmatterValid, false);
});

test('GenericScanner returns empty results for missing roots', async () => {
  const scanner = new GenericScanner({
    name: 'missing-agent',
    scannerType: 'generic',
    configDir: 'C:/missing-agent',
    skillsDir: 'C:/missing-agent/skills',
  });

  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  let skills;
  let mcps;
  try {
    skills = await scanner.scanSkills();
    mcps = await scanner.scanMCP();
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(skills, []);
  assert.deepEqual(mcps, []);
  assert.deepEqual(warnings, []);
});

test('default scanner registry resolves generic scanner type', () => {
  const scanner = createDefaultScannerRegistry().createScanner({
    name: 'trae',
    scannerType: 'generic',
    configDir: 'C:/trae',
    skillsDir: 'C:/trae/skills',
  });

  assert.ok(scanner instanceof GenericScanner);
});
