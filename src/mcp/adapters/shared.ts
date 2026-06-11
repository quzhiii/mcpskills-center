export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function detectTransport(config: Record<string, unknown>): 'stdio' | 'http' | 'sse' | 'unknown' {
  if (typeof config.command === 'string' || Array.isArray(config.command)) return 'stdio';
  if (typeof config.url === 'string') {
    return config.url.includes('/sse') ? 'sse' : 'http';
  }
  return 'unknown';
}

export function extractCommand(config: Record<string, unknown>): string | undefined {
  if (typeof config.command === 'string') return config.command;
  if (Array.isArray(config.command) && config.command.length > 0 && typeof config.command[0] === 'string') {
    return config.command[0];
  }
  return undefined;
}

export function checkSensitiveEnv(config: Record<string, unknown>): boolean {
  const SENSITIVE_KEYS = ['api_key', 'apikey', 'token', 'secret', 'password', 'auth'];
  const env = {
    ...asRecord(config.env),
    ...asRecord(config.environment),
  };
  return Object.keys(env).some(key => SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s)));
}
