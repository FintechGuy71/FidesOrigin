/**
 * KMS Signer Index — Factory exports for FidesOrigin
 *
 * Usage:
 *   import { createSigner, KmsSigner } from '@fidesorigin/shared/kms';
 *
 *   // AWS KMS (production)
 *   const signer = await createSigner({
 *     provider: 'aws',
 *     awsKeyId: 'arn:aws:kms:us-east-1:123456789:key/abc123',
 *     awsRegion: 'us-east-1',
 *     providerInstance: ethersProvider,
 *   });
 *
 *   // Local fallback (development only)
 *   const signer = await createSigner({
 *     provider: 'local',
 *     localPrivateKey: '0x...',
 *     providerInstance: ethersProvider,
 *   });
 *
 *   // Or via environment variables:
 *   // KMS_PROVIDER=aws AWS_KMS_KEY_ID=... AWS_REGION=...
 *   // const signer = await createSigner();
 */

export { KmsSigner, LocalSigner, createSigner, createLocalSigner } from './KmsSigner';
export type { KmsSignerConfig, KmsProvider } from './KmsSigner';
