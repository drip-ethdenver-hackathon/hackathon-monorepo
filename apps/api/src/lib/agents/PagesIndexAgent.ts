import { Agent } from '../framework/Agent';
import { indexPages } from '../scraper/indexPages'; // <-- the file above
import { BaseWalletAgent } from './BaseWalletAgent';
/**
 * An agent that crawls pages (by BFS) and indexes them into Pinecone.
 */
export class PagesIndexAgent extends BaseWalletAgent {
  public recentAction: string = 'No recent action.';
  private environment?: any;
  private lastEnvUpdate: number = 0;
  private environmentUpdateInterval = 5 * 60_1000; // 5 minutes

  getName(): string {
    return 'index_pages';
  }

  getDescription(): string {
    return 'Crawl a given URL (with optional allowed domains) and index their content into Pinecone.';
  }

  getParametersJsonSchema(): object {
    return {
      type: 'object',
      properties: {
        url: { 
          type: 'string', 
          description: 'Root URL to start crawling' 
        },
        maxDepth: { 
          type: 'number', 
          default: 2 
        },
        allowedDomains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional domains to include in crawling. If empty, only the root domain is used.'
        },
        maxPages: { 
          type: 'number', 
          default: 50 
        },
      },
      required: ['url'],
    };
  }

  getContextInfo(): string {
    return this.recentAction;
  }

  async shouldUpdateEnvironment(): Promise<boolean> {
    const now = Date.now();
    return now - this.lastEnvUpdate > this.environmentUpdateInterval;
  }

  async initializeEnvironment(envData: any): Promise<void> {
    this.environment = envData;
    this.lastEnvUpdate = Date.now();
    this.recentAction = 'Environment updated for PagesIndexAgent';
  }

  /**
   * The main method to handle the indexing task.
   */
  async handleTask(args: any): Promise<any> {
    try {
      const { url, maxDepth, allowedDomains, maxPages } = args;

      this.recentAction = `Starting crawl: ${url}`;
      const result = await indexPages({
        url,
        maxDepth,
        allowedDomains: allowedDomains || [],
        maxPages,
      });

      this.recentAction = `Crawl finished. Visited=${result.visitedCount}, Processed=${result.processedCount}`;
      return {
        success: true,
        message: `Indexed ${result.processedCount} pages (out of ${result.visitedCount} visited).`,
        stats: {
          visited: result.visitedCount,
          processed: result.processedCount,
        },
      };
    } catch (error: any) {
      console.error('Error in PagesIndexAgent:', error);
      this.recentAction = `Error while indexing: ${error.message}`;
      return {
        success: false,
        message: 'Failed to index pages',
      };
    }
  }
}
