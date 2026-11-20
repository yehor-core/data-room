/** Where file content lives. The path format is the adapter's business: callers keep the path put() returns. */
export interface FileStorage {
  put(object: { name: string; content: Buffer; contentType: string }): Promise<string>;
  signedUrl(path: string, expiresInSeconds: number): Promise<string>;
  remove(paths: string[]): Promise<void>;
}

export interface Identity {
  email: string;
  name: string | null;
}

export interface TokenVerifier {
  /** The identity the token was issued to, or null when the token is not valid. */
  verify(token: string): Promise<Identity | null>;
}
