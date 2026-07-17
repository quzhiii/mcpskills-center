import type { CliArgs } from '../cli.js';
import { renderHelp } from './commands.js';
import type { DefaultPaths } from '../config/paths.js';
import { initializeUserConfig, resolveEffectiveConfigPaths, type InitResult } from '../config/user-config.js';
import { validateConfiguration, type ConfigDiagnostic } from '../config/validate.js';
import { DEFAULT_AGENTS } from '../scanner/index.js';
import { renderDoctorReport, runDoctor } from '../doctor/index.js';

export async function executeSetupCommand(cli: CliArgs, paths: DefaultPaths): Promise<string | null> {
  if (cli.command === 'help') return renderHelp();

  if (cli.command === 'init') {
    const result = await initializeUserConfig(paths, {
      dryRun: cli.options.dryRun,
      force: cli.options.force,
      confirm: cli.options.confirm,
    });
    return renderInitResult(result);
  }

  if (cli.command === 'config') {
    if (cli.options.subcommand === 'path') return renderConfigPaths(paths);
    if (cli.options.subcommand === 'validate') {
      const diagnostics = await validateConfiguration(paths, DEFAULT_AGENTS);
      const output = renderConfigDiagnostics(diagnostics);
      if (diagnostics.some(item => item.status === 'error')) throw new Error(output);
      return output;
    }
    return 'Usage: mcpskills config [path|validate]';
  }

  if (cli.command === 'doctor') {
    const report = await runDoctor(paths, {
      nodeVersion: process.version,
      defaultAgents: DEFAULT_AGENTS,
    });
    const output = renderDoctorReport(report);
    if (report.diagnostics.some(item => item.status === 'error')) throw new Error(output);
    return output;
  }

  return null;
}

async function renderConfigPaths(paths: DefaultPaths): Promise<string> {
  const effective = await resolveEffectiveConfigPaths(paths);
  return [
    'Configuration paths:',
    `   user config: ${paths.userConfigDir}`,
    `   agents [${effective.agents.source}]: ${effective.agents.path ?? '(code defaults)'}`,
    `   sync [${effective.sync.source}]: ${effective.sync.path ?? '(generated defaults)'}`,
    `   profiles [${effective.profiles.source}]: ${effective.profiles.path}`,
    `   routing [${effective.routingPolicy.source}]: ${effective.routingPolicy.path}`,
    `   canonical skills: ${paths.canonicalSkillsDir}`,
    `   data: ${paths.dataDir}`,
  ].join('\n');
}

function renderInitResult(result: InitResult): string {
  return [
    result.dryRun ? 'User configuration initialization plan:' : 'User configuration initialized:',
    ...result.entries.map(entry => `   [${entry.action.toUpperCase()}] ${entry.path}`),
    '',
    result.dryRun
      ? 'No files were written.'
      : 'Next: run mcpskills config validate, then mcpskills doctor.',
  ].join('\n');
}

export function renderConfigDiagnostics(diagnostics: ConfigDiagnostic[]): string {
  return [
    'Configuration validation:',
    ...diagnostics.map(item => {
      const remediation = item.remediation ? ` Fix: ${item.remediation}` : '';
      return `   [${item.status.toUpperCase()}] ${item.message}${remediation}`;
    }),
  ].join('\n');
}
