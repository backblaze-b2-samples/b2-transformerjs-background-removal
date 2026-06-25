import { S3Client } from '@aws-sdk/client-s3';

const REQUIRED_ENV_VARS = [
  'B2_APPLICATION_KEY_ID',
  'B2_APPLICATION_KEY',
  'B2_BUCKET_NAME',
  'B2_REGION',
  'B2_PUBLIC_URL_BASE',
];

export const SAMPLE_USER_AGENT = 'b2ai-transformersjs (backblaze-b2-samples)';

export function getB2Config() {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    applicationKeyId: process.env.B2_APPLICATION_KEY_ID,
    applicationKey: process.env.B2_APPLICATION_KEY,
    bucketName: process.env.B2_BUCKET_NAME,
    region: process.env.B2_REGION,
    publicUrlBase: process.env.B2_PUBLIC_URL_BASE.replace(/\/+$/, ''),
  };
}

export function createB2S3Client(config = getB2Config()) {
  return new S3Client({
    endpoint: `https://s3.${config.region}.backblazeb2.com`,
    region: config.region,
    credentials: {
      accessKeyId: config.applicationKeyId,
      secretAccessKey: config.applicationKey,
    },
    forcePathStyle: true,
    customUserAgent: SAMPLE_USER_AGENT,
  });
}

export function getPublicObjectUrl(publicUrlBase, key) {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `${publicUrlBase}/${encodedKey}`;
}
