import assert from 'node:assert/strict';
import test from 'node:test';
import { getB2S3Config } from '../b2-config.js';

const B2_ENV_KEYS = [
  'B2_APPLICATION_KEY_ID',
  'B2_APPLICATION_KEY',
  'B2_BUCKET_NAME',
  'B2_REGION',
  'B2_ENDPOINT',
  'B2_KEY_ID',
  'B2_APP_KEY',
  'B2_BUCKET',
];

function withB2Env(values, fn) {
  const previous = new Map(B2_ENV_KEYS.map((key) => [key, process.env[key]]));

  for (const key of B2_ENV_KEYS) {
    delete process.env[key];
  }

  Object.assign(process.env, values);

  try {
    fn();
  } finally {
    for (const key of B2_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('derives the B2 S3 endpoint from a canonical two-letter region', () => {
  withB2Env(
    {
      B2_APPLICATION_KEY_ID: 'key-id',
      B2_APPLICATION_KEY: 'app-key',
      B2_BUCKET_NAME: 'bucket',
      B2_REGION: 'us-west-004',
    },
    () => {
      assert.deepEqual(getB2S3Config(), {
        applicationKeyId: 'key-id',
        applicationKey: 'app-key',
        bucketName: 'bucket',
        region: 'us-west-004',
        endpoint: 'https://s3.us-west-004.backblazeb2.com',
      });
    },
  );
});

test('derives B2_REGION from legacy B2_ENDPOINT only when region is unset', () => {
  withB2Env(
    {
      B2_APPLICATION_KEY_ID: 'key-id',
      B2_APPLICATION_KEY: 'app-key',
      B2_BUCKET_NAME: 'bucket',
      B2_ENDPOINT: 'https://s3.us-west-004.backblazeb2.com',
    },
    () => {
      assert.equal(getB2S3Config().region, 'us-west-004');
    },
  );
});

test('rejects regions whose leading segment is not two lowercase letters', () => {
  withB2Env(
    {
      B2_APPLICATION_KEY_ID: 'key-id',
      B2_APPLICATION_KEY: 'app-key',
      B2_BUCKET_NAME: 'bucket',
      B2_REGION: 'usa-west-004',
    },
    () => {
      assert.throws(
        () => getB2S3Config(),
        /Invalid environment variables: B2_REGION/,
      );
    },
  );
});
