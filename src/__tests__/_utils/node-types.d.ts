/**
 * Minimal Node.js type shims for test files that use fs/path utilities.
 *
 * @types/node is not a project dependency (this is a browser app), but some
 * tests scan the source tree at compile-time (e.g. no-browser-tz.test.ts) and
 * need fs/path types. These minimal declarations satisfy tsc --noEmit without
 * touching tsconfig.json or adding @types/node project-wide.
 */

declare module 'node:fs' {
  export function readdirSync(path: string): string[];
  export function readFileSync(path: string, encoding: BufferEncoding): string;
  export function statSync(path: string): { isDirectory(): boolean };
}

declare module 'node:path' {
  export function join(...paths: string[]): string;
  export function relative(from: string, to: string): string;
  export function dirname(path: string): string;
  export function resolve(...paths: string[]): string;
}

declare const __dirname: string;
declare const __filename: string;
