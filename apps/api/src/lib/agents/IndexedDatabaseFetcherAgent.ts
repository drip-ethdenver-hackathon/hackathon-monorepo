import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAI } from "openai";
import { BaseWalletAgent } from "./BaseWalletAgent";

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || "docs-index";
// If you're using a specific Pinecone namespace:
const PINECONE_NAMESPACE = process.env.PINECONE_NAMESPACE || "docs";

export class IndexedDatabaseFetcherAgent extends BaseWalletAgent {
  private pineconeClient: Pinecone;
  private openaiClient: OpenAI;

  constructor(
    pineconeClient: Pinecone,
    openaiApiKey: string,
    cdpApiKeyPrivateKey: string = ""
  ) {
    super(process.env.CDP_API_KEY_NAME || "", process.env.CDP_API_KEY_PRIVATE || "");
    this.pineconeClient = pineconeClient;
    this.openaiClient = new OpenAI({
      apiKey: openaiApiKey,
    });
  }

  getName(): string {
    return "indexed_database_fetcher";
  }

  getDescription(): string {
    return "Fetches relevant doc snippets from Pinecone";
  }

  getParametersJsonSchema(): object {
    return {
      type: "object",
      properties: {
        userQuery: {
          type: "string",
          description: "The user's query or search phrase",
        },
        topK: {
          type: "number",
          description: "How many results to return",
          default: 3,
        },
      },
      required: ["userQuery"],
    };
  }

  getContextInfo(): string {
    return this.recentAction || "No recent action.";
  }

  async handleTask(args: any): Promise<any> {
    try {
      const { userQuery, topK = 3 } = args;

      this.recentAction = `Fetching documents for query: ${userQuery}`;

      // 1) Embed the user's query using OpenAI
      const embedding = await this.createEmbedding(userQuery);

      // 2) Get the index handle
      const index = this.pineconeClient.index(PINECONE_INDEX_NAME);

      // Optional: Check if the index actually exists
      const { indexes } = await this.pineconeClient.listIndexes();
      // 'indexes' is an array of IndexModel objects like: [{ name, dimension, metric, status, ... }, ... ]
      const indexExists = indexes.some((i) => i.name === PINECONE_INDEX_NAME);
      if (!indexExists) {
        this.recentAction = `Index '${PINECONE_INDEX_NAME}' not found in Pinecone.`;
        return {
          success: false,
          message: `Index '${PINECONE_INDEX_NAME}' does not exist in Pinecone.`,
          contexts: [],
        };
      }

      // (Optional) Get index stats for debugging
      const stats = await index.describeIndexStats();
      console.log("Index stats:", JSON.stringify(stats));

      // 3) Perform the similarity search in the specified namespace
      //    Since 'namespace' is NOT accepted in query() directly, we chain .namespace(...).
      const queryResponse = await index.namespace(PINECONE_NAMESPACE).query({
        vector: embedding,
        topK,
        includeMetadata: true,
      });

      if (!queryResponse.matches || queryResponse.matches.length === 0) {
        this.recentAction = `No matches found for query: ${userQuery}`;
        return {
          success: false,
          message: "No relevant documents found for your query.",
          contexts: [],
        };
      }

      // 4) Extract text snippets from metadata
      const contexts: string[] = [];
      for (const match of queryResponse.matches) {
        const snippet = match.metadata?.text as string | undefined;
        if (snippet) {
          contexts.push(snippet);
        }
      }

      this.recentAction = `Found ${contexts.length} relevant document snippets.`;

      return {
        success: true,
        message: `Found ${contexts.length} relevant document snippets.`,
        contexts,
      };
    } catch (error: any) {
      this.recentAction = `Error fetching documents: ${error.message}`;
      console.error("Error in IndexedDatabaseFetcherAgent:", error);
      return {
        success: false,
        message: `Error fetching documents: ${error.message}`,
        contexts: [],
      };
    }
  }

  /**
   * Helper: create an embedding for the query using OpenAI.
   */
  private async createEmbedding(text: string): Promise<number[]> {
    // Use a valid public OpenAI embedding model, e.g. text-embedding-3-large
    const response = await this.openaiClient.embeddings.create({
      model: "text-embedding-3-large",
      input: text,
    });

    // The endpoint returns an array of data; we just want the first
    const [{ embedding }] = response.data;
    return embedding;
  }
}
