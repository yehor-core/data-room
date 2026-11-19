export default async function globalTeardown() {
  await globalThis.testDatabase?.stop();
}
