import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startWebServer } from './server.js';
import http from 'node:http';
import type { Server } from 'node:http';

function get(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}${path}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    }).on('error', reject);
  });
}

function createMockContext() {
  return {
    reportsDir: '/tmp',
    canonicalSkillsDir: '/tmp',
    backupsDir: '/tmp',
    profilesDir: '/tmp',
    syncConfigPath: '/tmp',
    agentConfigPath: '/tmp',
    approvedSyncRoots: [],
    runInventory: async () => ({ skills: [], mcpServers: [], agents: [] }),
    writeAllReports: async () => {},
    writeSyncPlanReports: async () => {},
    writeCapabilityMatrixReports: async () => {},
    loadProfiles: async () => [],
    listAgents: async () => [],
    discoverAgents: async () => ({ generatedAt: '', candidates: [] }),
    writeAgentDiscoveryReports: async () => {},
    applySyncPlan: async () => ({ appliedActions: [], backupEntries: [], receipts: [], manifestPath: '' }),
    restoreSyncBackupManifest: async () => ({ restoredEntries: [] }),
  };
}

describe('web server', () => {
  test('serves HTML dashboard', async () => {
    const server = await startWebServer(14100, createMockContext() as any);
    try {
      const res = await get(14100, '/');
      assert.equal(res.status, 200);
      assert.ok(res.body.includes('MCPskills Center'));
      assert.ok(res.body.includes('<!DOCTYPE html>'));
    } finally {
      server.close();
    }
  });

  test('returns inventory API', async () => {
    const server = await startWebServer(14101, createMockContext() as any);
    try {
      const res = await get(14101, '/api/inventory');
      assert.equal(res.status, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.skills, 0);
      assert.equal(data.mcpServers, 0);
      assert.equal(data.agents, 0);
    } finally {
      server.close();
    }
  });

  test('returns governance API', async () => {
    const server = await startWebServer(14102, createMockContext() as any);
    try {
      const res = await get(14102, '/api/governance');
      assert.equal(res.status, 200);
      const data = JSON.parse(res.body);
      assert.ok(Array.isArray(data.actions));
      assert.ok(data.generatedAt);
    } finally {
      server.close();
    }
  });

  test('returns history API', async () => {
    const server = await startWebServer(14103, createMockContext() as any);
    try {
      const res = await get(14103, '/api/history');
      assert.equal(res.status, 200);
      const data = JSON.parse(res.body);
      assert.ok(Array.isArray(data.entries));
    } finally {
      server.close();
    }
  });

  test('returns agents API', async () => {
    const server = await startWebServer(14104, createMockContext() as any);
    try {
      const res = await get(14104, '/api/agents');
      assert.equal(res.status, 200);
      const data = JSON.parse(res.body);
      assert.ok(Array.isArray(data.agents));
    } finally {
      server.close();
    }
  });

  test('returns health API', async () => {
    const server = await startWebServer(14105, createMockContext() as any);
    try {
      const res = await get(14105, '/api/health');
      assert.equal(res.status, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.status, 'ok');
    } finally {
      server.close();
    }
  });

  test('returns 404 for unknown paths', async () => {
    const server = await startWebServer(14106, createMockContext() as any);
    try {
      const res = await get(14106, '/api/nonexistent');
      assert.equal(res.status, 404);
      const data = JSON.parse(res.body);
      assert.equal(data.error, 'Not found');
    } finally {
      server.close();
    }
  });

  test('returns 400 for route without task', async () => {
    const server = await startWebServer(14107, createMockContext() as any);
    try {
      const res = await get(14107, '/api/route');
      assert.equal(res.status, 400);
      const data = JSON.parse(res.body);
      assert.equal(data.error, 'Missing task parameter');
    } finally {
      server.close();
    }
  });
});
