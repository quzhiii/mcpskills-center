import * as toml from 'smol-toml';

export function stripBom(content: string): string {
  return content.replace(/^\uFEFF/, '');
}

export function parseJsonConfig<T>(content: string): T {
  try {
    return JSON.parse(stripBom(content)) as T;
  } catch (err) {
    throw new Error(`Could not parse JSON config: ${(err as Error).message}`);
  }
}

export function parseTomlConfig<T>(content: string): T {
  try {
    return toml.parse(stripBom(content)) as T;
  } catch (err) {
    throw new Error(`Could not parse TOML config: ${(err as Error).message}`);
  }
}
