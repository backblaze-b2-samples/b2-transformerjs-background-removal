import express from 'express';
import cors from 'cors';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupCORS } from './setup-cors.js';
import { createB2S3Client, getB2S3Config } from './b2-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

let b2Config;

try {
  b2Config = getB2S3Config();
} catch (error) {
  console.error('❌ Missing or invalid B2 configuration!');
  console.error(error.message);
  console.error('Copy .env.example to .env and fill in your B2 credentials.');
  process.exit(1);
}

const s3Client = createB2S3Client(b2Config);
const BUCKET = b2Config.bucketName;
const URL_EXPIRY = 3600; // 1 hour
const AUTO_SETUP_CORS = process.env.AUTO_SETUP_CORS !== 'false';
const MAX_UPLOAD_TOKEN_LENGTH = 256;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getObjectKeyFromFilename(fileId, filename) {
  const extension = path.extname(filename || '').slice(1).toLowerCase() || 'jpg';
  return `images/${fileId}.${extension}`;
}

function signUploadToken(fileId, expiresAt) {
  return createHmac('sha256', b2Config.applicationKey)
    .update(`${fileId}.${expiresAt}`)
    .digest('base64url');
}

function createUploadToken(fileId) {
  const expiresAt = Date.now() + URL_EXPIRY * 1000;
  const signature = signUploadToken(fileId, expiresAt);
  return `${fileId}.${expiresAt}.${signature}`;
}

function isTimingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function validateUploadToken(fileId, uploadToken) {
  if (!UUID_PATTERN.test(fileId || '')) {
    return { ok: false, status: 400, message: 'Invalid fileId' };
  }

  if (typeof uploadToken !== 'string' || uploadToken.length > MAX_UPLOAD_TOKEN_LENGTH) {
    return { ok: false, status: 403, message: 'Invalid upload token' };
  }

  const [tokenFileId, expiresAt, signature, extra] = uploadToken.split('.');
  const expiresAtMs = Number(expiresAt);

  if (extra || tokenFileId !== fileId || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return { ok: false, status: 403, message: 'Invalid upload token' };
  }

  const expectedSignature = signUploadToken(fileId, expiresAt);
  if (!isTimingSafeEqual(signature || '', expectedSignature)) {
    return { ok: false, status: 403, message: 'Invalid upload token' };
  }

  return { ok: true };
}

async function getSignedReadUrl(key) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: URL_EXPIRY });
}

// Generate pre-signed PUT URL for image upload
app.post('/api/presign-image', async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    const fileId = randomUUID();
    const key = getObjectKeyFromFilename(fileId, filename);

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType || 'image/jpeg',
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: URL_EXPIRY });
    const publicUrl = await getSignedReadUrl(key);

    res.json({
      uploadUrl,
      publicUrl,
      key,
      fileId,
      uploadToken: createUploadToken(fileId),
    });
  } catch (error) {
    console.error('Error generating image presigned URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate pre-signed PUT URL for cutout (background-removed) image upload
app.post('/api/presign-cutout', async (req, res) => {
  try {
    const { fileId, uploadToken } = req.body;
    const tokenValidation = validateUploadToken(fileId, uploadToken);

    if (!tokenValidation.ok) {
      return res.status(tokenValidation.status).json({ error: tokenValidation.message });
    }

    const key = `cutouts/${fileId}_cutout.png`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: 'image/png',
      IfNoneMatch: '*',
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: URL_EXPIRY });
    const publicUrl = await getSignedReadUrl(key);

    res.json({
      uploadUrl,
      publicUrl,
      key
    });
  } catch (error) {
    console.error('Error generating cutout presigned URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;

// Auto-setup CORS on startup
async function startServer() {
  if (AUTO_SETUP_CORS) {
    console.log('🔍 Checking B2 CORS configuration...');
    try {
      await setupCORS(true);
      console.log('✅ B2 CORS is configured');
    } catch (error) {
      if (error.Code === 'InvalidRequest' && error.message.includes('B2 Native CORS rules')) {
        console.warn('\n⚠️  Your bucket has B2 Native CORS rules (not S3 API rules)');
        console.warn('   You need to manually update CORS in B2 Web Console:\n');
        console.warn('   1. Go to: https://secure.backblaze.com/b2_buckets.htm');
        console.warn('   2. Click on your bucket → Bucket Settings');
        console.warn('   3. Find CORS Rules section');
        console.warn('   4. DELETE the existing B2 Native rule');
        console.warn('   5. Add NEW rule for "S3 Compatible API":');
        console.warn('      - Allowed Origins: *');
        console.warn('      - Allowed Operations: s3_get, s3_head, s3_put');
        console.warn('      - Allowed Headers: *');
        console.warn('      - Max Age: 3600');
        console.warn('   6. Save and restart this server\n');
      } else {
        console.warn('⚠️  Could not verify/setup CORS automatically');
        console.warn('   Error:', error.message);
      }
    }
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 Server running!`);
    console.log(`\n   Open: http://localhost:${PORT}`);
    console.log(`   API:  http://localhost:${PORT}/api`);
    console.log('\n📝 Next steps:');
    console.log('   1. Visit http://localhost:' + PORT);
    console.log('   2. Upload an image file');
    console.log('   3. Click "Remove Background with RMBG-1.4"\n');
    console.log('⚠️  IMPORTANT: Do NOT open index.html directly!');
    console.log('   Use the URL above to avoid CORS issues.\n');
  });
}

startServer();
