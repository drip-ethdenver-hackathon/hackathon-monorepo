import { Tiktoken } from "@dqbd/tiktoken";
// @ts-ignore
import cl100k_base from "@dqbd/tiktoken/encoders/cl100k_base.json";

/**
 * Splits text into ~maxTokens-sized pieces based on the GPT-3.5/GPT-4
 * "cl100k_base" tokenizer. 
 *
 * Make sure your tsconfig.json has "resolveJsonModule": true.
 */
export function chunkText(fullText: string, maxTokens: number): string[] {
  // 1) Create the Tiktoken instance
  const tokenizer = new Tiktoken(
    cl100k_base.bpe_ranks,      // Record<string, number>
    cl100k_base.special_tokens, // { [tokenName: string]: number }
    cl100k_base.pat_str         // string regex pattern
  );

  // 2) Encode the entire string into tokens
  const tokens = tokenizer.encode(fullText);
  const chunks: string[] = [];

  // 3) Slice the token array into segments, then decode each back to text
  for (let i = 0; i < tokens.length; i += maxTokens) {
    const tokenSlice = tokens.slice(i, i + maxTokens);
    const chunkBytes = tokenizer.decode(tokenSlice);
    const chunkStr = Buffer.from(chunkBytes).toString("utf8");
    chunks.push(chunkStr);  }

  // 4) Free the tokenizer to avoid memory leaks in long-running processes
  tokenizer.free();

  return chunks;
}
