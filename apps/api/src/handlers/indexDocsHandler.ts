// src/handlers/indexDocsHandler.ts

import { Request, Response } from "express";
import axios from "axios";
import { load } from "cheerio";
import { ingestPageContent } from "../lib/scraper/ingestion";
import dotenv from "dotenv";

dotenv.config();

//
// Use your "Zyte API" key, not the old Smart Proxy Manager key.
//
const ZYTE_API_KEY = process.env.ZYTE_API_KEY || "";

// MAIN DIFFERENCE: Use `api.zyte.com` instead of `proxy.zyte.com`
const ZYTE_PROXY_HOST = "api.zyte.com";
const ZYTE_PROXY_PORT = 8011;

interface CrawlOptions {
  url: string;
  maxDepth?: number;
  allowedDomains?: string[];
  maxPages?: number;
}

interface CrawlStats {
  visitedCount: number;
  processedCount: number;
  visited: Set<string>;
}

export async function indexDocsHandler(req: Request, res: Response) {
  console.time("indexDocsHandler");
  console.log("[INDEXER] Starting document indexing process");
  
  try {
    // 1. Read input
    const { url, maxDepth = 2, allowedDomains = [], maxPages = 50 } =
      req.body as CrawlOptions;

    console.log(`[INDEXER] Request params: url=${url}, maxDepth=${maxDepth}, maxPages=${maxPages}`);
    console.log(`[INDEXER] Allowed domains: ${allowedDomains.length ? allowedDomains.join(', ') : 'none specified'}`);

    if (!url) {
      console.error('[INDEXER] ERROR: Missing "url" field in request body');
      return res
        .status(400)
        .json({ error: 'Missing "url" field in JSON body.' });
    }

    if (allowedDomains.length === 0) {
      allowedDomains.push(new URL(url).hostname);
      console.log(`[INDEXER] Using hostname from URL as allowed domain: ${allowedDomains[0]}`);
    }

    const visited = new Set<string>();
    let processedCount = 0;

    // BFS Queue
    const queue = [{ url, depth: 0 }];
    console.log(`[INDEXER] Initial queue with starting URL: ${url}`);

    // 2. Build the Basic Auth string for Zyte API
    console.log(`[INDEXER] Setting up Zyte API credentials`);
    const encodedCreds = Buffer.from(`${ZYTE_API_KEY}:`).toString("base64");

    console.time("crawlProcess");
    while (queue.length > 0) {
      const { url: currentUrl, depth } = queue.shift()!;
      console.log(`[INDEXER] Processing URL: ${currentUrl} (depth: ${depth})`);
      
      if (visited.has(currentUrl)) {
        console.log(`[INDEXER] Skipping already visited URL: ${currentUrl}`);
        continue;
      }
      visited.add(currentUrl);
      console.log(`[INDEXER] Visited URLs count: ${visited.size}`);

      // 3. Make a raw GET request via Zyte API's Proxy Mode
      let html = "";
      try {
        console.time(`fetch_${currentUrl.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}`);
        console.log(`[INDEXER] Fetching URL via Zyte API: ${currentUrl}`);
        const resp = await axios.get<string>(currentUrl, {
          proxy: {
            protocol: "http", // Important: it's an HTTP proxy
            host: "api.zyte.com",
            port: 8011,
            auth: {
              username: ZYTE_API_KEY,
              password: "", // empty string
            },
          },
          headers: {
            // "Proxy-Authorization" is how you authenticate with Zyte API Proxy Mode
            "Proxy-Authorization": `Basic ${encodedCreds}`,
          },
          // Any other Axios config, e.g. timeout
        });
        html = resp.data;
        console.timeEnd(`fetch_${currentUrl.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}`);
        console.log(`[INDEXER] Successfully fetched HTML (${html.length} bytes)`);
      } catch (err: any) {
        console.warn(`[INDEXER] Fetch failed for ${currentUrl}:`, err.message);
        continue;
      }

      // 4. Extract text from the HTML
      console.time("extractText");
      console.log(`[INDEXER] Extracting text from HTML`);
      const pageText = extractAllText(html);
      console.timeEnd("extractText");
      console.log(`[INDEXER] Extracted text length: ${pageText.length} characters`);

      // 5. Ingest if we got text
      if (pageText.trim()) {
        console.time(`ingest_${currentUrl.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}`);
        console.log(`[INDEXER] Ingesting content from ${currentUrl}`);
        await ingestPageContent(pageText, currentUrl);
        console.timeEnd(`ingest_${currentUrl.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}`);
        
        processedCount++;
        console.log(`[INDEXER] Pages processed: ${processedCount}/${maxPages}`);
      } else {
        console.log(`[INDEXER] Skipping ingestion - no text content found`);
      }

      // 6. BFS: parse out links
      if (depth < maxDepth && processedCount < maxPages) {
        console.time("parseLinks");
        console.log(`[INDEXER] Parsing links from HTML (current depth: ${depth}, max: ${maxDepth})`);
        const newLinks = parseLinks(html, currentUrl, allowedDomains);
        console.timeEnd("parseLinks");
        console.log(`[INDEXER] Found ${newLinks.length} links within allowed domains`);
        
        for (const link of newLinks) {
          if (!visited.has(link)) {
            queue.push({ url: link, depth: depth + 1 });
            console.log(`[INDEXER] Added to queue: ${link} (depth: ${depth + 1})`);
          }
        }
        console.log(`[INDEXER] Queue size after adding links: ${queue.length}`);
      }

      if (processedCount >= maxPages) {
        console.log(`[INDEXER] Reached maximum pages limit (${maxPages}). Stopping.`);
        break;
      }
    }
    console.timeEnd("crawlProcess");

    const stats: CrawlStats = {
      visitedCount: visited.size,
      processedCount,
      visited,
    };

    console.log(`[INDEXER] Crawl complete. Stats: visited=${stats.visitedCount}, processed=${stats.processedCount}`);
    console.timeEnd("indexDocsHandler");
    
    return res.json({
      status: "success",
      stats: {
        visitedCount: stats.visitedCount,
        processedCount: stats.processedCount,
      },
    });
  } catch (error: any) {
    console.error("[INDEXER] Error in indexDocsHandler:", error);
    console.timeEnd("indexDocsHandler");
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Extract every piece of text from the <body>, ignoring script and style tags.
 */
function extractAllText(html: string): string {
  const $ = load(html);
  $("script, style, noscript").remove();

  let pageText = "";
  $("body *").each((_, el) => {
    const text = $(el).text().trim();
    if (text) pageText += text + "\n";
  });

  return pageText;
}

/**
 * Parse all links from HTML, restricting to certain domains.
 */
function parseLinks(
  html: string,
  baseUrl: string,
  allowedDomains: string[]
): string[] {
  const $ = load(html);
  const links: string[] = [];

  $("a[href]").each((_, el) => {
    const rawHref = $(el).attr("href");
    if (!rawHref) return;

    const absoluteUrl = new URL(rawHref, baseUrl).href;
    const domain = new URL(absoluteUrl).hostname;
    if (allowedDomains.includes(domain)) {
      links.push(absoluteUrl);
    }
  });

  return links;
}
