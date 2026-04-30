import puppeteer from "puppeteer";

const BASE_URL = "https://eprocure.gov.in/eprocure/app";

const NE_STATES = [
  { displayName: "ASSAM", slug: "assam" },
  { displayName: "MEGHALAYA", slug: "meghalaya" },
  { displayName: "ARUNACHAL PRADESH", slug: "arunachal" },
  { displayName: "MANIPUR", slug: "manipur" }
];

type ScrapedTender = {
  tenderNumber: string;
  title: string;
  department: string;
  state: string;
  publishedDate: string | null;
  closingDate: string | null;
  sourceURL: string;
  totalEstimatedCostINR: number;
  detailURL?: string;
};

type RawRow = {
  tenderNumber: string;
  title: string;
  department: string;
  estimatedCostRaw: string;
  publishedDate: string;
  closingDate: string;
  sourceURL: string;
  detailURL?: string;
};

function normalizeText(value: string): string {
  return value.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function parseCostFromText(text: string): number {
  if (!text || text.trim() === "" || text.trim() === "-") return 0;
  const stripped = text.replace(/Rs\.|INR|₹/gi, "").trim();
  const cleaned = stripped.replace(/[,\s]/g, "").trim();
  if (/crore/i.test(text)) {
    const num = parseFloat(cleaned.replace(/crore/gi, ""));
    return isNaN(num) ? 0 : Math.round(num * 1e7);
  }
  if (/lakh/i.test(text)) {
    const num = parseFloat(cleaned.replace(/lakh/gi, ""));
    return isNaN(num) ? 0 : Math.round(num * 1e5);
  }
  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0) return 0;
  return Math.round(num);
}

function looksLikeDate(value: string): boolean {
  return /^\d{1,2}[-/][A-Za-z0-9]{2,3}[-/]\d{2,4}/.test(normalizeText(value));
}

function cleanTenderNumber(raw: string): string | null {
  const normalized = normalizeText(raw);
  if (!normalized) return null;
  const match =
    normalized.match(/\b\d{4}_[A-Z0-9]+_\d+_\d+\b/i)?.[0] ??
    normalized.match(/\b[A-Z0-9]{2,}\/[A-Z0-9./_-]{3,}\b/i)?.[0] ??
    normalized.match(/\b(?:NIT|RFP|RFQ)[-/ ]?[A-Z0-9./_-]{3,}\b/i)?.[0];
  return match ? normalizeText(match) : null;
}

function sanitizeTitle(raw: string): string | null {
  const normalized = normalizeText(raw);
  if (!normalized) return null;
  if (/^\d/.test(normalized)) return null;
  if (/^s\.?no$/i.test(normalized)) return null;
  if (/visitor no|screen reader|designed, developed and hosted|tender list/i.test(normalized)) return null;
  if (normalized.length < 12) return null;
  if (normalized.length > 320) return null;
  if (!/[A-Za-z]/.test(normalized)) return null;
  return normalized;
}

function parseBracketParts(value: string): string[] {
  const matches = value.match(/\[([^\]]+)\]/g) ?? [];
  return matches.map((entry) => normalizeText(entry.slice(1, -1))).filter((entry) => entry.length > 0);
}

function extractTenderNumber(rawTenderNumber: string, rawTitle: string): string | null {
  const fromRaw = cleanTenderNumber(rawTenderNumber);
  if (fromRaw && fromRaw.length <= 140) return fromRaw;
  const parts = parseBracketParts(rawTitle);
  for (const part of parts) {
    const parsed = cleanTenderNumber(part);
    if (parsed && parsed.length <= 140) return parsed;
  }
  return null;
}

function extractTitle(rawTitle: string): string | null {
  const parts = parseBracketParts(rawTitle);
  const titleCandidate =
    parts.find((part) => !cleanTenderNumber(part) && part.length >= 12) ??
    parts.find((part) => part.length >= 12) ??
    rawTitle;
  return sanitizeTitle(titleCandidate);
}

async function extractDetailCost(
  page: puppeteer.Page,
  detailURL: string
): Promise<{ cost: number; description: string }> {
  try {
    await page.goto(detailURL, { waitUntil: "domcontentloaded", timeout: 15000 });

    const result = await page.evaluate(() => {
      const COST_LABELS =
        /tender value|estimated cost|contract value|total bid value|approximate cost|bid value|estimated amount|work value/i;
      const DESC_LABELS = /work.*description|work.*item.*description|brief.*description|scope.*work/i;

      let costLabel = "";
      let costValue = "";
      let description = "";

      // Strategy 1: td.td_caption paired with td.td_field (GePNIC standard)
      const captionCells = Array.from(document.querySelectorAll("td.td_caption"));
      for (const cap of captionCells) {
        const labelText = (cap.textContent ?? "").trim();
        const labelLower = labelText.toLowerCase();
        const next = cap.nextElementSibling as HTMLElement | null;
        const val = next?.textContent?.trim() ?? "";
        if (!costValue && COST_LABELS.test(labelLower) && val && val !== "-") {
          costLabel = labelText;
          costValue = val;
        }
        if (!description && DESC_LABELS.test(labelLower) && val) {
          description = val.substring(0, 500);
        }
      }

      // Strategy 2: any <tr> with th + td where th matches cost label
      if (!costValue) {
        const allRows = Array.from(document.querySelectorAll("tr"));
        for (const tr of allRows) {
          const cells = tr.querySelectorAll("th, td");
          for (let i = 0; i < cells.length - 1; i++) {
            const cell = cells[i] as Element | undefined;
            if (!cell) continue;
            const labelText = (cell.textContent ?? "").trim();
            const labelLower = labelText.toLowerCase();
            const nextCell = cells[i + 1] as HTMLElement;
            const val = nextCell?.textContent?.trim() ?? "";
            if (COST_LABELS.test(labelLower) && val && val !== "-" && !/^\s*$/.test(val)) {
              costLabel = labelText;
              costValue = val;
              break;
            }
            if (!description && DESC_LABELS.test(labelLower) && val) {
              description = val.substring(0, 500);
            }
          }
          if (costValue) break;
        }
      }

      // Strategy 3: regex on full body text
      if (!costValue) {
        const bodyText = (document.body.innerText ?? "").replace(/\s+/g, " ");
        const match = bodyText.match(
          /(?:Tender Value|Estimated Cost|Contract Value|Bid Value|Approximate Cost)[^₹\d]*([₹\d][₹\d,. ]*(?:Lakh|Crore|lakh|crore|L|Cr)?)/i
        );
        if (match?.[1]) costValue = match[1].trim();
      }

      return { cost: costValue, label: costLabel, description };
    });

    let costText = result.cost;
    if (/in.{0,5}lakh/i.test(result.label) && !/lakh/i.test(costText)) costText = `${costText} Lakh`;
    else if (/in.{0,5}crore/i.test(result.label) && !/crore/i.test(costText)) costText = `${costText} Crore`;

    const cost = parseCostFromText(costText);
    return { cost, description: result.description };
  } catch (err) {
    process.stderr.write(
      `[detail] failed for ${detailURL}: ${err instanceof Error ? err.message : String(err)}\n`
    );
    return { cost: 0, description: "" };
  }
}

async function extractRowsFromPage(page: puppeteer.Page, currentURL: string): Promise<RawRow[]> {
  return page.evaluate(function () {
    var rows = document.querySelectorAll("#table tr.even, #table tr.odd, #table tr[id^='informal']");
    var results: RawRow[] = [];
    var datePattern = /^\d{2}[-/]\d{2}[-/]\d{4}/;

    for (var i = 0; i < rows.length; i++) {
      var row = rows.item(i);
      if (!row) continue;
      var cells = row.querySelectorAll(":scope > td");
      if (cells.length < 6) continue;

      var refLink =
        row.querySelector('a[href*="tenderRef"]') ||
        row.querySelector("td:nth-child(7) a") ||
        row.querySelector("td a");
      var tenderNumber =
        (refLink && refLink.textContent ? refLink.textContent.trim() : "") ||
        (cells[6] && cells[6].textContent ? cells[6].textContent.trim() : "") ||
        (cells[0] && cells[0].textContent ? cells[0].textContent.trim() : "");

      var titleCell = cells[4] || null;
      var title =
        (titleCell && titleCell.textContent ? titleCell.textContent.trim() : "") || "Untitled Tender";

      var department = cells[5] && cells[5].textContent ? cells[5].textContent.trim() : "";

      var publishedDate = cells[1] && cells[1].textContent ? cells[1].textContent.trim() : "";
      var closingDate = cells[2] && cells[2].textContent ? cells[2].textContent.trim() : "";
      for (var d = 0; d < cells.length; d++) {
        var dateCandidate = cells.item(d);
        var dateText = dateCandidate && dateCandidate.textContent ? dateCandidate.textContent.trim() : "";
        if (datePattern.test(dateText)) {
          if (!publishedDate) publishedDate = dateText;
          else if (
            !closingDate ||
            closingDate === (cells[2] && cells[2].textContent ? cells[2].textContent.trim() : "")
          ) {
            closingDate = dateText;
          }
        }
      }

      var estimatedCostRaw = "";
      var estCell = cells[4] || null;
      if (estCell && estCell.textContent) estimatedCostRaw = estCell.textContent.trim();
      if (!estimatedCostRaw && cells.length > 5 && cells[5] && cells[5].textContent) {
        estimatedCostRaw = cells[5].textContent.trim();
      }
      if (!estimatedCostRaw) {
        for (var c = 0; c < cells.length; c++) {
          var cell = cells[c] || null;
          var t = cell && cell.textContent ? cell.textContent.trim() : "";
          if (t && (t.indexOf("Crore") >= 0 || t.indexOf("Lakh") >= 0)) {
            estimatedCostRaw = t;
            break;
          }
        }
      }

      var detailNode = row.querySelector(":scope > td:nth-child(5) a");
      var detailURL =
        detailNode && detailNode.getAttribute("href") ? detailNode.getAttribute("href") : "";

      results.push({
        tenderNumber,
        title,
        department,
        estimatedCostRaw,
        publishedDate,
        closingDate,
        sourceURL: window.location.href,
        ...(detailURL ? { detailURL } : {})
      });
    }
    return results;
  }) as Promise<RawRow[]>;
}

function processRawRows(rawRows: RawRow[], slug: string, baseURL: string): ScrapedTender[] {
  const seen = new Set<string>();
  const results: ScrapedTender[] = [];
  for (const raw of rawRows) {
    const tenderNumber = extractTenderNumber(raw.tenderNumber, raw.title);
    const title = extractTitle(raw.title);
    const department = normalizeText(raw.department);
    if (!tenderNumber || !title || !department || looksLikeDate(department)) continue;
    if (department.length > 320 || title.length > 320) continue;
    if (/visitor no|screen reader|designed, developed and hosted|s\.?no/i.test(`${title} ${department}`)) continue;
    if (seen.has(tenderNumber)) continue;
    seen.add(tenderNumber);

    const totalEstimatedCostINR = parseCostFromText(raw.estimatedCostRaw);
    const detailURL = raw.detailURL ? new URL(raw.detailURL, baseURL).toString() : undefined;

    results.push({
      tenderNumber,
      title,
      department,
      state: slug,
      publishedDate: raw.publishedDate || null,
      closingDate: raw.closingDate || null,
      sourceURL: raw.sourceURL || baseURL,
      totalEstimatedCostINR,
      ...(detailURL ? { detailURL } : {})
    });
  }
  return results;
}

// Official NE India state GePNIC eProcurement portals — state-scoped, return only local tenders
const STATE_PORTALS: Record<string, string> = {
  assam: "https://assamtenders.gov.in/nicgep/app",
  meghalaya: "https://meghalayatenders.gov.in/nicgep/app",
  arunachal: "https://arunachaltenders.gov.in/nicgep/app",
  manipur: "https://manipurtenders.gov.in/nicgep/app"
};

// Search terms to try on each state portal (general infra terms that yield real results)
const STATE_PORTAL_TERMS: Record<string, string[]> = {
  assam: ["road", "bridge", "building", "drainage", "highway"],
  meghalaya: ["road", "bridge", "building", "construction"],
  arunachal: ["road", "bridge", "building"],
  manipur: ["road", "bridge", "building", "construction"]
};

async function tryStatePortal(
  page: puppeteer.Page,
  slug: string
): Promise<ScrapedTender[]> {
  const portalBase = STATE_PORTALS[slug];
  if (!portalBase) return [];

  const terms = STATE_PORTAL_TERMS[slug] ?? ["road"];
  const allRows: ScrapedTender[] = [];
  const seen = new Set<string>();

  for (const term of terms) {
    if (allRows.length >= 20) break; // enough to give us 8 quality ones after filtering
    const url =
      `${portalBase}?component=%24DirectLink&page=FrontEndAdvancedSearchResult` +
      `&service=page&searchStr=${encodeURIComponent(term)}&itemsPerPage=100`;
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      const rawRows = await extractRowsFromPage(page, url);
      const parsed = processRawRows(rawRows, slug, url);
      let added = 0;
      for (const r of parsed) {
        if (!seen.has(r.tenderNumber)) {
          seen.add(r.tenderNumber);
          allRows.push(r);
          added++;
        }
      }
      process.stderr.write(`[scraper] ${portalBase} term="${term}": ${rawRows.length} raw, +${added} new\n`);
    } catch (err) {
      process.stderr.write(`[scraper] ${portalBase} term="${term}" failed: ${err instanceof Error ? err.message : String(err)}\n`);
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return allRows;
}

async function tryAdvancedSearchForm(
  page: puppeteer.Page,
  _displayName: string,
  slug: string
): Promise<ScrapedTender[]> {
  return tryStatePortal(page, slug);
}

async function tryKeywordSearch(
  page: puppeteer.Page,
  slug: string,
  urlOrTerm: string
): Promise<ScrapedTender[]> {
  // Accept either a full URL or a search term to build a URL from
  const url = urlOrTerm.startsWith("http")
    ? urlOrTerm
    : `${BASE_URL}?component=%24DirectLink&page=FrontEndAdvancedSearchResult&service=page` +
      `&searchStr=${encodeURIComponent(urlOrTerm)}&itemsPerPage=100`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  const rawRows = await extractRowsFromPage(page, url);
  return processRawRows(rawRows, slug, url);
}

// NE India-specific organization name terms that only match NE departments on eProcure
const STATE_FALLBACK_TERMS: Record<string, string[]> = {
  assam: [
    "PWD Assam road",
    "PHED Assam",
    "Assam PWD bridge",
    "NHIDCL Assam",
    "Guwahati Metropolitan"
  ],
  meghalaya: [
    "Meghalaya PWD",
    "Government of Meghalaya road",
    "MUDA Shillong",
    "Meghalaya infrastructure"
  ],
  arunachal: [
    "NHIDCL Arunachal",
    "Arunachal Pradesh PWD",
    "APWD Itanagar",
    "Arunachal road construction"
  ],
  manipur: [
    "PWD Manipur",
    "Manipur government road",
    "NHIDCL Manipur",
    "Imphal infrastructure"
  ]
};

async function main(): Promise<void> {
  let browser: puppeteer.Browser | null = null;
  const allResults: ScrapedTender[] = [];
  const globalSeen = new Set<string>(); // de-dup across all states
  const MAX_PER_STATE = 8;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    page.setDefaultNavigationTimeout(35000);

    for (const { displayName, slug } of NE_STATES) {
      process.stderr.write(`[scraper] State: ${displayName}\n`);
      const seen = new Set<string>();
      const stateResults: ScrapedTender[] = [];

      const addUnique = (rows: ScrapedTender[]): void => {
        for (const r of rows) {
          // Skip if already seen globally (same tender claimed by multiple state searches)
          if (globalSeen.has(r.tenderNumber)) continue;
          if (!seen.has(r.tenderNumber) && stateResults.length < MAX_PER_STATE) {
            seen.add(r.tenderNumber);
            stateResults.push(r);
          }
        }
      };

      // Strategy 1: advanced search form with state dropdown
      try {
        const formRows = await tryAdvancedSearchForm(page, displayName, slug);
        addUnique(formRows);
        process.stderr.write(`[scraper] Form search: ${formRows.length} raw rows, ${stateResults.length} accepted\n`);
      } catch (err) {
        process.stderr.write(
          `[scraper] Form search failed for ${displayName}: ${err instanceof Error ? err.message : String(err)}\n`
        );
      }

      // Strategy 2: more terms on the same state portal if still short
      if (stateResults.length < MAX_PER_STATE) {
        const extraTerms = STATE_FALLBACK_TERMS[slug] ?? [];
        for (const term of extraTerms) {
          if (stateResults.length >= MAX_PER_STATE) break;
          const portalBase = STATE_PORTALS[slug];
          if (!portalBase) break;
          try {
            const url =
              `${portalBase}?component=%24DirectLink&page=FrontEndAdvancedSearchResult` +
              `&service=page&searchStr=${encodeURIComponent(term)}&itemsPerPage=100`;
            const kwRows = await tryKeywordSearch(page, slug, url);
            const before = stateResults.length;
            addUnique(kwRows);
            process.stderr.write(`[scraper] Portal fallback term "${term}": ${kwRows.length} raw, +${stateResults.length - before} new\n`);
          } catch (err) {
            process.stderr.write(
              `[scraper] Portal fallback "${term}" failed: ${err instanceof Error ? err.message : String(err)}\n`
            );
          }
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      // Strategy 3: last-resort etenders.gov.in with state name keyword
      if (stateResults.length === 0) {
        const stateKeyword: Record<string, string> = {
          assam: "Assam road", meghalaya: "Meghalaya road",
          arunachal: "Arunachal road", manipur: "Manipur road"
        };
        try {
          const etUrl =
            `https://etenders.gov.in/eprocure/app?component=%24DirectLink&page=FrontEndAdvancedSearchResult` +
            `&service=page&searchStr=${encodeURIComponent(stateKeyword[slug] ?? slug)}&itemsPerPage=100`;
          await page.goto(etUrl, { waitUntil: "networkidle2", timeout: 30000 });
          const rawRows = await extractRowsFromPage(page, etUrl);
          addUnique(processRawRows(rawRows, slug, etUrl));
          process.stderr.write(`[scraper] etenders last-resort: ${stateResults.length} accepted\n`);
        } catch (err) {
          process.stderr.write(
            `[scraper] etenders last-resort failed for ${displayName}: ${err instanceof Error ? err.message : String(err)}\n`
          );
        }
      }

      if (stateResults.length === 0) {
        process.stderr.write(`[scraper] WARNING: 0 results for ${displayName} — eProcure may be blocking or returning empty\n`);
      }

      // Fetch detail pages for tenders missing cost (up to 5 per state to keep runtime sane)
      const pendingCost = stateResults.filter((r) => r.totalEstimatedCostINR <= 0 && r.detailURL);
      for (const tender of pendingCost.slice(0, 5)) {
        const { cost } = await extractDetailCost(page, tender.detailURL!);
        if (cost > 0) {
          tender.totalEstimatedCostINR = cost;
          process.stderr.write(`[detail] ${tender.tenderNumber}: ₹${cost}\n`);
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      // Register all collected tenders into global seen set
      for (const r of stateResults) globalSeen.add(r.tenderNumber);
      allResults.push(...stateResults);
      process.stderr.write(`[scraper] ${displayName} done — ${stateResults.length} tenders\n`);
    }
  } finally {
    if (browser) await browser.close();
  }

  process.stdout.write(JSON.stringify(allResults, null, 2) + "\n");
}

main().catch((err: unknown) => {
  process.stderr.write(`[fatal] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
