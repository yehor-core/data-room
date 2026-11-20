// Runs before every test file (imported by setupTests.ts).
import { runInThisContext } from 'vm';
import { API_URL, SUPABASE_URL } from './urls';

// The jsdom environment of CRA's Jest 27 has no Fetch API streams, and CRA replaces fetch/Request/Response with
// an XHR-based polyfill. MSW and supabase-js need the real ones, so they are taken from Node's own global object
// (`runInThisContext` evaluates in Node's main context, not in the jsdom one).
const nodeGlobal = runInThisContext('globalThis') as typeof globalThis;
const fromNode = [
  'TextEncoder',
  'TextDecoder',
  'ReadableStream',
  'TransformStream',
  'WritableStream',
  'structuredClone',
  'fetch',
  'Request',
  'Response',
  'Headers',
  'FormData',
  'Blob',
  'File',
] as const;
for (const name of fromNode) {
  Object.defineProperty(globalThis, name, {
    value: nodeGlobal[name],
    writable: true,
    configurable: true,
  });
}

// MSW and supabase-js open BroadcastChannels. Node's would keep Jest from exiting unless unref'd.
class UnrefBroadcastChannel extends (nodeGlobal.BroadcastChannel as typeof BroadcastChannel) {
  constructor(name: string) {
    super(name);
    (this as unknown as { unref(): void }).unref();
  }
}
globalThis.BroadcastChannel = UnrefBroadcastChannel;

// Browser APIs that jsdom lacks and Radix menus and dialogs call.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;
Element.prototype.scrollIntoView = () => {};
Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => {};

process.env.REACT_APP_API_URL = API_URL;
process.env.REACT_APP_SUPABASE_URL = SUPABASE_URL;
process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-anon-key';
