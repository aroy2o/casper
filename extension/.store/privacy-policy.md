# Privacy Policy — CASPER Browser Extension

**Last updated: 2026-04-30**

## What data we access

CASPER reads the visible text content of web pages **only when you explicitly click "Audit Tender"**. The extension does not:

- Read pages passively in the background
- Access your browsing history
- Track which websites you visit
- Collect any personally identifiable information

## What data we send

When you click "Audit Tender", the following is sent to **your self-hosted CASPER backend**:

- The URL of the current page (`sourceURL`)
- The page title (`pageTitle`)
- The visible text content of the page (`extractedText`, up to 20,000 characters)

This data is sent to the backend URL you configure in Settings. **It is never sent to Anthropic, Google, or any third party.**

## Where data is stored

Audit results are stored in your own MongoDB database on your own infrastructure. The CASPER extension stores only:

- Your JWT access token (in `chrome.storage.local`, not synced across devices)
- Your backend/frontend URL preferences (in `chrome.storage.local`)
- No audit data is stored in the browser

## Permissions used

| Permission | Reason |
|---|---|
| `storage` | Save your JWT token and API URL locally |
| `activeTab` | Read the current page text when you click Audit Tender |
| `scripting` | Inject the audit overlay panel into the page |
| `tabs` | Open the CASPER audit history page from the popup |

## Contact

For privacy questions, open an issue at the project repository.
