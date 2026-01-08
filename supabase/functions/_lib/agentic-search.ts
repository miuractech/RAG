/**
 * Agentic Search Engine for RAG
 * Implements iterative querying with automatic query reconstruction
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  generateQueryVariations,
  assessResultQuality,
  aggregateResults,
  shouldContinueIterating,
  type SearchResult,
  type AgenticResult
} from './query-agent';

export interface AgenticSearchConfig {
  maxIterations?: number;          // Maximum query attempts (default: 3)
  confidenceThreshold?: number;    // Stop if confidence exceeds this (default: 0.65)
  matchThreshold?: number;         // Similarity threshold for embeddings (default: 0.75)
  resultsPerQuery?: number;        // Documents to retrieve per query (default: 4)
  enableChaining?: boolean;        // Enable contextual query chaining (default: true)
  maxQueriesPerIteration?: number; // Max queries to try per iteration (default: 3)
  timeoutMs?: number;              // Overall timeout in milliseconds (default: 25000)
}

/**
 * Performs agentic search with automatic query reconstruction and chaining
 */
export async function performAgenticSearch(
  originalQuery: string,
  supabase: SupabaseClient,
  model: any, // Supabase AI Session
  config: AgenticSearchConfig = {}
): Promise<AgenticResult> {
  // Default configuration - optimized for edge functions
  const {
    maxIterations = 3,
    confidenceThreshold = 0.65,
    matchThreshold = 0.75,
    resultsPerQuery = 4,
    enableChaining = true,
    maxQueriesPerIteration = 3,
    timeoutMs = 25000
  } = config;

  const iterations: AgenticResult['iterations'] = [];
  const allResults: Array<{ query: string; results: SearchResult[]; strategy: string }> = [];
  
  let currentQuery = originalQuery;
  let iterationCount = 0;
  let bestConfidence = 0;
  let accumulatedResults: SearchResult[] = [];
  const startTime = Date.now();

  console.log(`[AgenticSearch] Starting with query: "${originalQuery}"`);

  // Main iteration loop with timeout protection
  while (shouldContinueIterating(iterationCount, maxIterations, bestConfidence, confidenceThreshold)) {
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      console.log(`[AgenticSearch] Timeout reached after ${iterationCount} iterations`);
      break;
    }
    iterationCount++;
    console.log(`[AgenticSearch] Iteration ${iterationCount}/${maxIterations}`);

    // Generate query variations for this iteration
    const variations = generateQueryVariations(
      originalQuery,
      iterationCount,
      accumulatedResults
    );

    // For first iteration, try original query first
    const queriesToTry = iterationCount === 1 
      ? [{ query: originalQuery, strategy: 'original', reasoning: 'Original user query' }, ...variations]
      : variations;

    // Limit queries per iteration to avoid resource exhaustion
    const limitedQueries = queriesToTry.slice(0, maxQueriesPerIteration);
    let queriesProcessedThisIteration = 0;

    // Try each query variation
    for (const variation of limitedQueries) {
      // Check timeout before each query
      if (Date.now() - startTime > timeoutMs) {
        console.log(`[AgenticSearch] Timeout reached, stopping queries`);
        break;
      }

      queriesProcessedThisIteration++;
      try {
        console.log(`[AgenticSearch] Trying: ${variation.strategy} - "${variation.query}"`);

        // Generate embedding for this query
        const embeddingOutput = await model.run(variation.query, {
          mean_pool: true,
          normalize: true,
        });

        const embedding = Array.from(embeddingOutput);

        // Search for matching documents
        const { data: documents, error: matchError } = await supabase
          .rpc('match_document_sections', {
            embedding,
            match_threshold: matchThreshold,
          })
          .select('content')
          .limit(resultsPerQuery);

        if (matchError) {
          console.error(`[AgenticSearch] Match error:`, matchError);
          continue;
        }

        const results: SearchResult[] = documents || [];
        
        // Assess quality of results
        const quality = assessResultQuality(results, originalQuery);
        console.log(`[AgenticSearch] ${variation.strategy} confidence: ${(quality.confidence * 100).toFixed(1)}%`);

        // Store results
        if (results.length > 0) {
          allResults.push({
            query: variation.query,
            results,
            strategy: variation.strategy
          });

          accumulatedResults.push(...results);
          
          // Track best confidence
          if (quality.confidence > bestConfidence) {
            bestConfidence = quality.confidence;
          }

          // Record iteration
          iterations.push({
            query: variation.query,
            strategy: variation.strategy,
            resultsFound: results.length,
            confidence: quality.confidence
          });

          // If we found high-confidence results, stop early
          if (quality.hasDirectAnswer && quality.confidence >= confidenceThreshold) {
            console.log(`[AgenticSearch] High confidence answer found, stopping early`);
            break;
          }
        }

      } catch (error) {
        console.error(`[AgenticSearch] Error with variation ${variation.strategy}:`, error);
        continue;
      }
    }

    // If we found good results this iteration, consider stopping
    if (bestConfidence >= confidenceThreshold) {
      break;
    }

    // Check if we should continue
    if (bestConfidence >= confidenceThreshold) {
      console.log(`[AgenticSearch] Confidence threshold met (${(bestConfidence * 100).toFixed(1)}%)`);
      break;
    }

    // For chaining: use context from previous results to refine next query
    if (enableChaining && accumulatedResults.length > 0) {
      // Extract key concepts from results so far
      const contextSnippet = accumulatedResults
        .slice(0, 3)
        .map(r => r.content.slice(0, 200))
        .join(' ');
      
      currentQuery = `${originalQuery} (context: ${contextSnippet.slice(0, 100)}...)`;
    }
  }

  // Aggregate all results
  const aggregatedContext = aggregateResults(allResults);

  console.log(`[AgenticSearch] Completed in ${iterationCount} iterations with ${allResults.length} total queries`);
  console.log(`[AgenticSearch] Final confidence: ${(bestConfidence * 100).toFixed(1)}%`);

  // Generate final answer instruction
  let finalAnswerGuidance = '';
  if (bestConfidence < 0.3) {
    finalAnswerGuidance = '\n\n[Note: Confidence is low. The AI should acknowledge uncertainty.]';
  } else if (bestConfidence < 0.6) {
    finalAnswerGuidance = '\n\n[Note: Moderate confidence. The AI should provide available information but note limitations.]';
  } else {
    finalAnswerGuidance = '\n\n[Note: High confidence. The AI can provide a comprehensive answer.]';
  }

  return {
    finalAnswer: '', // Will be generated by OpenAI
    iterations,
    totalQueries: allResults.length,
    aggregatedContext: aggregatedContext + finalAnswerGuidance
  };
}

/**
 * Generates an enhanced system prompt for the agentic search results
 */
export function generateAgenticSystemPrompt(
  agenticResult: AgenticResult,
  originalQuery: string
): string {
  const { aggregatedContext, iterations, totalQueries } = agenticResult;
  
  const searchSummary = iterations.length > 0
    ? `\n\nSearch Process Summary:
- Total query variations attempted: ${totalQueries}
- Iterations performed: ${iterations.length}
- Strategies used: ${iterations.map(i => i.strategy).join(', ')}
- Best confidence: ${(Math.max(...iterations.map(i => i.confidence)) * 100).toFixed(1)}%
`
    : '';

  return `You are an AI assistant specialized in answering questions from documents using an advanced agentic retrieval system.

The system has performed multiple query variations and reconstructions to find the best answer to the user's question.

Original Question: "${originalQuery}"
${searchSummary}

Instructions:
1. Use the documents below to answer the question comprehensively
2. If multiple perspectives or pieces of information are available, synthesize them into a coherent answer
3. If the information is partial or uncertain, acknowledge this clearly
4. If no relevant information is found, say: "I couldn't find specific information about that in the available documents."
5. Be conversational and concise, but thorough
6. If you found related information but not a direct answer, explain what you found and how it relates

Documents Retrieved:
${aggregatedContext || 'No relevant documents found.'}

Now, answer the user's question based on the above context.`;
}

