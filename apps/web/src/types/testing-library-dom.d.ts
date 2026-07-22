/**
 * Shim for @testing-library/dom peer dependency
 * @testing-library/react v16 exports waitFor from @testing-library/dom
 * but the peer dep may not be installed in all environments.
 */
declare module '@testing-library/dom' {
  export function waitFor<T>(
    callback: () => T | Promise<T>,
    options?: { timeout?: number; interval?: number }
  ): Promise<T>;
}
