import { runInventory } from './scanner/index.js';
import { normalizeInventory } from './normalizer/index.js';
import { runAudit } from './auditor/index.js';
import { writeAllReports } from './dashboard/reporter.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function main() {
  const command = process.argv[2] || 'scan';

  switch (command) {
    case 'scan': {
      console.log('Running inventory scan...');
      const inventory = await runInventory();
      const normalized = normalizeInventory(inventory);
      const audit = runAudit(normalized);

      const reportsDir = join(__dirname, '..', 'reports');
      await writeAllReports(normalized, audit, reportsDir);

      console.log('\n✅ Scan complete!');
      console.log(`   Skills: ${normalized.skills.length}`);
      console.log(`   MCP Servers: ${normalized.mcpServers.length}`);
      console.log(`   Issues: ${audit.issues.length}`);
      console.log(`\n   Reports written to: ${reportsDir}`);
      break;
    }

    case 'audit': {
      console.log('Running audit...');
      const inventory = await runInventory();
      const normalized = normalizeInventory(inventory);
      const audit = runAudit(normalized);

      console.log('\n📊 Audit Summary');
      console.log(`   Total Skills: ${audit.summary.totalSkills}`);
      console.log(`   Total MCP Servers: ${audit.summary.totalMcpServers}`);
      console.log(`   Duplicate Skills: ${audit.summary.duplicateSkills}`);
      console.log(`   Duplicate MCPs: ${audit.summary.duplicateMcps}`);
      console.log(`   Missing SKILL.md: ${audit.summary.missingSkillMds}`);
      console.log(`   Broken Symlinks: ${audit.summary.brokenSymlinks}`);
      console.log(`   Sensitive Env: ${audit.summary.sensitiveEnvs}`);

      if (audit.issues.length > 0) {
        console.log('\n⚠️  Issues found:');
        for (const issue of audit.issues) {
          console.log(`   [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.item}`);
        }
      }
      break;
    }

    case 'sync': {
      console.log('Sync command not yet implemented.');
      console.log('Planned: canonical store management with symlink dry-run/apply/restore.');
      break;
    }

    default: {
      console.log('Usage: node dist/index.js [scan|audit|sync]');
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
