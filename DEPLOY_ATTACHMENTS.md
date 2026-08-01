# File Attachments + AI Parsing — Deployment Steps

## 1. Create Cloudinary Account

1. Go to https://cloudinary.com and sign up (free tier: 25 GB storage, 25 GB bandwidth/month)
2. From the Dashboard, copy:
   - Cloud Name
   - API Key
   - API Secret

## 2. Get Gemini API Key

1. Go to https://aistudio.google.com/apikey
2. Create a new API key (free tier: 15 RPM, 1M tokens/day)

## 3. Add Environment Variables to Server

SSH into the server and append to the glycofit `.env`:

```bash
ssh claude-bot
# IMPORTANT: append, do NOT overwrite the file
cat >> /home/deploy/apps/glycofit/.env << 'EOF'
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
GEMINI_API_KEY=your_gemini_key
EOF
```

Also add the same vars to your local `.env.local` for dev testing.

## 4. Run Database Migration

On the server:

```bash
ssh claude-bot
cd /home/deploy/apps/glycofit
DATABASE_URL=postgresql://insulin_tracker:whdJFH760XtEdQAENCXShqMLMS3n42D0@127.0.0.1:5432/insulin_tracker npx node-pg-migrate up -m src/db/migrations
```

This creates two new tables:
- `checkup_attachments` — stores Cloudinary file references
- `checkup_parsed_results` — stores AI-parsed structured data

## 5. Deploy

Push to `main` to trigger CI/CD, or run manually:

```bash
./deploy.sh
```

After deploy, restart PM2 so the new env vars are picked up:

```bash
ssh claude-bot 'cd /home/deploy/apps/glycofit && pm2 restart glycofit --update-env && pm2 save'
```

## 6. Verify

1. Log in as a patient, go to Seguimiento, open any checkup
2. Click "Registrar nueva visita", attach a photo of a lab result, save
3. Check the history — the attachment should appear with a clip icon
4. Click the clip icon — after a few seconds, parsed lab values should appear
5. Log in as the patient's doctor, navigate to the patient, go to Seguimiento
6. Click "Ver historial" on the same checkup — verify attachments and parsed data show up
7. Check Cloudinary dashboard to confirm files were uploaded to `glycofit/checkups/` folder

## Notes

- Max 10 files per completion, 10 MB each
- Accepted types: JPEG, PNG, WebP, HEIC, PDF
- AI parsing happens async (fire-and-forget after upload)
- If parsing fails, both patient and doctor can click "Reintentar"
- Gemini 2.5 Flash costs ~$0.002 per document parsed
