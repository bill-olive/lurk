import { Storage, type Bucket, type File } from '@google-cloud/storage';

// ---------------------------------------------------------------------------
// Google Cloud Storage helper for artifact content
// ---------------------------------------------------------------------------

const ARTIFACT_BUCKET = process.env.ARTIFACT_BUCKET ?? 'lurk-artifacts';
const UPLOAD_SIGNED_URL_EXPIRY = 15 * 60 * 1000; // 15 minutes
const DOWNLOAD_SIGNED_URL_EXPIRY = 60 * 60 * 1000; // 1 hour

let _storage: Storage | null = null;
let _bucket: Bucket | null = null;

function storage(): Storage {
  if (!_storage) {
    _storage = new Storage();
  }
  return _storage;
}

function bucket(): Bucket {
  if (!_bucket) {
    _bucket = storage().bucket(ARTIFACT_BUCKET);
  }
  return _bucket;
}

/**
 * Build the GCS object path for an artifact version.
 */
function artifactPath(orgId: string, artifactId: string, version: number): string {
  return `orgs/${orgId}/artifacts/${artifactId}/v${version}`;
}

/**
 * Upload artifact content to GCS.
 */
export async function uploadArtifactContent(
  orgId: string,
  artifactId: string,
  version: number,
  content: Buffer | string,
  contentType: string = 'application/octet-stream',
): Promise<{ gcsUri: string; contentHash: string }> {
  const path = artifactPath(orgId, artifactId, version);
  const file: File = bucket().file(path);

  const data = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;

  await file.save(data, {
    metadata: { contentType },
    resumable: false,
  });

  const crypto = await import('node:crypto');
  const contentHash = crypto.createHash('sha256').update(data).digest('hex');

  return {
    gcsUri: `gs://${ARTIFACT_BUCKET}/${path}`,
    contentHash,
  };
}

/**
 * Download artifact content from GCS.
 */
export async function downloadArtifactContent(
  orgId: string,
  artifactId: string,
  version: number,
): Promise<Buffer> {
  const path = artifactPath(orgId, artifactId, version);
  const file: File = bucket().file(path);
  const [data] = await file.download();
  return data;
}

/**
 * Generate a signed upload URL for direct client uploads.
 */
export async function generateUploadUrl(
  orgId: string,
  artifactId: string,
  version: number,
  contentType: string = 'application/octet-stream',
): Promise<string> {
  const path = artifactPath(orgId, artifactId, version);
  const file: File = bucket().file(path);

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + UPLOAD_SIGNED_URL_EXPIRY,
    contentType,
  });

  return url;
}

/**
 * Generate a signed download URL for artifact content.
 */
export async function generateDownloadUrl(
  orgId: string,
  artifactId: string,
  version: number,
): Promise<string> {
  const path = artifactPath(orgId, artifactId, version);
  const file: File = bucket().file(path);

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + DOWNLOAD_SIGNED_URL_EXPIRY,
  });

  return url;
}

/**
 * Delete artifact content from GCS.
 */
export async function deleteArtifactContent(
  orgId: string,
  artifactId: string,
  version: number,
): Promise<void> {
  const path = artifactPath(orgId, artifactId, version);
  const file: File = bucket().file(path);
  await file.delete({ ignoreNotFound: true });
}

/**
 * Delete all versions of an artifact from GCS.
 */
export async function deleteAllArtifactVersions(
  orgId: string,
  artifactId: string,
): Promise<void> {
  const prefix = `orgs/${orgId}/artifacts/${artifactId}/`;
  await bucket().deleteFiles({ prefix });
}

/**
 * Check if artifact content exists in GCS.
 */
export async function artifactContentExists(
  orgId: string,
  artifactId: string,
  version: number,
): Promise<boolean> {
  const path = artifactPath(orgId, artifactId, version);
  const file: File = bucket().file(path);
  const [exists] = await file.exists();
  return exists;
}
