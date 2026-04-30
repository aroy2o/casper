# Chrome Web Store — Submission Guide

## Step 1: Build the store package

```bash
cd extension
npm install
npm run build:store
```

This produces: `extension/dist-store/casper-extension-v1.0.0.zip`

---

## Step 2: Prepare screenshots (required)

The store requires **at least 1 screenshot** at exactly **1280×800 px** or **640×400 px**.

Suggested screenshots:
1. The "Audit Tender" FAB button visible on an eProcure tender page
2. The audit overlay panel open showing HIGH RISK result with flagged line items
3. The popup showing recent audits list
4. The CASPER dashboard extension audit history page

Use a tool like Puppeteer, browser devtools device emulator, or screen capture.
Save to `.store/screenshots/` before submitting.

---

## Step 3: Host your privacy policy

The store requires a **publicly accessible** privacy policy URL.

1. Copy `.store/privacy-policy.md` content
2. Host it at a stable URL (GitHub Pages, your domain, etc.)
3. Example: `https://your-domain.com/casper/privacy`

---

## Step 4: Create a developer account

1. Go to https://chrome.google.com/webstore/devconsole
2. Pay the one-time $5 developer registration fee
3. Verify your account email

---

## Step 5: Submit the extension

1. Click **"New Item"** in the developer console
2. Upload `dist-store/casper-extension-v1.0.0.zip`
3. Fill in the store listing using `.store/store-listing.md`
4. Upload screenshots
5. Set **Category**: Productivity
6. Set **Language**: English
7. Set **Privacy practices**:
   - Does your extension collect user data? → **No** (page text is sent to self-hosted backend only)
   - Paste your privacy policy URL
8. Submit for review (takes 1–3 business days)

---

## Step 6: Updating the extension

1. Increment `version` in `manifest.json` and `package.json`
2. Run `npm run build:store` again
3. Upload the new ZIP in the developer console → "Package" tab → "Upload new package"

---

## Checklist before submitting

- [ ] `npm run build:store` completes without errors
- [ ] All 4 icon sizes exist: icon16.png, icon32.png, icon48.png, icon128.png
- [ ] At least 1 screenshot (1280×800 or 640×400)
- [ ] Privacy policy is publicly hosted
- [ ] Backend URL in Popup.tsx defaults set correctly
- [ ] `manifest.json` `homepage_url` points to your real URL
- [ ] Extension tested locally by loading `dist/` as an unpacked extension
