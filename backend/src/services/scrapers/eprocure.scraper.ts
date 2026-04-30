import axios from "axios";
import { Queue } from "bullmq";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";
import { redis } from "../../config/redis.js";
import { TenderModel } from "../../models/Tender.model.js";
import { buildTenderCostBreakdown } from "../../utils/costBreakdown.js";
import { logger } from "./shared.js";

const client = axios.create({ timeout: 20_000 });
const newTenderQueue = new Queue("new-tender", { connection: redis });

type ParsedTender = {
  title: string;
  department: string;
  tenderNumber: string;
  totalEstimatedCostINR: number;
  state: string;
  projectType: "road" | "bridge" | "railway" | "building" | "drainage" | "other";
  sourcePortal: "eprocure" | "etenders" | "worldbank";
  sourceURL: string;
  detailURL?: string;
  organisation: string | null;
  publishedDate: Date | null;
  closingDate: Date | null;
  locationText: string | null;
  scrapedQuery: string;
  scrapedYear: number;
  rawText: string;
  vendorName: string | null;
  procurementMethod: "open" | "limited" | "nomination" | "other";
  contractYear: number | null;
  boqAvailable: boolean;
  boqDocumentURL: string | null;
  costBreakdown: ReturnType<typeof buildTenderCostBreakdown>;
};

type ScrapeOptions = {
  yearsBack?: number;
  terms?: string[];
  portals?: Array<"eprocure" | "etenders" | "worldbank">;
  scope?: string;
  maxRecords?: number;
};

type RawTenderRow = {
  tenderNumber: string;
  title: string;
  department: string;
  estimatedCostRaw: string;
  publishedDate: string;
  closingDate: string;
  state: string;
  sourceURL: string;
  portal: string;
  detailURL?: string;
};

function inferState(title: string, dept: string): string {
  const text = `${title} ${dept}`.toLowerCase();
  if (/assam|guwahati|dibrugarh|jorhat|silchar/.test(text)) return "assam";
  if (/meghalaya|shillong|tura/.test(text)) return "meghalaya";
  if (/arunachal|itanagar|naharlagun/.test(text)) return "arunachal";
  if (/manipur|imphal/.test(text)) return "manipur";
  if (/nagaland|kohima|dimapur/.test(text)) return "nagaland";
  if (/mizoram|aizawl/.test(text)) return "mizoram";
  if (/tripura|agartala/.test(text)) return "tripura";
  if (/sikkim|gangtok/.test(text)) return "sikkim";
  return "national";
}

function inferProjectType(text: string): "road" | "bridge" | "railway" | "building" | "drainage" | "other" {
  const value = text.toLowerCase();
  if (/road|highway|nh|sh|pavement|bitumen|surfacing/.test(value)) return "road";
  if (/bridge|flyover|viaduct|culvert|overpass/.test(value)) return "bridge";
  if (/railway|rail|station|track|signal/.test(value)) return "railway";
  if (/building|office|school|hospital|secretariat/.test(value)) return "building";
  if (/drain|sewer|water|sewage|pipeline/.test(value)) return "drainage";
  return "other";
}

const SEARCH_QUERIES = [
  "assam road construction",
  "meghalaya infrastructure",
  "arunachal pradesh bridge",
  "northeast india highway",
  "guwahati urban development",
  "NER infrastructure",
  "NHIDCL northeast",
  "PWD assam"
];
const INDIA_STATE_TERMS = [
  "andhra pradesh",
  "arunachal",
  "assam",
  "bihar",
  "chhattisgarh",
  "goa",
  "gujarat",
  "haryana",
  "himachal pradesh",
  "jharkhand",
  "karnataka",
  "kerala",
  "madhya pradesh",
  "maharashtra",
  "manipur",
  "meghalaya",
  "mizoram",
  "nagaland",
  "odisha",
  "punjab",
  "rajasthan",
  "sikkim",
  "tamil nadu",
  "telangana",
  "tripura",
  "uttar pradesh",
  "uttarakhand",
  "west bengal"
];

function normalizeText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function parseCostFromText(text: string): number {
  if (!text || text.trim() === "" || text.trim() === "-") return 0;
  const stripped = text.replace(/Rs\.|INR|₹/gi, "").trim();
  const cleaned = stripped.replace(/[,\s]/g, "").trim();

  if (/crore/i.test(text)) {
    const num = Number.parseFloat(cleaned.replace(/crore/gi, ""));
    return Number.isNaN(num) ? 0 : Math.round(num * 1e7);
  }
  if (/lakh/i.test(text)) {
    const num = Number.parseFloat(cleaned.replace(/lakh/gi, ""));
    return Number.isNaN(num) ? 0 : Math.round(num * 1e5);
  }

  const num = Number.parseFloat(cleaned);
  if (Number.isNaN(num) || num <= 0) return 0;
  return Math.round(num);
}

function mapStateFromOrg(orgText: string): string {
  const t = orgText.toLowerCase();
  if (t.includes("assam") || t.includes("guwahati")) return "assam";
  if (t.includes("meghalaya") || t.includes("shillong")) return "meghalaya";
  if (t.includes("arunachal") || t.includes("itanagar")) return "arunachal";
  if (t.includes("manipur") || t.includes("imphal")) return "manipur";
  if (t.includes("nagaland") || t.includes("kohima")) return "nagaland";
  if (t.includes("mizoram") || t.includes("aizawl")) return "mizoram";
  if (t.includes("tripura") || t.includes("agartala")) return "tripura";
  if (t.includes("sikkim") || t.includes("gangtok")) return "sikkim";
  return "national";
}

function parseDate(value: string): Date | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const ddmmyyyy = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]) - 1;
    const year = Number(ddmmyyyy[3]);
    const d = new Date(year, month, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const ddMon = normalized.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (ddMon) {
    const monthToken = ddMon[2];
    if (!monthToken) return null;
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const monthIndex = months.indexOf(monthToken.toLowerCase());
    if (monthIndex >= 0) {
      const day = Number(ddMon[1]);
      const year = Number(ddMon[3]);
      const d = new Date(year, monthIndex, day);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
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

function looksLikeDate(value: string): boolean {
  return /^\d{1,2}[-/][A-Za-z0-9]{2,3}[-/]\d{2,4}/.test(normalizeText(value));
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
    if (parsed && parsed.length <= 140) {
      return parsed;
    }
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

async function scrapePortal(
  urlBase: string,
  sourcePortal: "eprocure" | "etenders",
  yearsBack: number,
  terms: string[],
  maxRecords: number
): Promise<ParsedTender[]> {
  let browser: puppeteer.Browser | null = null;
  const dedupedRows = new Map<string, ParsedTender>();

  const scrapePortalViaHttp = async (): Promise<ParsedTender[]> => {
    const currentYear = new Date().getFullYear();
    for (let offset = 0; offset < yearsBack; offset += 1) {
      const year = currentYear - offset;
      for (const term of terms) {
        if (dedupedRows.size >= maxRecords) break;
        const searchTerm = `${term} ${year}`.trim();
        const url =
          `${urlBase}?component=%24DirectLink&page=FrontEndAdvancedSearchResult&service=page&searchStr=` +
          `${encodeURIComponent(searchTerm)}&itemsPerPage=100`;
        try {
          const response = await client.get<string>(url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-IN,en;q=0.9"
            }
          });
          const $ = cheerio.load(response.data, { xml: { decodeEntities: false } });
          const rows = $("#table tr.even, #table tr.odd, #table tr[id^='informal']").toArray();
          for (const row of rows) {
            const cells = $(row).children("td").toArray();
            if (cells.length < 6) continue;
            const text = (index: number): string => normalizeText($(cells[index]).text());
            const rawTitle = text(4);
            const rawTender = `${text(6)} ${rawTitle}`;
            const detailHref = normalizeText($(cells[4]).find("a").attr("href") ?? "");
            const detailURL = detailHref
              ? new URL(detailHref, urlBase).toString()
              : "";
            const title = extractTitle(rawTitle);
            const tenderNumber = extractTenderNumber(rawTender, rawTitle);
            const department = text(5);
            if (!title || !tenderNumber || !department || looksLikeDate(department)) continue;
            if (department.length > 320 || title.length > 320) continue;
            if (/visitor no|screen reader|designed, developed and hosted|s\.?no/i.test(`${title} ${department}`)) continue;

            const costCandidates = [
              normalizeText($(row).find("[headers='thEstimatedValue']").text()),
              normalizeText($(row).find("td:contains('Crore')").first().text()),
              normalizeText($(row).find("td:contains('Lakh')").first().text())
            ].filter((value) => value.length > 0);
            const extractedCostRaw = costCandidates.find((value) => parseCostFromText(value) > 0) ?? "";
            const totalEstimatedCostINR = parseCostFromText(extractedCostRaw);

            const state = mapStateFromOrg(department);
               const parsedProjectType = inferProjectType(title);
            const parsed: ParsedTender = {
              title,
              department,
              tenderNumber,
              totalEstimatedCostINR,
              state,
                 projectType: parsedProjectType,
              sourcePortal,
              sourceURL: url,
              ...(detailURL ? { detailURL } : {}),
              organisation: department,
              publishedDate: parseDate(text(1)),
              closingDate: parseDate(text(2)),
              locationText: `${title} ${department}`.trim(),
              scrapedQuery: searchTerm,
              scrapedYear: year,
              rawText: `${title} ${department}`.trim(),
              vendorName: department,
              procurementMethod: "open",
              contractYear: year,
              boqAvailable: false,
              boqDocumentURL: detailURL || null,
              costBreakdown: buildTenderCostBreakdown({
                totalEstimatedCostINR,
                projectType: parsedProjectType,
                state,
                lineItemCount: 0
              })
            };
            dedupedRows.set(tenderNumber, parsed);
            if (totalEstimatedCostINR <= 0) {
              logger.warn(`[eProcure] cost_not_extracted tenderNumber=${tenderNumber} org="${department.slice(0, 80)}"`);
            }
            if (dedupedRows.size >= maxRecords) break;
          }
        } catch (error) {
          console.warn(`[eProcure] HTTP fallback failed for ${sourcePortal}: ${searchTerm}`, error);
        }
      }
      if (dedupedRows.size >= maxRecords) break;
    }
    return Array.from(dedupedRows.values());
  };

  try {
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
      });
    } catch (error) {
      console.warn(`[eProcure] Puppeteer unavailable for ${sourcePortal}, using HTTP fallback`, error);
      return await scrapePortalViaHttp();
    }
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    const currentYear = new Date().getFullYear();
    for (let offset = 0; offset < yearsBack; offset += 1) {
      const year = currentYear - offset;
      for (const term of terms) {
        if (dedupedRows.size >= maxRecords) break;
        const searchTerm = `${term} ${year}`.trim();
        const url =
          `${urlBase}?component=%24DirectLink&page=FrontEndAdvancedSearchResult&service=page&searchStr=` +
          `${encodeURIComponent(searchTerm)}&itemsPerPage=100`;
        try {
          await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });
          const rawRows = await page.evaluate(function () {
            var rows = document.querySelectorAll("#table tr.even, #table tr.odd, #table tr[id^='informal']");
            var results = [];
            var datePattern = /^\d{2}[-/]\d{2}[-/]\d{4}/;

            for (var i = 0; i < rows.length; i += 1) {
              var row = rows.item(i);
              if (!row) continue;
              var cells = row.querySelectorAll(":scope > td");
              if (cells.length < 6) continue;

              var refLink =
                row.querySelector('a[href*="tenderRef"]') || row.querySelector("td:nth-child(7) a") || row.querySelector("td a");
              var tenderNumber =
                (refLink && refLink.textContent ? refLink.textContent.trim() : "") ||
                (cells[6] && cells[6].textContent ? cells[6].textContent.trim() : "") ||
                (cells[0] && cells[0].textContent ? cells[0].textContent.trim() : "");

              var titleCell = cells[4] || null;
              var title =
                (titleCell && titleCell.textContent ? titleCell.textContent.trim() : "") ||
                "Untitled Tender";

              var department = cells[5] && cells[5].textContent ? cells[5].textContent.trim() : "";

              var publishedDate = cells[1] && cells[1].textContent ? cells[1].textContent.trim() : "";
              var closingDate = cells[2] && cells[2].textContent ? cells[2].textContent.trim() : "";
              for (var d = 0; d < cells.length; d += 1) {
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
              if (estCell && estCell.textContent) {
                estimatedCostRaw = estCell.textContent.trim();
              }
              if (!estimatedCostRaw && cells.length > 5 && cells[5] && cells[5].textContent) {
                estimatedCostRaw = cells[5].textContent.trim();
              }
              if (!estimatedCostRaw) {
                for (var c = 0; c < cells.length; c += 1) {
                  var cell = cells[c] || null;
                  var t = cell && cell.textContent ? cell.textContent.trim() : "";
                  if (t && (t.indexOf("Crore") >= 0 || t.indexOf("Lakh") >= 0)) {
                    estimatedCostRaw = t;
                    break;
                  }
                }
              }
              var detailNode = row.querySelector(":scope > td:nth-child(5) a");
              var detailURL = detailNode && detailNode.getAttribute("href") ? detailNode.getAttribute("href") : "";

              results.push({
                tenderNumber: tenderNumber,
                title: title,
                department: department,
                estimatedCostRaw: estimatedCostRaw,
                publishedDate: publishedDate,
                closingDate: closingDate,
                state: "",
                sourceURL: window.location.href,
                portal: window.location.hostname.indexOf("etenders") >= 0 ? "etenders" : "eprocure",
                detailURL: detailURL || undefined
              });
            }

            return results;
          }) as RawTenderRow[];

          for (const raw of rawRows) {
            const tenderNumber = extractTenderNumber(raw.tenderNumber, raw.title);
            const title = extractTitle(raw.title);
            const department = normalizeText(raw.department);
            if (!tenderNumber || !title || !department || looksLikeDate(department)) {
              continue;
            }
            if (department.length > 320 || title.length > 320) {
              continue;
            }
            if (/visitor no|screen reader|designed, developed and hosted|s\.?no/i.test(`${title} ${department}`)) {
              continue;
            }
            const totalEstimatedCostINR = parseCostFromText(raw.estimatedCostRaw);
            const detailURL = raw.detailURL ? new URL(raw.detailURL, raw.sourceURL || url).toString() : "";

            const state = mapStateFromOrg(department);
            const parsedProjectType = inferProjectType(title);
            const publishedDate = parseDate(raw.publishedDate);
            const closingDate = parseDate(raw.closingDate);
            const parsed: ParsedTender = {
              title,
              department,
              tenderNumber,
              totalEstimatedCostINR,
              state,
              projectType: parsedProjectType,
              sourcePortal,
              sourceURL: raw.sourceURL || url,
              ...(detailURL ? { detailURL } : {}),
              organisation: department,
              publishedDate,
              closingDate,
              locationText: `${title} ${department}`.trim(),
              scrapedQuery: searchTerm,
              scrapedYear: year,
              rawText: `${title} ${department}`.trim(),
              vendorName: department,
              procurementMethod: "open",
              contractYear: year,
              boqAvailable: false,
              boqDocumentURL: detailURL || null,
              costBreakdown: buildTenderCostBreakdown({
                totalEstimatedCostINR,
                projectType: parsedProjectType,
                state,
                lineItemCount: 0
              })
            };
            dedupedRows.set(tenderNumber, parsed);
            if (totalEstimatedCostINR <= 0) {
              logger.warn(`[eProcure] cost_not_extracted tenderNumber=${tenderNumber} org="${department.slice(0, 80)}"`);
            }
            if (dedupedRows.size >= maxRecords) break;
          }
        } catch (error) {
          console.warn(`[eProcure] query failed for ${sourcePortal}: ${searchTerm}`, error);
        }
      }
      if (dedupedRows.size >= maxRecords) break;
    }

    // In-session detail-fetch: use the live Puppeteer session to extract cost from detail pages.
    // eProcure detail pages require an active browser session — the sp= token is stored server-side
    // in the HTTP session and remains valid throughout the session (~20 min inactivity timeout).
    const pendingCost = Array.from(dedupedRows.values())
      .filter((t) => t.detailURL && t.totalEstimatedCostINR <= 0)
      .slice(0, 30);

    for (const parsed of pendingCost) {
      try {
        await page.goto(parsed.detailURL!, { waitUntil: "domcontentloaded", timeout: 15000 });

        const result: { cost: string; label: string; description: string; bodySnippet: string } = await page.evaluate(() => {
          const COST_LABELS = /tender value|estimated cost|contract value|total bid value|approximate cost|bid value|estimated amount|work value/i;
          const DESC_LABELS = /work.*description|work.*item.*description|brief.*description|scope.*work/i;

          let costLabel = "";
          let costValue = "";
          let description = "";

          // Strategy 1: td.td_caption paired with td.td_field (GePNIC eProcurement standard)
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

          // Strategy 3: regex search of full body text for Lakh/Crore amounts near known labels
          if (!costValue) {
            const bodyText = (document.body.innerText ?? "").replace(/\s+/g, " ");
            const match = bodyText.match(/(?:Tender Value|Estimated Cost|Contract Value|Bid Value|Approximate Cost)[^₹\d]*([₹\d][₹\d,. ]*(?:Lakh|Crore|lakh|crore|L|Cr)?)/i);
            if (match?.[1]) {
              costValue = match[1].trim();
            }
          }

          const bodySnippet = (document.body.innerText ?? "").replace(/\s+/g, " ").slice(0, 3000);
          return { cost: costValue, label: costLabel, description, bodySnippet };
        });

        if (result.cost) {
          let costText = result.cost;
          // If the label says "In Lakh" or "In Crore", annotate the value for parseCostFromText
          if (/in.{0,5}lakh/i.test(result.label) && !/lakh/i.test(costText)) {
            costText = `${costText} Lakh`;
          } else if (/in.{0,5}crore/i.test(result.label) && !/crore/i.test(costText)) {
            costText = `${costText} Crore`;
          }
          const cost = parseCostFromText(costText);
          if (cost > 0) {
            parsed.totalEstimatedCostINR = cost;
            logger.info(`[eProcure] detail cost: ${parsed.tenderNumber} ₹${cost} (label="${result.label}")`);
          }
        }
        if (result.description && result.description.length > 20) {
          parsed.locationText = result.description.substring(0, 200);
        }
        if (result.bodySnippet && result.bodySnippet.length > 0) {
          parsed.rawText = `${parsed.title} ${parsed.department} ${result.description} ${result.bodySnippet}`
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 8000);
        }
      } catch (err) {
        logger.warn(`[eProcure] detail fetch failed for ${parsed.tenderNumber}: ${err instanceof Error ? err.message : String(err)}`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return Array.from(dedupedRows.values());
}

async function fallbackWorldBank(yearsBack: number): Promise<ParsedTender[]> {
  const rowsPerPage = 200;
  const pages = [0, 200, 400];
  const datasets = await Promise.all(
    pages.map((os) =>
      client
        .get<{ projects?: Record<string, Record<string, string>> }>(
          `https://search.worldbank.org/api/v2/projects?format=json&countrycode=IN&qterm=india+infrastructure+tender&fl=id,project_name,totalamt,boardapprovaldate,status,sector,lendinginstr&rows=${rowsPerPage}&os=${os}`
        )
        .then((res) => res.data)
        .catch(() => ({ projects: {} }))
    )
  );
  const currentYear = new Date().getFullYear();
  const minimumYear = currentYear - Math.max(1, yearsBack) + 1;
  type WorldBankProject = {
    id?: string;
    project_name?: string;
    totalamt?: string;
    boardapprovaldate?: string;
    sector?: string;
  };
  const projects: WorldBankProject[] = datasets.flatMap((data) => Object.values(data.projects ?? {})) as WorldBankProject[];
  const rows: ParsedTender[] = [];
  for (const project of projects) {
      const id = project.id;
      const title = project.project_name;
      const totalAmt = Number((project.totalamt ?? "0").replace(/,/g, ""));
      if (!id || !title || totalAmt <= 0) continue;
      const approvedDate = parseDate(project.boardapprovaldate ?? "");
      const approvedYear = approvedDate ? approvedDate.getFullYear() : currentYear;
      if (approvedYear < minimumYear && rows.length > 40) continue;
      rows.push({
        title,
        department: "World Bank / Government of India",
        state: inferState(title, "World Bank / Government of India"),
        tenderNumber: `WB/${id}`,
        totalEstimatedCostINR: totalAmt * 83,
        projectType: inferProjectType(`${project.sector ?? ""} ${title}`),
        sourcePortal: "worldbank",
        sourceURL: `https://search.worldbank.org/api/v2/projects/${id}`,
        organisation: "World Bank / Government of India",
        publishedDate: approvedDate,
        closingDate: null,
        locationText: title,
        scrapedQuery: "worldbank northeast india infrastructure",
        scrapedYear: approvedYear,
        rawText: title,
        vendorName: "World Bank / Government of India",
        procurementMethod: "open",
        contractYear: approvedYear,
        boqAvailable: false,
        boqDocumentURL: null,
        costBreakdown: buildTenderCostBreakdown({
          totalEstimatedCostINR: totalAmt * 83,
          projectType: inferProjectType(`${project.sector ?? ""} ${title}`),
          state: inferState(title, "World Bank / Government of India"),
          lineItemCount: 0
        })
      });
  }
  return rows;
}

export const runEprocureScraper = async (options?: ScrapeOptions): Promise<{ found: number; inserted: number }> => {
  const yearsBack = options?.yearsBack ?? 3;
  const maxRecords = Math.max(100, Math.min(options?.maxRecords ?? 5000, 20000));
  const scope = options?.scope?.trim().toLowerCase();
  const scopeTerms =
    scope && scope !== "all_india"
      ? [scope]
      : scope === "all_india"
        ? INDIA_STATE_TERMS
        : SEARCH_QUERIES;
  const terms = (options?.terms && options.terms.length > 0 ? options.terms : scopeTerms)
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
  const portals = options?.portals ?? ["eprocure", "etenders", "worldbank"];
  const tasks: Array<Promise<ParsedTender[]>> = [];
  if (portals.includes("eprocure")) {
    tasks.push(scrapePortal("https://eprocure.gov.in/eprocure/app", "eprocure", yearsBack, terms, maxRecords).catch(() => []));
  }
  if (portals.includes("etenders")) {
    tasks.push(scrapePortal("https://etenders.gov.in/eprocure/app", "etenders", yearsBack, terms, maxRecords).catch(() => []));
  }

  const portalResults = await Promise.all(tasks);
  let tenders = portalResults.flat();
  if (portals.includes("worldbank")) {
    const wbRows = await fallbackWorldBank(yearsBack).catch(() => []);
    tenders = tenders.concat(wbRows);
  }
  if (tenders.length === 0 && portals.includes("worldbank")) {
    tenders = await fallbackWorldBank(yearsBack).catch(() => []);
  }
  const deduped = new Map<string, ParsedTender>();
  for (const tender of tenders) {
    if (scope && scope !== "all_india" && tender.state !== scope) {
      continue;
    }
    if (!deduped.has(tender.tenderNumber)) {
      deduped.set(tender.tenderNumber, tender);
    }
  }
  tenders = Array.from(deduped.values()).slice(0, maxRecords);
  const foundCount = tenders.length;

  if (tenders.length === 0) {
    return { found: 0, inserted: 0 };
  }
  const tenderNumbers = tenders.map((tender) => tender.tenderNumber);
  const existingRows = await TenderModel.find({ tenderNumber: { $in: tenderNumbers } })
    .select({ tenderNumber: 1, totalEstimatedCostINR: 1 })
    .lean();
  const existingSet = new Set(existingRows.map((row) => row.tenderNumber));

  // Update existing tenders that still have cost=0 if we now have cost data for them
  const zeroCostNumbers = new Set(
    existingRows
      .filter((row) => (row.totalEstimatedCostINR ?? 0) <= 0)
      .map((row) => row.tenderNumber)
  );
  const costUpdates = tenders
    .filter((t) => zeroCostNumbers.has(t.tenderNumber) && t.totalEstimatedCostINR > 0)
    .map((t) => ({
      updateOne: {
        filter: { tenderNumber: t.tenderNumber },
        update: {
          $set: {
            totalEstimatedCostINR: t.totalEstimatedCostINR,
            ...(t.detailURL ? { detailURL: t.detailURL } : {}),
            ...(t.locationText && t.locationText.length < 200 ? { locationText: t.locationText } : {}),
            rawText: t.rawText,
            vendorName: t.vendorName,
            procurementMethod: t.procurementMethod,
            contractYear: t.contractYear,
            boqDocumentURL: t.boqDocumentURL,
            boqAvailable: t.boqAvailable,
            costBreakdown: t.costBreakdown,
            itemizationStatus: (t.boqAvailable ? "partial" : "none") as "partial" | "none",
            dataCompletenessScore: t.boqAvailable ? 40 : 20
          }
        }
      }
    }));
  if (costUpdates.length > 0) {
    await TenderModel.bulkWrite(costUpdates);
    logger.info(`[eProcure] updated cost for ${costUpdates.length} existing zero-cost tenders`);
  }

  // Also fix rawText duplication on ALL existing tenders (not just zero-cost ones)
  const rawTextFixes = tenders
    .filter((t) => existingSet.has(t.tenderNumber) && !zeroCostNumbers.has(t.tenderNumber))
    .map((t) => ({
      updateOne: {
        filter: { tenderNumber: t.tenderNumber },
        update: {
          $set: {
            rawText: t.rawText,
            vendorName: t.vendorName,
            procurementMethod: t.procurementMethod,
            contractYear: t.contractYear,
            boqDocumentURL: t.boqDocumentURL,
            boqAvailable: t.boqAvailable,
            costBreakdown: t.costBreakdown
          }
        }
      }
    }));
  if (rawTextFixes.length > 0) {
    await TenderModel.bulkWrite(rawTextFixes);
  }

  const newTenders = tenders.filter((tender) => !existingSet.has(tender.tenderNumber));
  if (newTenders.length === 0) {
    return { found: foundCount, inserted: 0 };
  }

  const insertPayload = newTenders
    .filter((tender) => !/^\d/.test(tender.title))
    .map((tender) => ({
      title: tender.title,
      department: tender.department,
      state: tender.state,
      tenderNumber: tender.tenderNumber,
      totalEstimatedCostINR: tender.totalEstimatedCostINR,
      projectType: tender.projectType,
      lengthKm: null,
      sourceURL: tender.sourceURL,
      detailURL: tender.detailURL || null,
      uploadedBy: null,
      parsedAt: new Date(),
      rawText: tender.rawText,
      lineItems: [],
      status: "pending",
      sourcePortal: tender.sourcePortal,
      organisation: tender.organisation,
      publishedDate: tender.publishedDate,
      closingDate: tender.closingDate,
      locationText: tender.locationText,
      scrapedQuery: tender.scrapedQuery,
      scrapedYear: tender.scrapedYear,
      vendorName: tender.vendorName,
      procurementMethod: tender.procurementMethod,
      contractYear: tender.contractYear,
      boqAvailable: tender.boqAvailable,
      boqDocumentURL: tender.boqDocumentURL,
      costBreakdown: tender.costBreakdown,
      itemizationStatus: tender.boqAvailable ? "partial" : "none",
      dataCompletenessScore: tender.boqAvailable ? 40 : 20
    }));
  if (insertPayload.length === 0) {
    return { found: foundCount, inserted: 0 };
  }
  const inserted = await TenderModel.insertMany(insertPayload, { ordered: false });

  // Queue all inserted tenders for audit. Cost was already extracted during the Puppeteer
  // in-session detail-fetch (eProcure detail pages require a live browser session and cannot
  // be fetched statefully after the scrape session ends).
  for (const row of inserted) {
    await newTenderQueue.add("new-tender", { tenderId: row._id.toString() });
    logger.info(`[detail] ${row.tenderNumber}: cost=₹${row.totalEstimatedCostINR}, rawText length=${(row.rawText ?? "").length}`);
  }

  return { found: foundCount, inserted: inserted.length };
};

export async function diagnoseDOM(): Promise<void> {
  let browser: puppeteer.Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.goto(
      "https://etenders.gov.in/eprocure/app?component=%24DirectLink&page=FrontEndAdvancedSearchResult&service=page&searchStr=assam+infrastructure&itemsPerPage=5",
      { waitUntil: "networkidle2", timeout: 30_000 }
    );
    const tableHTML = await page.evaluate(() => {
      const tables = document.querySelectorAll("table");
      return Array.from(tables)
        .map((table, index) => `TABLE ${index}: ${table.outerHTML.substring(0, 2000)}`)
        .join("\n\n");
    });
    console.log("=== DOM DUMP ===");
    console.log(tableHTML);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
