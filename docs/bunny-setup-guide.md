# Bunny.net Setup Guide — Life-Therapy

## What Bunny.net Does

Life-Therapy uses two Bunny.net services:

- **Bunny Stream** — Hosts and streams course videos (lecture videos + preview/intro videos). Videos are encoded at multiple resolutions (360p–1080p) and delivered globally via CDN.
- **Bunny Storage Zone + Pull Zone** — Hosts downloadable files (PDFs, worksheets, journals). Files are stored in a Storage Zone and served publicly through a CDN Pull Zone.

All uploads happen through the **Life-Therapy admin panel** — you never need to use the Bunny dashboard to upload content.

---

## Step 1: Create Your Bunny.net Account

1. Go to **bunny.net** and sign up
2. Use your Life-Therapy business email
3. Choose **Pay-as-you-go** (storage ~$0.01/GB/month, streaming ~$0.01/GB)
4. Add a payment method

---

## Step 2: Create a Storage Zone (for PDFs & worksheets)

1. In the Bunny dashboard, go to **Storage > Add Storage Zone**
2. Name: `life-therapy-files`
3. Main region: **EU (Frankfurt)** — good performance for South Africa
4. Click **Add Storage Zone**
5. Go to the Storage Zone settings and copy the **API Key** (Password)

### Connect a Pull Zone (CDN)

1. Go to **CDN > Add Pull Zone**
2. Name: `life-therapy-cdn`
3. Origin: select your `life-therapy-files` Storage Zone
4. Click **Add Pull Zone**
5. Note the CDN hostname: `life-therapy-cdn.b-cdn.net`

### Optional: Custom domain

1. In Pull Zone settings > **Hostnames**, add `cdn.life-therapy.co.za`
2. Add a CNAME DNS record: `cdn` pointing to your Pull Zone hostname
3. Enable **Free SSL** in Bunny

---

## Step 3: Create a Bunny Stream Library (for videos)

1. Go to **Stream > Create Video Library**
2. Name: `Life-Therapy Courses`
3. Region: **EU (Frankfurt)**
4. After creation, go to the library settings:
   - Copy the **Library ID** (number shown in the URL or settings)
   - Go to **API > API Key** and copy it

---

## Step 4: Add Environment Variables

Add these to your `.env.local` (local dev) and Vercel environment variables (production):

```env
# Bunny Storage Zone
BUNNY_STORAGE_ZONE_NAME=life-therapy-files
BUNNY_STORAGE_API_KEY=<paste Storage Zone API key>
BUNNY_STORAGE_REGION=de
NEXT_PUBLIC_BUNNY_CDN_HOSTNAME=life-therapy-cdn.b-cdn.net

# Bunny Stream
BUNNY_STREAM_LIBRARY_ID=<paste Library ID>
BUNNY_STREAM_API_KEY=<paste Stream API key>
```

If using a custom domain, change `NEXT_PUBLIC_BUNNY_CDN_HOSTNAME` to `cdn.life-therapy.co.za`.

### Adding to Vercel

1. Go to your Vercel project > **Settings > Environment Variables**
2. Add all 6 variables above for **Production** (and Preview if needed)
3. Redeploy for changes to take effect

---

## Step 5: How It Works (Admin Portal Walkthrough)

### Uploading a Course Video (Lecture)

1. Go to **Admin > Courses > [Course] > [Module] > Lectures**
2. Click **Add Lecture** (or edit an existing one)
3. Set type to **Video**
4. Next to the Video URL field, click the **camera icon** button
5. Select your MP4/MOV/WebM file
6. What happens automatically:
   - Video duration is detected from the file and filled in
   - A progress bar shows upload status
   - The video is uploaded to Bunny Stream via your server
   - The embed URL is saved to the lecture
   - Bunny encodes the video at multiple resolutions (takes a few minutes)
7. Click **Create Lecture** / **Save Changes**

**Replacing a video:** Simply click the camera icon again and upload a new file. The old video is automatically deleted from Bunny Stream.

**Manual URL:** You can also paste a YouTube, Vimeo, or Bunny Stream embed URL directly into the field instead of uploading.

**File size limit:** Max 500 MB through the admin panel. For larger files, upload directly in the Bunny Stream dashboard and paste the embed URL.

### Uploading a Course/Module Intro Video (Preview)

1. Go to **Admin > Courses > [Course]** (edit) or **Admin > Courses > [Course] > [Module]** (edit)
2. Scroll to **Preview Video (Sofia Hart)** section
3. Click the **camera icon** next to the URL field
4. Select the intro video file — same upload flow as lectures
5. This video appears on the public course/short-course page for visitors before purchase

### Uploading a Worksheet / PDF

1. Go to **Admin > Courses > [Course] > [Module] > Lectures**
2. Edit (or create) the lecture you want to attach a worksheet to
3. Next to **Worksheet / PDF URL**, click the **file icon** button
4. Select your PDF, DOCX, XLSX, PNG, JPG, or ZIP file (max 20 MB)
5. The file uploads to Bunny Storage and the CDN URL is saved

Files are stored at: `courses/{course-slug}/{module-slug}/{filename}`

### Deleting a Lecture

When you delete a lecture from the admin panel, the system automatically:
- Deletes the video from Bunny Stream (if it was a Bunny-hosted video)
- Deletes the worksheet from Bunny Storage (if one was attached)

---

## Step 6: How Students See Content

### Videos
- Students access lecture videos through the portal at `/portal/courses/{slug}/learn/{lectureId}`
- The video player supports YouTube, Vimeo, and Bunny Stream embeds
- **Bunny Stream videos** resume from where the student left off (playback position is saved)
- Videos play in an embedded iframe with adaptive quality (auto-adjusts to connection speed)

### Preview Videos
- Course and module intro videos appear on public pages (`/courses/{slug}` and `/courses/short/{slug}`)
- Visitors can watch these without logging in — they're marketing/preview content

### Worksheets
- Students see a **Download Worksheet** button on the lecture page
- Clicking downloads the PDF directly from the Bunny CDN

---

## Content Protection

**Current setup:** Access control is handled at the application level:
- Only authenticated, enrolled students can see lecture pages and video URLs
- The portal checks enrollment/purchase status before showing any content
- Unauthenticated visitors cannot navigate to lecture content

**What this means:**
- Video embed URLs and PDF URLs are technically public if someone knows the exact URL
- In practice, URLs are hard to guess (they contain random IDs/GUIDs)
- This is sufficient for most online course platforms at this scale

**Optional hardening (if needed later):**
- Enable **Referer Protection** in Bunny Stream library settings to only allow embeds from your domain
- Enable **Token Authentication** on the Pull Zone for signed, time-limited PDF URLs
- These are Bunny dashboard settings and would require code changes to generate signed URLs

---

## Folder Structure in Bunny Storage

Files are automatically organised by the admin panel:

```
life-therapy-files/
  courses/
    foundations-of-self-confidence/
      module-1-building-blocks/
        worksheet.pdf
        journal-template.pdf
      module-2-negative-self-talk/
        reflection-guide.pdf
    healthy-relationships/
      module-1-communication/
        worksheet.pdf
```

---

## Estimated Monthly Costs

| Usage | Cost |
|---|---|
| Storage (10 GB videos + files) | ~$0.10/month |
| Video streaming (100 students) | ~$1–3/month |
| CDN bandwidth (PDF downloads) | ~$0.50/month |
| **Total** | **~$2–5/month** |

---

## Quick Checklist

- [ ] Bunny.net account created and payment method added
- [ ] Storage Zone `life-therapy-files` created (Frankfurt region)
- [ ] Pull Zone `life-therapy-cdn` connected to Storage Zone
- [ ] Stream library `Life-Therapy Courses` created (Frankfurt region)
- [ ] All 6 env vars added to `.env.local`
- [ ] All 6 env vars added to Vercel (production)
- [ ] Test: upload a video via Admin > Courses > Lecture — confirm it plays
- [ ] Test: upload a PDF via Admin > Lectures — confirm download works
- [ ] Optional: custom domain `cdn.life-therapy.co.za` configured
- [ ] Optional: enable Referer Protection in Bunny Stream settings
