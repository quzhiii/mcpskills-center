export type CliCommand = 'scan' | 'audit' | 'sync' | 'profile' | 'agents' | 'mcp' | 'matrix' | 'health' | 'governance' | 'governance-diff' | 'history' | 'route' | 'web' | 'help';

export interface CliOptions {
  dryRun: boolean;
  apply: boolean;
  confirm: boolean;
  canonicalDir?: string;
  restoreManifestPath?: string;
  subcommand?: string;
  profileName?: string;
  active: boolean;
  allowCommands: string[];
  timeoutMs: number;
}

export interface CliArgs {
  command: CliCommand;
  options: CliOptions;
}

export function parseCliArgs(argv: string[]): CliArgs {
  let command: CliCommand = 'scan';
  let dryRun = false;
  let apply = false;
  let confirm = false;
  let canonicalDir: string | undefined;
  let restoreManifestPath: string | undefined;
  let subcommand: string | undefined;
  let profileName: string | undefined;
  let active = false;
  const allowCommands: string[] = [];
  let timeoutMs = 3000;

  const args = [...argv];
  if (args.length > 0 && !args[0].startsWith('--')) {
    const candidate = args.shift() as string;
    command = isCliCommand(candidate) ? candidate : 'help';
  }

  if (command === 'profile' || command === 'agents' || command === 'mcp') {
    subcommand = args.shift();
    profileName = args[0] && !args[0].startsWith('--') ? args.shift() : undefined;
  }

  if (command === 'route') {
    profileName = args.filter(a => !a.startsWith('--')).join(' ') || undefined;
  }

  if (command === 'web') {
    profileName = args.filter(a => !a.startsWith('--')).shift();
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--dry-run':
        dryRun = true;
        break;
      case '--canonical-dir':
        canonicalDir = args[++i];
        break;
      case '--apply':
        apply = true;
        break;
      case '--confirm':
        confirm = true;
        break;
      case '--restore':
        restoreManifestPath = args[++i];
        break;
      case '--active':
        active = true;
        break;
      case '--allow-command':
        allowCommands.push(args[++i]);
        break;
      case '--timeout': {
        const parsed = Number(args[++i]);
        if (Number.isFinite(parsed) && parsed > 0) timeoutMs = parsed;
        break;
      }
      default:
        break;
    }
  }

  return {
    command,
    options: {
      dryRun,
      apply,
      confirm,
      canonicalDir,
      restoreManifestPath,
      subcommand,
      profileName,
      active,
      allowCommands,
      timeoutMs,
    },
  };
}

function isCliCommand(value: string): value is CliCommand {
  return value === 'scan' || value === 'audit' || value === 'sync' || value === 'profile'
      || value === 'agents' || value === 'mcp' || value === 'matrix' || value === 'health'
      || value === 'governance' || value === 'governance-diff' || value === 'history' || value === 'route' || value === 'web' || value === 'help';
}
