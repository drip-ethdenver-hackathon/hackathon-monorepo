// src/ingestion.ts

import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAI } from "openai";
import { chunkText } from "./textChunker";
import dotenv from "dotenv";

// 1. Environment Variables
dotenv.config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || "";
const PINECONE_ENV = process.env.PINECONE_ENV || ""; // e.g., "us-west-2"
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || "docs-index";

// 2. Singletons for Pinecone client & index
let pineconeClient: Pinecone | null = null;

// 3. Initialize Pinecone client & ensure index exists
async function initPinecone() {
  console.time("initPinecone");
  console.log("[PINECONE] Initializing Pinecone client...");
  
  if (!pineconeClient) {
    console.log("[PINECONE] Creating new Pinecone client instance");
    pineconeClient = new Pinecone({
      apiKey: PINECONE_API_KEY,
      // Optionally pass maxRetries, fetchApi, etc.
    });

    // Check if index exists; create if not
    console.time("listIndexes");
    console.log("[PINECONE] Listing indexes to check if target index exists");
    const { indexes } = await pineconeClient.listIndexes();
    console.timeEnd("listIndexes");
    
    const exists = indexes.some((i) => i.name === PINECONE_INDEX_NAME);
    console.log(`[PINECONE] Index '${PINECONE_INDEX_NAME}' exists: ${exists}`);
    
    if (!exists) {
      console.log(`[PINECONE] Creating new index '${PINECONE_INDEX_NAME}'`);
      console.time("createIndex");
      // For a serverless index w/ dimension=3072 (Ada embeddings) & cosine similarity
      await pineconeClient.createIndex({
        name: PINECONE_INDEX_NAME,
        dimension: 3072,
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: PINECONE_ENV || "us-east-1",
          },
        },
        waitUntilReady: true,
      });
      console.timeEnd("createIndex");
      console.log(`[PINECONE] Index '${PINECONE_INDEX_NAME}' created successfully`);
    }
  } else {
    console.log("[PINECONE] Using existing Pinecone client instance");
  }
  
  console.timeEnd("initPinecone");
}

// 4. OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

/**
 * Create an embedding for a single chunk using OpenAI's "text-embedding-3-large".
 */
async function createEmbedding(text: string): Promise<number[]> {
  console.time(`embedding_chunk_${text.slice(0, 20).replace(/\s+/g, '_')}`);
  console.log(`[OPENAI] Creating embedding for text chunk (${text.length} chars)`);
  
  const resp = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
  });
  
  console.timeEnd(`embedding_chunk_${text.slice(0, 20).replace(/\s+/g, '_')}`);
  console.log(`[OPENAI] Embedding created successfully (dimension: ${resp.data[0].embedding.length})`);
  
  // The embeddings array is returned under resp.data[0].embedding
  return resp.data[0].embedding;
}

/**
 * Ingest a block of text (from a single page) into Pinecone:
 *  1) chunk the text
 *  2) embed each chunk
 *  3) upsert into the "docs" namespace
 */
export async function ingestPageContent(text: string, sourceUrl: string): Promise<number> {
  console.time("ingestPageContent");
  console.log(`[INGEST] Starting ingestion for URL: ${sourceUrl}`);
  console.log(`[INGEST] Text length: ${text.length} characters`);
  
  // Ensure Pinecone is ready
  console.log("[INGEST] Initializing Pinecone");
  await initPinecone();
  if (!pineconeClient) {
    console.error("[INGEST] ERROR: Pinecone client not initialized");
    throw new Error("Pinecone client not initialized.");
  }

  // 1) Get handle to the index
  console.log(`[INGEST] Getting handle to index '${PINECONE_INDEX_NAME}'`);
  const pineconeIndex = pineconeClient.index(PINECONE_INDEX_NAME);

  // 2) Chunk the text (e.g., ~200 tokens)
  console.time("chunkText");
  console.log(`[INGEST] Chunking text into ~200 token segments`);
  const chunks = chunkText(text, 200);
  console.timeEnd("chunkText");
  console.log(`[INGEST] Text chunked into ${chunks.length} segments`);

  // 3) Create embeddings & prepare data
  console.time("createAllEmbeddings");
  console.log(`[INGEST] Creating embeddings for ${chunks.length} chunks`);
  const vectors = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`[INGEST] Processing chunk ${i+1}/${chunks.length}`);
    const chunk = chunks[i];
    console.time(`chunk_${i+1}`);
    const embedding = await createEmbedding(chunk);
    console.timeEnd(`chunk_${i+1}`);

    vectors.push({
      id: `${sourceUrl}-${i}`,
      values: embedding,
      metadata: {
        text: chunk,
        sourceUrl,
        chunkIndex: i,
      },
    });
  }
  console.timeEnd("createAllEmbeddings");
  console.log(`[INGEST] All ${vectors.length} embeddings created successfully`);

  // 4) Upsert to the "docs" namespace
  console.time("pineconeUpsert");
  console.log(`[INGEST] Upserting ${vectors.length} vectors to Pinecone namespace 'docs'`);
  const BATCH_SIZE = 50;
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    
    // Upsert in smaller chunks
    await pineconeIndex.namespace("docs").upsert(batch);
    console.log(`Upserted batch ${i/BATCH_SIZE + 1} of size ${batch.length}`);
  }
  console.timeEnd("pineconeUpsert");
  console.log(`[INGEST] Upsert complete for ${vectors.length} vectors`);

  console.timeEnd("ingestPageContent");
  console.log(`[INGEST] Completed ingestion for URL: ${sourceUrl}`);
  
  return chunks.length;
}
