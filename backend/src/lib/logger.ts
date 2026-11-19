/** The only way backend code writes logs. Never pass emails, tokens or session contents to it. */
export interface Logger {
  info(message: string): void;
  error(message: string, error?: unknown): void;
}

export const logger: Logger = {
  info: (message) => console.log(message),
  error: (message, error) => console.error(message, error),
};
