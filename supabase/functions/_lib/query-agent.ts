/**
 * Agentic Query Construction and Chaining Library
 * Implements intelligent query reconstruction and iterative refinement for RAG systems
 */

export interface QueryVariation {
  query: string;
  strategy: string;
  reasoning: string;
}

export interface SearchResult {
  content: string;
  similarity?: number;
}

export interface AgenticResult {
  finalAnswer: string;
  iterations: {
    query: string;
    strategy: string;
    resultsFound: number;
    confidence: number;
  }[];
  totalQueries: number;
  aggregatedContext: string;
}

/**
 * Generate alternative query formulations based on the original question
 */
export function generateQueryVariations(
  originalQuery: string,
  iteration: number,
  previousResults: SearchResult[]
): QueryVariation[] {
  const variations: QueryVariation[] = [];
  
  // For first iteration, focus on most effective strategies
  if (iteration === 1) {
    // Strategy 1: Extract key entities and broaden the question
    variations.push({
      query: extractBroaderContext(originalQuery),
      strategy: 'broader_context',
      reasoning: 'Extracting main topic to find general information'
    });
    
    // Strategy 2: Reformulate as "what" question
    variations.push({
      query: reformulateAsWhat(originalQuery),
      strategy: 'what_question',
      reasoning: 'Reformulating as a what/which question for factual retrieval'
    });
    
    // Strategy 3: Simplify and remove specifics
    variations.push({
      query: simplifyQuery(originalQuery),
      strategy: 'simplified',
      reasoning: 'Removing specific constraints to find related information'
    });
  } else {
    // For subsequent iterations, try different approaches
    
    // Break down into component questions (only if needed)
    const componentQuestions = breakDownQuery(originalQuery);
    if (componentQuestions.length > 0) {
      variations.push({
        query: componentQuestions[0], // Take first component only
        strategy: 'component',
        reasoning: 'Breaking down complex query into simpler parts'
      });
    }
    
    // Reformulate as "how" question
    variations.push({
      query: reformulateAsHow(originalQuery),
      strategy: 'how_question',
      reasoning: 'Reformulating to understand process or mechanism'
    });
    
    // Extract context from previous results (if available)
    if (previousResults.length > 0) {
      const contextualQuery = buildContextualQuery(originalQuery, previousResults);
      variations.push({
        query: contextualQuery,
        strategy: 'contextual_refinement',
        reasoning: 'Using context from previous searches to refine query'
      });
    }
    
    // Focus on key terms only
    variations.push({
      query: extractKeyTerms(originalQuery),
      strategy: 'key_terms',
      reasoning: 'Focusing on essential keywords'
    });
  }
  
  // Limit total variations to avoid resource exhaustion
  return variations.slice(0, 4);
}

/**
 * Extracts broader context from a specific question
 * Example: "Does it respond at 10 deg C?" -> "What factors affect response temperature?"
 */
function extractBroaderContext(query: string): string {
  // Remove specific numbers and values
  let broader = query.replace(/\d+(\.\d+)?\s*(deg|degrees|°|celsius|fahrenheit|C|F|%|percent|km|m|cm|mm|g|kg|lb)/gi, 'specific temperature/value');
  
  // Transform yes/no questions to open-ended
  if (broader.toLowerCase().startsWith('does') || broader.toLowerCase().startsWith('is') || 
      broader.toLowerCase().startsWith('can') || broader.toLowerCase().startsWith('will')) {
    broader = broader.replace(/^(does|is|can|will|do|are)\s+/i, 'What are the conditions for ');
    broader = broader.replace(/\?$/, ' and what factors are involved?');
  }
  
  return broader;
}

/**
 * Breaks down complex queries into simpler component questions
 */
function breakDownQuery(query: string): string[] {
  const components: string[] = [];
  
  // Extract main subject
  const subjectMatch = query.match(/about\s+(\w+)|regarding\s+(\w+)|(\w+)\s+(respond|react|work|function|behave)/i);
  if (subjectMatch) {
    const subject = subjectMatch[1] || subjectMatch[2] || subjectMatch[3];
    components.push(`What is ${subject}?`);
    components.push(`What are the properties of ${subject}?`);
  }
  
  // Extract conditions mentioned
  const conditionMatch = query.match(/at\s+([^?]+)/i);
  if (conditionMatch) {
    const condition = conditionMatch[1];
    components.push(`What conditions are relevant here?`);
    components.push(`What are the typical ranges or values discussed?`);
  }
  
  // If query mentions specific action
  const actionMatch = query.match(/(respond|react|work|function|behave|operate|perform)/i);
  if (actionMatch) {
    const action = actionMatch[1];
    components.push(`How does this ${action}?`);
    components.push(`What factors affect this ${action}?`);
  }
  
  return components.filter(c => c.length > 0);
}

/**
 * Reformulates query as a "what" question
 */
function reformulateAsWhat(query: string): string {
  // If already a what question, return as is
  if (query.toLowerCase().startsWith('what')) {
    return query;
  }
  
  // Extract key terms
  const terms = extractKeyTerms(query);
  
  // Transform to what question
  if (query.match(/does|is|can|will/i)) {
    return `What information is available about ${terms}?`;
  }
  
  return `What are the details regarding ${terms}?`;
}

/**
 * Reformulates query as a "how" question
 */
function reformulateAsHow(query: string): string {
  // Extract main action or property
  const actionMatch = query.match(/(respond|react|work|function|behave|operate|perform|affect|influence|change)/i);
  
  if (actionMatch) {
    const action = actionMatch[1];
    return `How does this ${action}?`;
  }
  
  const terms = extractKeyTerms(query);
  return `How does ${terms} work?`;
}

/**
 * Builds a contextual query based on previous results
 */
function buildContextualQuery(originalQuery: string, previousResults: SearchResult[]): string {
  // Extract key concepts from previous results
  const combinedText = previousResults.map(r => r.content).join(' ').toLowerCase();
  
  // Look for mentions of related concepts
  const concepts = extractConceptsFromText(combinedText);
  
  if (concepts.length > 0) {
    return `${originalQuery} related to ${concepts.slice(0, 3).join(', ')}`;
  }
  
  return originalQuery;
}

/**
 * Extracts key concepts from text
 */
function extractConceptsFromText(text: string): string[] {
  // Simple concept extraction - in production, use NLP
  const words = text.split(/\s+/);
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been']);
  
  const concepts = words
    .filter(w => w.length > 4 && !stopWords.has(w))
    .filter((v, i, a) => a.indexOf(v) === i) // unique
    .slice(0, 10);
  
  return concepts;
}

/**
 * Simplifies query by removing specific constraints
 */
function simplifyQuery(query: string): string {
  let simplified = query;
  
  // Remove specific numbers and measurements
  simplified = simplified.replace(/\d+(\.\d+)?\s*[a-zA-Z°%]+/g, '');
  
  // Remove question marks and make it a search phrase
  simplified = simplified.replace(/\?/g, '');
  
  // Remove yes/no question starters
  simplified = simplified.replace(/^(does|is|can|will|do|are)\s+/i, '');
  
  // Clean up extra spaces
  simplified = simplified.replace(/\s+/g, ' ').trim();
  
  return simplified;
}

/**
 * Extracts key terms from the query
 */
function extractKeyTerms(query: string): string {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'does', 'is', 'can', 'will', 'what', 'how', 'when', 'where', 'why', 'it', 'this', 'that']);
  
  const words = query.toLowerCase()
    .replace(/[?.,!]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  return words.join(' ');
}

/**
 * Assesses the quality and relevance of search results
 */
export function assessResultQuality(
  results: SearchResult[],
  originalQuery: string
): { confidence: number; hasDirectAnswer: boolean; reasoning: string } {
  if (!results || results.length === 0) {
    return {
      confidence: 0,
      hasDirectAnswer: false,
      reasoning: 'No results found'
    };
  }
  
  // Calculate average similarity if available
  const avgSimilarity = results.reduce((sum, r) => sum + (r.similarity || 0), 0) / results.length;
  
  // Check if results contain key terms from query
  const queryTerms = extractKeyTerms(originalQuery).split(' ');
  const combinedResults = results.map(r => r.content.toLowerCase()).join(' ');
  
  const termsFound = queryTerms.filter(term => 
    combinedResults.includes(term.toLowerCase())
  ).length;
  
  const termCoverage = termsFound / Math.max(queryTerms.length, 1);
  
  // Calculate confidence based on multiple factors
  const confidence = (
    (avgSimilarity * 0.4) +  // Similarity score weight
    (termCoverage * 0.3) +   // Term coverage weight
    (Math.min(results.length / 5, 1) * 0.3)  // Result count weight (up to 5)
  );
  
  const hasDirectAnswer = confidence > 0.6 && results.length >= 2;
  
  return {
    confidence,
    hasDirectAnswer,
    reasoning: hasDirectAnswer 
      ? `Found ${results.length} relevant results with ${(confidence * 100).toFixed(0)}% confidence`
      : `Low confidence (${(confidence * 100).toFixed(0)}%), trying alternative queries`
  };
}

/**
 * Aggregates and synthesizes results from multiple queries
 */
export function aggregateResults(
  allResults: Array<{ query: string; results: SearchResult[]; strategy: string }>
): string {
  // Deduplicate results based on content similarity
  const uniqueResults: SearchResult[] = [];
  const seen = new Set<string>();
  
  for (const queryResult of allResults) {
    for (const result of queryResult.results) {
      const contentHash = result.content.slice(0, 100); // Simple deduplication
      if (!seen.has(contentHash)) {
        seen.add(contentHash);
        uniqueResults.push(result);
      }
    }
  }
  
  // Sort by similarity if available
  uniqueResults.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  
  // Take top results
  const topResults = uniqueResults.slice(0, 10);
  
  // Combine into context
  return topResults.map(r => r.content).join('\n\n---\n\n');
}

/**
 * Determines if we should continue iterating
 */
export function shouldContinueIterating(
  iteration: number,
  maxIterations: number,
  currentConfidence: number,
  confidenceThreshold: number
): boolean {
  if (iteration >= maxIterations) {
    return false;
  }
  
  if (currentConfidence >= confidenceThreshold) {
    return false;
  }
  
  return true;
}

