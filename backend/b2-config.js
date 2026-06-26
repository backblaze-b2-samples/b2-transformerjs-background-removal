import { S3Client } from '@aws-sdk/client-s3';

const B2_S3_ENDPOINT_HOST_PATTERN = /^s3\.([a-z0-9-]+)\.backblazeb2\.com$/i;
const B2_REGION_PATTERN = /^[a-z]{2}(?:-[a-z]+)+-\d{3}$/;

export const SAMPLE_USER_AGENT = 'b2ai-transformersjs (backblaze-b2-samples)';

function readEnv(name) {
  return Object.prototype.hasOwnProperty.call(process.env, name) ? process.env[name].trim() : undefined;
}

function getEnvValue(name, legacyName) {
  const value = readEnv(name);
  return value === undefined ? readEnv(legacyName) : value;
}

function getRegionFromEndpoint(endpoint) {
  if (!endpoint) {
    return undefined;
  }

  try {
    const { hostname } = new URL(endpoint);
    const match = hostname.match(B2_S3_ENDPOINT_HOST_PATTERN);
    return match?.[1];
  } catch {
    return undefined;
  }
}

export function getB2S3Config() {
  const applicationKeyId = getEnvValue('B2_APPLICATION_KEY_ID', 'B2_KEY_ID');
  const applicationKey = getEnvValue('B2_APPLICATION_KEY', 'B2_APP_KEY');
  const bucketName = getEnvValue('B2_BUCKET_NAME', 'B2_BUCKET');
  const configuredRegion = readEnv('B2_REGION');
  const region = configuredRegion === undefined ? getRegionFromEndpoint(readEnv('B2_ENDPOINT')) : configuredRegion;

  const missing = [];
  if (!applicationKeyId) missing.push('B2_APPLICATION_KEY_ID');
  if (!applicationKey) missing.push('B2_APPLICATION_KEY');
  if (!bucketName) missing.push('B2_BUCKET_NAME');
  if (!region) missing.push('B2_REGION');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (!B2_REGION_PATTERN.test(region)) {
    throw new Error(`Invalid environment variables: B2_REGION`);
  }

  return {
    applicationKeyId,
    applicationKey,
    bucketName,
    region,
    endpoint: `https://s3.${region}.backblazeb2.com`,
  };
}

export function createB2S3Client(config = getB2S3Config()) {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.applicationKeyId,
      secretAccessKey: config.applicationKey,
    },
    forcePathStyle: true,
    customUserAgent: SAMPLE_USER_AGENT,
  });
}
