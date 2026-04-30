/* eslint-disable @typescript-eslint/no-explicit-any */
const DEFAULT_API_BASE = "http://localhost:4000";

function normalizeAuthToken(token: string | undefined): string | undefined {
  if (!token) {
    return undefined;
  }

  const trimmed = token.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.startsWith("Bearer ") ? trimmed.slice(7).trim() : trimmed;
}

async function getStoredAuth(): Promise<{ authToken?: string; refreshToken?: string; apiBase?: string }> {
  return await new Promise((resolve) => {
    chrome.storage.local.get(["authToken", "refreshToken", "apiBase"], resolve);
  });
}

async function refreshAccessToken(apiBase: string, refreshToken: string): Promise<string | undefined> {
  const response = await fetch(`${apiBase}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) {
    return undefined;
  }

  const json = (await response.json()) as { success: boolean; data?: { accessToken?: string } };
  const nextToken = json.success ? normalizeAuthToken(json.data?.accessToken) : undefined;
  if (nextToken) {
    chrome.storage.local.set({ authToken: nextToken });
  }
  return nextToken;
}

async function fetchWithAuthRetry(
  apiBase: string,
  path: string,
  token: string,
  refreshToken?: string,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`
    }
  });

  if (response.status !== 401 || !refreshToken) {
    return response;
  }

  const refreshedToken = await refreshAccessToken(apiBase, refreshToken);
  if (!refreshedToken) {
    return response;
  }

  return await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${refreshedToken}`
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  // Only set defaults for keys that are not already stored — never overwrite authToken
  chrome.storage.local.get(["watchedRegions", "apiBase", "appBase"], (existing: any) => {
    const defaults: Record<string, unknown> = {};
    if (!existing.watchedRegions) defaults.watchedRegions = ["assam"];
    if (!existing.apiBase) defaults.apiBase = DEFAULT_API_BASE;
    if (!existing.appBase) defaults.appBase = "http://localhost:5173";
    if (Object.keys(defaults).length > 0) chrome.storage.local.set(defaults);
  });
});

chrome.runtime.onMessage.addListener(
  (message: any, _sender: any, sendResponse: (r: any) => void): boolean => {
    if (message?.type === "PING") {
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "AUDIT_PAGE") {
      handleAuditPage(message.payload).then(sendResponse).catch((err) => {
        sendResponse({ ok: false, error: String(err?.message ?? err) });
      });
      return true;
    }

    if (message?.type === "AUDIT_PDF_URL") {
      handleAuditPdf(message.payload).then(sendResponse).catch((err: any) => {
        sendResponse({ ok: false, error: String(err?.message ?? err) });
      });
      return true;
    }

    if (message?.type === "AUDIT_PDF_BYTES") {
      handleAuditPdfBytes(message.payload).then(sendResponse).catch((err: any) => {
        sendResponse({ ok: false, error: String(err?.message ?? err) });
      });
      return true;
    }

    if (message?.type === "OPEN_HISTORY") {
      chrome.storage.local.get(["appBase"], (result: any) => {
        const base = (result.appBase as string | undefined) ?? "http://localhost:5173";
        chrome.tabs.create({ url: `${base}/extension-audits` });
      });
      return false;
    }

    if (message?.type === "GET_STORAGE") {
      chrome.storage.local.get(message.keys ?? [], (result: any) => {
        sendResponse({ ok: true, data: result });
      });
      return true;
    }

    if (message?.type === "SET_STORAGE") {
      chrome.storage.local.set(message.data ?? {}, () => {
        sendResponse({ ok: true });
      });
      return true;
    }

    return false;
  }
);

async function handleAuditPage(payload: {
  sourceURL: string;
  pageTitle: string;
  extractedText: string;
}): Promise<{ ok: boolean; data?: any; error?: string }> {
  const stored = await getStoredAuth();

  const token = normalizeAuthToken(stored.authToken);
  const refreshToken = normalizeAuthToken(stored.refreshToken);
  const apiBase = stored.apiBase ?? DEFAULT_API_BASE;

  if (!token) {
    return { ok: false, error: "Not authenticated. Please log in via CASPER extension options." };
  }

  const response = await fetchWithAuthRetry(apiBase, "/api/extension/audit", token, refreshToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok && response.status !== 400) {
    return { ok: false, error: `Server error ${response.status}. Check CASPER backend is running.` };
  }

  const json = (await response.json()) as { success: boolean; data?: any; error?: { message?: string } };

  if (!json.success) {
    return { ok: false, error: json.error?.message ?? "Audit request failed" };
  }

  return { ok: true, data: json.data };
}

async function handleAuditPdfBytes(payload: {
  pdfBase64: string;
  pageTitle: string;
  sourceURL: string;
}): Promise<{ ok: boolean; data?: any; error?: string }> {
  const stored = await getStoredAuth();

  const token = normalizeAuthToken(stored.authToken);
  const refreshToken = normalizeAuthToken(stored.refreshToken);
  const apiBase = stored.apiBase ?? DEFAULT_API_BASE;

  if (!token) {
    return { ok: false, error: "Not authenticated. Please log in via CASPER extension options." };
  }

  // Decode base64 → Uint8Array → Blob
  const binary = atob(payload.pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const pdfBlob = new Blob([bytes], { type: "application/pdf" });

  const formData = new FormData();
  formData.append("pdf", pdfBlob, "tender.pdf");
  formData.append("sourceURL", payload.sourceURL);
  formData.append("pageTitle", payload.pageTitle);

  const response = await fetchWithAuthRetry(apiBase, "/api/extension/audit-pdf", token, refreshToken, {
    method: "POST",
    body: formData
  });

  if (!response.ok && response.status !== 400) {
    return { ok: false, error: `Server error ${response.status}. Check CASPER backend is running.` };
  }

  const json = (await response.json()) as { success: boolean; data?: any; error?: { message?: string } };

  if (!json.success) {
    return { ok: false, error: json.error?.message ?? "PDF audit request failed" };
  }

  return { ok: true, data: json.data };
}

async function handleAuditPdf(payload: {
  pdfUrl: string;
  pageTitle: string;
  sourceURL: string;
}): Promise<{ ok: boolean; data?: any; error?: string }> {
  const stored = await getStoredAuth();

  const token = normalizeAuthToken(stored.authToken);
  const refreshToken = normalizeAuthToken(stored.refreshToken);
  const apiBase = stored.apiBase ?? DEFAULT_API_BASE;

  if (!token) {
    return { ok: false, error: "Not authenticated. Please log in via CASPER extension options." };
  }

  // Fetch the PDF bytes from the tab's URL (browser handles auth cookies for the domain)
  let pdfBlob: Blob;
  try {
    const pdfResponse = await fetch(payload.pdfUrl, { credentials: "include" });
    if (!pdfResponse.ok) {
      return {
        ok: false,
        error: `Could not download PDF (HTTP ${pdfResponse.status}). The document may require a login session — try opening it in your browser first.`
      };
    }
    pdfBlob = await pdfResponse.blob();
  } catch {
    return { ok: false, error: "Failed to fetch the PDF. Check your network connection." };
  }

  // Forward to backend as multipart upload
  const formData = new FormData();
  formData.append("pdf", pdfBlob, "tender.pdf");
  formData.append("sourceURL", payload.sourceURL);
  formData.append("pageTitle", payload.pageTitle);

  const response = await fetchWithAuthRetry(apiBase, "/api/extension/audit-pdf", token, refreshToken, {
    method: "POST",
    body: formData
  });

  if (!response.ok && response.status !== 400) {
    return { ok: false, error: `Server error ${response.status}. Check CASPER backend is running.` };
  }

  const json = (await response.json()) as { success: boolean; data?: any; error?: { message?: string } };

  if (!json.success) {
    return { ok: false, error: json.error?.message ?? "PDF audit request failed" };
  }

  return { ok: true, data: json.data };
}
