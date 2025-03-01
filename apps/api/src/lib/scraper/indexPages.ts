import axios from 'axios';
import { load } from 'cheerio';
import { ingestPageContent } from './ingestion';

interface IndexOptions {
  url: string;
  maxDepth?: number;
  allowedDomains?: string[];
  maxPages?: number;
}

export interface IndexResult {
  visitedCount: number;
  processedCount: number;
  visited: Set<string>;
}

/**
 * Performs a BFS crawl from the given root URL
 * and indexes each page’s text into Pinecone.
 */
export async function indexPages(options: IndexOptions): Promise<IndexResult> {
  const { url, maxDepth = 2, allowedDomains = [], maxPages = 50 } = options;

  // Default to the primary domain if none is provided
  if (allowedDomains.length === 0) {
    allowedDomains.push(new URL(url).hostname);
  }

  const visited = new Set<string>();
  let processedCount = 0;
  const queue = [{ url, depth: 0 }];

  while (queue.length > 0) {
    const { url: currentUrl, depth } = queue.shift()!;
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    let html = '';
    try {
      const resp = await axios.get<string>(currentUrl);
      html = resp.data;
    } catch (err: any) {
      console.warn(`Failed to fetch ${currentUrl}:`, err.message);
      continue;
    }

    // Extract text
    const pageText = extractAllText(html);

    // Ingest if we got non-empty text
    if (pageText.trim()) {
      await ingestPageContent(pageText, currentUrl);
      processedCount++;
    }

    // BFS expansion
    if (depth < maxDepth && processedCount < maxPages) {
      const newLinks = parseLinks(html, currentUrl, allowedDomains);
      for (const link of newLinks) {
        if (!visited.has(link)) {
          queue.push({ url: link, depth: depth + 1 });
        }
      }
    }

    if (processedCount >= maxPages) break;
  }

  return {
    visitedCount: visited.size,
    processedCount,
    visited,
  };
}

function extractAllText(html: string): string {
  const $ = load(html);
  $('script, style, noscript').remove();

  let pageText = '';
  $('body *').each((_, el) => {
    const text = $(el).text().trim();
    if (text) pageText += text + '\n';
  });
  return pageText;
}

function parseLinks(html: string, baseUrl: string, allowedDomains: string[]): string[] {
  const $ = load(html);
  const links: string[] = [];

  $('a[href]').each((_, el) => {
    const rawHref = $(el).attr('href');
    if (!rawHref) return;

    const absoluteUrl = new URL(rawHref, baseUrl).href;
    const domain = new URL(absoluteUrl).hostname;
    if (allowedDomains.includes(domain)) {
      links.push(absoluteUrl);
    }
  });

  return links;
}
