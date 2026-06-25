# AI Image Background Removal in the Browser with RMBG-1.4, Transformers.js, and Backblaze B2

A JavaScript example app that removes image backgrounds entirely in the browser using the [RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) image segmentation model and [Transformers.js](https://huggingface.co/docs/transformers.js) — no server GPU or cloud inference API required. Original images and transparent PNG cutouts are stored in [Backblaze B2](https://www.backblaze.com/b2/cloud-storage.html?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=imagesamples) cloud storage.

Upload a photo (JPG, PNG, WEBP, GIF, BMP), remove its background client-side with one click, and save both the original and the transparent cutout to S3-compatible Backblaze B2 object storage. Inference runs via WebGPU with an automatic WebAssembly (WASM) fallback.

![Screenshot showing before/after background removal](docs/background-removal-example.png)

## Why Client-Side Background Removal?

- **No GPU server costs** — the RMBG-1.4 model runs in your browser via WebGPU/WASM, so there's no inference server to pay for
- **Privacy** — images never leave the user's device for processing
- **No API rate limits** — process as many images as you want, completely offline after the model loads
- **Simple to deploy** — a static frontend + a lightweight Node.js backend for pre-signed URLs is all you need

## Technologies

- **[Transformers.js](https://huggingface.co/docs/transformers.js)** — Run Hugging Face AI models in the browser with WebGPU and WebAssembly
- **[RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4)** — State-of-the-art background removal model for image segmentation by BRIA AI
- **[Backblaze B2](https://www.backblaze.com/b2/cloud-storage.html?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=imagesamples)** — S3-compatible cloud object storage at $6/TB/month

## What This Demonstrates

- **Client-side AI image segmentation**: Run RMBG-1.4 background removal entirely in the browser — no server GPU required
- **WebGPU-accelerated inference**: Hardware-accelerated ML inference with automatic WASM fallback
- **Cost-effective cloud storage**: Store original images and transparent PNG cutouts in Backblaze B2
- **Secure direct uploads**: Browser-to-cloud uploads using S3 pre-signed URLs
- **Simple architecture**: End-to-end flow from upload → remove background → store

## Architecture

```
User → Upload Image → B2 Storage
                    ↓
Browser RMBG-1.4 Inference (Transformers.js) → Remove Background
                    ↓
      Cutout Image → B2 Storage
```

### Flow

1. User selects/drops image file in browser
2. Backend generates pre-signed PUT URL for B2
3. Browser uploads original image directly to B2
4. Browser loads **RMBG-1.4** model via **Transformers.js** (briaai/RMBG-1.4)
5. Browser performs **client-side inference** to remove background
6. Browser generates transparent PNG cutout
7. Backend generates pre-signed PUT URL for processed image
8. Browser uploads background-removed cutout to B2

## Use Cases

- **E-commerce product photos** — Remove backgrounds from product images for clean listings
- **Profile pictures** — Automatic portrait cutouts for avatars and headshots
- **Design and marketing** — Create transparent PNG assets without Photoshop or paid APIs
- **Real estate** — Clean up property photos for listings
- **Fashion** — Isolate models and clothing on transparent backgrounds

## Quick Start

### Prerequisites

- **Node.js 18+**
- **[Backblaze B2 Account](https://www.backblaze.com/sign-up/cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=imagesamples)** (free tier available)
  - Create a bucket
  - Generate an Application Key with `readFiles`, `writeFiles`, `writeBuckets` permissions

### 1. Clone & Install

```bash
git clone https://github.com/backblaze-b2-samples/b2-transformerjs-background-removal.git
cd b2-transformerjs-background-removal/backend
npm install
```

### 2. Configure B2 Credentials

```bash
cp .env.example .env
```

Edit `.env` with your [B2 credentials](https://www.backblaze.com/b2/docs/quick_account.html?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=imagesamples):

```env
B2_APPLICATION_KEY_ID=your_application_key_id_here
B2_APPLICATION_KEY=your_application_key_here
B2_BUCKET_NAME=your-bucket-name
B2_REGION=your-bucket-region
B2_PUBLIC_URL_BASE=https://f000.backblazeb2.com/file/your-bucket-name
```

> Get your B2 region and public URL base from your [bucket details page](https://secure.backblaze.com/b2_buckets.htm?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=imagesamples)

### 3. Start the App

```bash
npm start
```

**That's it!** The server automatically:
- ✅ Configures B2 CORS for browser uploads
- ✅ Serves both frontend and API
- ✅ Opens at `http://localhost:3000`

### 4. Use the App

1. Open **http://localhost:3000** in your browser
2. Upload an image file (JPG, PNG, WEBP)
3. Click **"Remove Background with RMBG-1.4"**
4. View before/after comparison and access files in B2

> ⚠️ First run downloads the **RMBG-1.4 model** (~176MB) - this takes 2-3 minutes

## Technical Details

### Background Removal Model

This example uses [RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) by BRIA AI, a state-of-the-art image segmentation model optimized for background removal. It runs in the browser via Transformers.js with WebGPU acceleration and an automatic WebAssembly fallback for broader browser support.

- **Model**: [briaai/RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) — background removal / image segmentation
- **Library**: [Transformers.js](https://huggingface.co/docs/transformers.js) — Run Hugging Face transformer models in the browser
- **Inference backend**: WebGPU (automatic WASM fallback)
- **Model size**: ~176MB (cached in browser after first download)
- **Speed**: ~2-5 seconds per image (varies by resolution and GPU)
- **Output**: PNG with alpha transparency

### Transformers.js Integration

This example demonstrates client-side transformer model inference using the Transformers.js library:

```javascript
import { AutoModel, AutoProcessor, RawImage } from '@huggingface/transformers';

// Load RMBG-1.4 model for background removal
const model = await AutoModel.from_pretrained('briaai/RMBG-1.4', {
  device: 'webgpu',
});
const processor = await AutoProcessor.from_pretrained('briaai/RMBG-1.4');

// Run inference on image
const image = await RawImage.fromURL(imageUrl);
const { pixel_values } = await processor(image);
const { output } = await model({ input: pixel_values });
```

### Storage

- **Provider**: [Backblaze B2](https://www.backblaze.com/b2/cloud-storage.html?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=imagesamples)
- **API**: S3-compatible API with pre-signed URLs
- **Pricing**: $6/TB/month storage, uploads are FREE
- **Documentation**: [B2 S3-Compatible API Docs](https://www.backblaze.com/b2/docs/s3_compatible_api.html?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=imagesamples)

### Supported Image Formats

**Input**: JPG, PNG, WEBP, GIF, BMP
**Output**: PNG with alpha transparency

### Browser Compatibility

- Chrome 113+ (WebGPU support)
- Edge 113+
- Opera 99+
- Safari 18+ (WebGPU experimental)
- Firefox (WASM fallback, no WebGPU yet)

Requires WebAssembly and ES6 modules support.

## Manual CORS Setup

If auto-setup fails (missing permissions), run manually:

```bash
npm run setup-cors
```

**Required B2 Key Permissions**:
- `listBuckets`
- `readFiles`
- `writeFiles`
- `writeBuckets` ← Required for CORS setup

**Alternative - B2 CLI**:

```bash
b2 update-bucket --cors-rules '[
  {
    "corsRuleName": "allowBrowserUploads",
    "allowedOrigins": ["*"],
    "allowedHeaders": ["*"],
    "allowedOperations": ["s3_put", "s3_get", "s3_head"],
    "maxAgeSeconds": 3600
  }
]' <bucket-name> allPublic
```

**Alternative - B2 Web Console**:
1. Go to [https://secure.backblaze.com/b2_buckets.htm](https://secure.backblaze.com/b2_buckets.htm?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=imagesamples)
2. Click your bucket → Bucket Settings → CORS Rules
3. Add the rules shown above

## API Endpoints

### POST /api/presign-image

Request:
```json
{
  "filename": "photo.jpg",
  "contentType": "image/jpeg"
}
```

Response:
```json
{
  "uploadUrl": "https://...",
  "publicUrl": "https://...",
  "key": "images/uuid.jpg",
  "fileId": "uuid"
}
```

### POST /api/presign-cutout

Request:
```json
{
  "fileId": "uuid"
}
```

Response:
```json
{
  "uploadUrl": "https://...",
  "publicUrl": "https://...",
  "key": "cutouts/uuid_cutout.png"
}
```

## Deployment

### Deploy Backend

**Railway / Render / Fly.io**:
- Set environment variables from `.env`
- Deploy `backend/` directory
- Update frontend `apiUrl` to deployed URL

**Docker**:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
CMD ["node", "server.js"]
```

### Deploy Frontend

**Static Hosting** (Netlify, Vercel, Cloudflare Pages):
- Deploy `frontend/` directory
- Set API URL in settings or hardcode in HTML

**B2 Static Hosting**:
- Upload `frontend/index.html` to B2 bucket
- Enable website hosting on bucket
- Access via B2 website URL

## Limitations

- First load downloads model (~176MB, one-time)
- Processing time depends on image resolution
- Browser must stay open during inference
- Very large images (>4K) may be slow
- WebGPU not yet supported in Firefox (uses slower WASM)

## Potential Improvements

- [ ] Add batch processing for multiple images
- [ ] Support custom background colors/images
- [ ] Add edge refinement controls
- [ ] Progressive rendering for large images
- [ ] Download button for processed images
- [ ] Comparison slider for before/after
- [ ] Try alternative models (U2-Net, MODNet)
- [ ] Add WebWorker for non-blocking inference

## Related Resources

- **[Transformers.js Documentation](https://huggingface.co/docs/transformers.js)** — Run Hugging Face AI models in the browser with WebGPU and WebAssembly
- **[Transformers.js GitHub](https://github.com/xenova/transformers.js)** — Source code and examples
- **[RMBG-1.4 Model Card](https://huggingface.co/briaai/RMBG-1.4)** — Background removal image segmentation model by BRIA AI
- **[Backblaze B2 Documentation](https://www.backblaze.com/b2/docs/?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=imagesamples)** — Cloud storage API docs
- **[B2 S3-Compatible API](https://www.backblaze.com/b2/docs/s3_compatible_api.html?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=imagesamples)** — Use standard S3 SDKs with Backblaze B2
- **[WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)** — Browser GPU acceleration for ML inference

## Troubleshooting

### CORS Error: "Access to fetch has been blocked by CORS policy"

**Problem**: Browser shows CORS error when uploading.

**Solution**:
1. Run `npm run setup-cors` in the backend directory
2. Or manually configure CORS on your B2 bucket (see Setup section)
3. Verify CORS is set: Go to B2 Console → Your Bucket → Settings → CORS Rules

### Model Loading is Slow

**Problem**: First run takes a long time.

**Solution**:
- RMBG-1.4 is ~176MB and downloads on first use
- Model is cached by browser for subsequent uses
- Try using faster internet connection
- Check browser console for download progress

### WebGPU Not Available

**Problem**: Browser doesn't support WebGPU.

**Solution**:
- Use Chrome 113+, Edge 113+, or Opera 99+
- Firefox will fall back to WASM (slower but works)
- Update browser to latest version
- Check chrome://gpu to verify WebGPU status

### Backend Connection Error

**Problem**: Frontend can't connect to backend API.

**Solution**:
1. Verify backend is running: `curl http://localhost:3000/health`
2. Check API URL in frontend matches backend (default: `http://localhost:3000`)
3. Look for CORS errors in backend logs

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
