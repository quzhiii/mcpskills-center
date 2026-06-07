import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeAllReports, writeAuditMarkdown, writeDashboardHtml, writeInventoryJson, writeInventoryMarkdown } from './reporter.js';
import type { AuditReport, Inventory } from '../types/index.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

test('writeAuditMarkdown includes actionable recommendations', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-reporter-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));

  const report: AuditReport = {
    generatedAt: '2026-06-03T00:00:00.000Z',
    inventory: {
      generatedAt: '2026-06-03T00:00:00.000Z',
      agents: [],
      skills: [],
      mcpServers: [],
      profiles: [],
    },
    issues: [],
    recommendations: [
      {
        category: 'merge',
        targetType: 'skill',
        targetId: 'duplicate-skill',
        severity: 'warning',
        reason: 'Duplicate skill appears in multiple agents',
        suggestedAction: 'Plan canonical-store consolidation',
        requiresWrite: true,
      },
      {
        category: 'manual-review',
        targetType: 'mcp-server',
        targetId: 'sensitive-mcp',
        severity: 'warning',
        reason: 'Sensitive env names detected',
        suggestedAction: 'Verify secret storage without printing values',
        requiresWrite: false,
      },
    ],
    summary: {
      totalSkills: 0,
      totalMcpServers: 0,
      duplicateSkills: 0,
      duplicateMcps: 0,
      missingSkillMds: 0,
      brokenSymlinks: 0,
      sensitiveEnvs: 0,
    },
  };

  const outPath = join(root, 'audit.md');
  await writeAuditMarkdown(report, outPath);
  const markdown = await readFile(outPath, 'utf-8');

  assert.match(markdown, /## Recommendations/);
  assert.match(markdown, /\| Category \| Target \| Severity \| Requires Write \| Action \|/);
  assert.match(markdown, /\| merge \| skill: duplicate-skill \| warning \| yes \| Plan canonical-store consolidation \|/);
  assert.match(markdown, /\| manual-review \| mcp-server: sensitive-mcp \| warning \| no \| Verify secret storage without printing values \|/);
});

test('writeInventoryJson and writeInventoryMarkdown include agent support metadata', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-inventory-reporter-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));

  const inventory: Inventory = {
    generatedAt: '2026-06-06T00:00:00.000Z',
    agents: [
      {
        name: 'claude-code',
        id: 'claude-code',
        displayName: 'Claude Code',
        scannerType: 'claude-code',
        enabled: true,
        readOnly: false,
        configDir: 'C:/claude',
        skillsDir: 'C:/claude/skills',
      },
      {
        name: 'qoder',
        id: 'qoder',
        displayName: 'Qoder',
        scannerType: 'generic',
        enabled: false,
        readOnly: true,
        configDir: 'C:/qoder',
        skillsDir: 'C:/qoder/skills',
      },
    ],
    skills: [],
    mcpServers: [],
    profiles: [],
  };

  const jsonPath = join(root, 'inventory.json');
  const markdownPath = join(root, 'inventory.md');

  await writeInventoryJson(inventory, jsonPath);
  await writeInventoryMarkdown(inventory, markdownPath);

  const json = JSON.parse(await readFile(jsonPath, 'utf-8'));
  const markdown = await readFile(markdownPath, 'utf-8');

  assert.equal(json.agents[0].support.currentLevel, 'dedicated read-only plus write-ready workflow support');
  assert.equal(json.agents[1].support.sourceOfTruthConfidence, 'low');
  assert.match(markdown, /Support: `dedicated read-only plus write-ready workflow support`/);
  assert.match(markdown, /Source-of-Truth Confidence: `high`/);
  assert.match(markdown, /Support: `generic read-only placeholder`/);
});

test('writeAllReports carries support metadata into inventory outputs and dashboard without mutating inventory order', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-all-reports-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));

  const inventory: Inventory = {
    generatedAt: '2026-06-06T00:00:00.000Z',
    agents: [
      {
        name: 'claude-code',
        id: 'claude-code',
        displayName: 'Claude Code',
        scannerType: 'claude-code',
        enabled: true,
        readOnly: false,
        configDir: 'C:/claude',
        skillsDir: 'C:/claude/skills',
      },
      {
        name: 'qoder',
        id: 'qoder',
        displayName: 'Qoder',
        scannerType: 'generic',
        enabled: false,
        readOnly: true,
        configDir: 'C:/qoder',
        skillsDir: 'C:/qoder/skills',
      },
    ],
    skills: [
      {
        id: 'z-skill',
        displayName: 'z-skill',
        sourcePath: 'C:/skills/z-skill',
        agentInstallPaths: ['C:/skills/z-skill'],
        isCanonical: false,
        isSymlink: false,
        hasSkillMd: true,
        frontmatterValid: true,
        isDuplicate: false,
      },
      {
        id: 'a-skill',
        displayName: 'a-skill',
        sourcePath: 'C:/skills/a-skill',
        agentInstallPaths: ['C:/skills/a-skill'],
        isCanonical: false,
        isSymlink: false,
        hasSkillMd: true,
        frontmatterValid: true,
        isDuplicate: false,
      },
    ],
    mcpServers: [
      {
        id: 'z-server',
        agentSources: ['claude-code'],
        transport: 'stdio',
        command: 'npx',
        isDuplicate: false,
        isEnabled: true,
        canStart: null,
        hasSensitiveEnv: false,
      },
      {
        id: 'a-server',
        agentSources: ['qoder'],
        transport: 'http',
        host: 'https://example.com/mcp',
        isDuplicate: false,
        isEnabled: true,
        canStart: null,
        hasSensitiveEnv: false,
      },
    ],
    profiles: [],
  };

  const audit: AuditReport = {
    generatedAt: '2026-06-06T00:00:00.000Z',
    inventory,
    issues: [],
    recommendations: [],
    summary: {
      totalSkills: 2,
      totalMcpServers: 2,
      duplicateSkills: 0,
      duplicateMcps: 0,
      missingSkillMds: 0,
      brokenSymlinks: 0,
      sensitiveEnvs: 0,
    },
  };

  await writeAllReports(inventory, audit, root);

  const json = JSON.parse(await readFile(join(root, 'inventory-current.json'), 'utf-8'));
  const auditMarkdown = await readFile(join(root, 'audit-current.md'), 'utf-8');
  const markdown = await readFile(join(root, 'inventory-current.md'), 'utf-8');
  const dashboard = await readFile(join(root, 'dashboard.html'), 'utf-8');

  assert.equal(json.agents[0].support.currentLevel, 'dedicated read-only plus write-ready workflow support');
  assert.match(markdown, /Support: `generic read-only placeholder`/);
  assert.match(dashboard, /Agent Support/);
  assert.match(dashboard, /generic read-only placeholder/);
  assert.match(auditMarkdown, /Generated: 2026-06-06T00:00:00.000Z/);
  assert.deepEqual(inventory.skills.map(skill => skill.id), ['z-skill', 'a-skill']);
  assert.deepEqual(inventory.mcpServers.map(server => server.id), ['z-server', 'a-server']);
});

test('writeDashboardHtml enriches agent support metadata for direct calls', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-dashboard-direct-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));

  const inventory: Inventory = {
    generatedAt: '2026-06-06T00:00:00.000Z',
    agents: [
      {
        name: 'future-agent',
        id: 'future-agent',
        displayName: 'Future Agent',
        scannerType: 'future',
        enabled: false,
        readOnly: true,
        configDir: 'C:/future',
        skillsDir: 'C:/future/skills',
      },
    ],
    skills: [],
    mcpServers: [],
    profiles: [],
  };

  const audit: AuditReport = {
    generatedAt: '2026-06-06T00:00:00.000Z',
    inventory,
    issues: [],
    recommendations: [],
    summary: {
      totalSkills: 0,
      totalMcpServers: 0,
      duplicateSkills: 0,
      duplicateMcps: 0,
      missingSkillMds: 0,
      brokenSymlinks: 0,
      sensitiveEnvs: 0,
    },
  };

  const outPath = join(root, 'dashboard.html');
  await writeDashboardHtml(inventory, audit, outPath);
  const html = await readFile(outPath, 'utf-8');

  assert.match(html, /Agent Support/);
  assert.match(html, /undocumented\/unknown/);
  assert.match(html, /low/);
});

test('writeInventoryJson prefers current scannerType over stale embedded support metadata', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-stale-support-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));

  const inventory: Inventory = {
    generatedAt: '2026-06-06T00:00:00.000Z',
    agents: [
      {
        name: 'custom-claude-install',
        id: 'custom-claude-install',
        displayName: 'Custom Claude Install',
        scannerType: 'claude-code',
        enabled: true,
        readOnly: false,
        configDir: 'C:/custom-claude',
        skillsDir: 'C:/custom-claude/skills',
        support: {
          currentLevel: 'generic read-only placeholder',
          sourceOfTruthConfidence: 'low',
        },
      },
    ],
    skills: [],
    mcpServers: [],
    profiles: [],
  };

  const outPath = join(root, 'inventory.json');
  await writeInventoryJson(inventory, outPath);
  const json = JSON.parse(await readFile(outPath, 'utf-8'));

  assert.equal(json.agents[0].support.currentLevel, 'dedicated read-only plus write-ready workflow support');
  assert.equal(json.agents[0].support.sourceOfTruthConfidence, 'high');
});

test('writeDashboardHtml prefers scannerType over custom id when enriching support metadata', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-dashboard-custom-id-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));

  const inventory: Inventory = {
    generatedAt: '2026-06-06T00:00:00.000Z',
    agents: [
      {
        name: 'custom-claude-install',
        id: 'custom-claude-install',
        displayName: 'Custom Claude Install',
        scannerType: 'claude-code',
        enabled: true,
        readOnly: false,
        configDir: 'C:/custom-claude',
        skillsDir: 'C:/custom-claude/skills',
      },
    ],
    skills: [],
    mcpServers: [],
    profiles: [],
  };

  const audit: AuditReport = {
    generatedAt: '2026-06-06T00:00:00.000Z',
    inventory,
    issues: [],
    recommendations: [],
    summary: {
      totalSkills: 0,
      totalMcpServers: 0,
      duplicateSkills: 0,
      duplicateMcps: 0,
      missingSkillMds: 0,
      brokenSymlinks: 0,
      sensitiveEnvs: 0,
    },
  };

  const outPath = join(root, 'dashboard.html');
  await writeDashboardHtml(inventory, audit, outPath);
  const html = await readFile(outPath, 'utf-8');

  assert.match(html, /dedicated read-only plus write-ready workflow support/);
  assert.match(html, /high/);
});
