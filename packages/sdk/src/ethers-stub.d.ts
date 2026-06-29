/**
 * Stub type declarations for ethers (minimal subset used by SDK)
 * This is a temporary measure for compile verification.
 * Production builds should install ethers: npm install ethers@^6.13.5
 */

declare module "ethers" {
  export function isAddress(address: string): boolean;
  export function getAddress(address: string): string;

  export class Contract {
    constructor(address: string, abi: any, runner: any);
    [method: string]: any;
    on(event: string, callback: (...args: any[]) => void): void;
    off(event: string, callback: (...args: any[]) => void): void;
    removeAllListeners(): void;
  }

  export class JsonRpcProvider implements Provider {
    constructor(url?: string);
    getCode(address: string): Promise<string>;
    getNetwork(): Promise<{ chainId: bigint }>;
  }

  export interface Provider {
    getCode(address: string): Promise<string>;
    getNetwork(): Promise<{ chainId: bigint }>;
  }

  export interface Signer {
    getAddress(): Promise<string>;
    signMessage(message: string): Promise<string>;
  }

  export function encodeBytes32String(text: string): string;
  export function decodeBytes32String(bytes: string): string;
  export function decodeBytes32String(bytes: any): string;
}
