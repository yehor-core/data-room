import { randomUUID } from 'node:crypto';
import { inspect } from 'node:util';
import type { Logger } from '../src/lib/logger';
import type { FileStorage, Identity, TokenVerifier } from '../src/ports';

interface StoredObject {
  content: Buffer;
  contentType: string;
}

export class InMemoryStorage implements FileStorage {
  readonly objects = new Map<string, StoredObject>();
  /** Runs inside put() before the object is stored, so a test can hold an upload mid-flight. */
  beforePut?: () => Promise<void>;
  failRemove = false;

  async put({ content, contentType }: { name: string; content: Buffer; contentType: string }) {
    await this.beforePut?.();
    const path = `objects/${randomUUID()}`;
    this.objects.set(path, { content, contentType });
    return path;
  }

  async signedUrl(path: string, expiresInSeconds: number) {
    if (!this.objects.has(path)) throw new Error(`No object at ${path}`);
    return `https://storage.test/${path}?expires=${Date.now() + expiresInSeconds * 1000}`;
  }

  async remove(paths: string[]) {
    if (this.failRemove) throw new Error('Storage is unavailable');
    for (const path of paths) this.objects.delete(path);
  }

  /** The stored object a signed URL from this adapter points at. */
  objectAt(url: string) {
    return this.objects.get(new URL(url).pathname.slice(1));
  }
}

export class FakeTokenVerifier implements TokenVerifier {
  private readonly identities = new Map<string, Identity>();
  calls = 0;

  issue(identity: Identity) {
    const token = `token-${randomUUID()}`;
    this.identities.set(token, identity);
    return token;
  }

  async verify(token: string) {
    this.calls += 1;
    return this.identities.get(token) ?? null;
  }
}

/** A logger that keeps every line it is given, rendered the way a log sink would print it. */
export function capturingLogger() {
  const lines: string[] = [];
  const logger: Logger = {
    info: (message) => lines.push(message),
    error: (message, error) => lines.push(`${message} ${inspect(error, { depth: 5 })}`),
  };
  return { logger, lines };
}
