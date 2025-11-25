import express from 'express';
import cors from 'cors';
import { S3Client, PutObjectCommand, GetObjectCommand, GetBucketCorsCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupCORS } from './setup-cors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

const s3Client = new S3Client({
  endpoint: process.env.B2_ENDPOINT,
  region: process.env.B2_REGION || 'us-west-002',
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.B2_BUCKET;
const URL_EXPIRY = 3600; // 1 hour
const AUTO_SETUP_CORS = process.env.AUTO_SETUP_CORS !== 'false';

// Generate pre-signed PUT URL for image upload
app.post('/api/presign-image', async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    const fileId = randomUUID();
    const extension = filename.split('.').pop();
    const key = `images/${fileId}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType || 'image/jpeg',
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: URL_EXPIRY });

    // Generate pre-signed GET URL for reading
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });
    const publicUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: URL_EXPIRY });

    res.json({
      uploadUrl,
      publicUrl,
      key,
      fileId
    });
  } catch (error) {
    console.error('Error generating image presigned URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate pre-signed PUT URL for cutout (background-removed) image upload
app.post('/api/presign-cutout', async (req, res) => {
  try {
    const { fileId } = req.body;
    const key = `cutouts/${fileId}_cutout.png`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: 'image/png',
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: URL_EXPIRY });

    // Generate pre-signed GET URL for reading cutout
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });
    const publicUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: URL_EXPIRY });

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
    console.log('   3. Click "Remove Background with MODNET"\n');
    console.log('⚠️  IMPORTANT: Do NOT open index.html directly!');
    console.log('   Use the URL above to avoid CORS issues.\n');
  });
}

startServer();
