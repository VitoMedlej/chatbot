import { supabase, openai } from "@/server";

interface ContextConfiguration {
  maxChunks: number;
  similarityThreshold: number;
  maxChunkLength: number;
  minChunkLength: number;
  diversityThreshold: number;
}

interface ProcessedChunk {
  id: string;
  content: string;
  similarity: number;
  source: string;
  type: 'product' | 'service' | 'policy' | 'faq' | 'general';
  quality: number;
}

export class IntelligentContextRetriever {
  private static readonly DEFAULT_CONFIG: ContextConfiguration = {
    maxChunks: 5,
    similarityThreshold: 0.78,
    maxChunkLength: 800,
    minChunkLength: 50,
    diversityThreshold: 0.3
  };

  static async retrieveContext(
    query: string,
    chatbotId: string,
    config: ContextConfiguration = this.DEFAULT_CONFIG
  ): Promise<ProcessedChunk[]> {
    // 1. Generate embedding for query
    const embedding = await this.generateEmbedding(query);
    if (!embedding) return [];

    // 2. Retrieve candidate chunks
    const candidates = await this.getCandidateChunks(embedding, chatbotId, config);
    if (!candidates.length) return [];

    // 3. Filter out low-quality chunks
    const filtered = this.filterQualityChunks(candidates, config);

    // 4. Diversify results
    const diversified = this.diversifyResults(filtered, config);

    // 5. Rank by relevance and quality
    const ranked = this.rankChunks(diversified, query);

    return ranked.slice(0, config.maxChunks);
  }

  private static async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000), // Limit input length
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error("[ContextRetriever] Embedding generation failed:", error);
      return null;
    }
  }

  private static async getCandidateChunks(
    embedding: number[],
    chatbotId: string,
    config: ContextConfiguration
  ): Promise<any[]> {
    try {
      const { data: chunks, error } = await supabase.rpc("match_document_chunks", {
        query_embedding: embedding,
        match_threshold: config.similarityThreshold,
        match_count: config.maxChunks * 3, // Get more candidates for filtering
        chatbot_id: chatbotId,
      });

      if (error) {
        console.error("[ContextRetriever] Chunk retrieval failed:", error);
        return [];
      }

      return chunks || [];
    } catch (error) {
      console.error("[ContextRetriever] Database query failed:", error);
      return [];
    }
  }

  private static filterQualityChunks(chunks: any[], config: ContextConfiguration): ProcessedChunk[] {
    return chunks
      .filter(chunk => {
        if (!chunk.content) return false;
        
        const content = chunk.content.trim();
        if (content.length < config.minChunkLength || content.length > config.maxChunkLength) {
          return false;
        }

        // Filter out boilerplate content
        if (this.isBoilerplateContent(content)) return false;

        // Filter out navigation/structural content
        if (this.isStructuralContent(content)) return false;

        return true;
      })
      .map(chunk => ({
        id: chunk.id,
        content: chunk.content,
        similarity: chunk.similarity || 0,
        source: chunk.source_url || "Internal",
        type: this.classifyChunkType(chunk.content),
        quality: this.calculateChunkQuality(chunk.content)
      }))
      .filter(chunk => chunk.quality > 0.5); // Only keep high-quality chunks
  }

  private static isBoilerplateContent(content: string): boolean {
    const boilerplatePatterns = [
      /privacy policy/i,
      /terms of service/i,
      /cookie policy/i,
      /all rights reserved/i,
      /copyright \d{4}/i,
      /follow us on/i,
      /subscribe to our newsletter/i,
      /contact us for more information/i,
      /visit our website/i,
      /social media/i,
      /instagram|facebook|twitter|linkedin/i
    ];

    return boilerplatePatterns.some(pattern => pattern.test(content));
  }

  private static isStructuralContent(content: string): boolean {
    const structuralPatterns = [
      /^(home|about|contact|services|products)$/i,
      /^menu|navigation|breadcrumb/i,
      /^page \d+ of \d+/i,
      /^copyright|footer|header/i,
      /^skip to content/i,
      /^loading\.\.\./i
    ];

    return structuralPatterns.some(pattern => pattern.test(content.trim()));
  }

  private static classifyChunkType(content: string): 'product' | 'service' | 'policy' | 'faq' | 'general' {
    const contentLower = content.toLowerCase();

    if (contentLower.includes('product') || contentLower.includes('item') || contentLower.includes('buy')) {
      return 'product';
    }
    
    if (contentLower.includes('service') || contentLower.includes('offer') || contentLower.includes('provide')) {
      return 'service';
    }
    
    if (contentLower.includes('policy') || contentLower.includes('terms') || contentLower.includes('legal')) {
      return 'policy';
    }
    
    if (contentLower.includes('faq') || contentLower.includes('frequently') || contentLower.includes('question')) {
      return 'faq';
    }
    
    return 'general';
  }

  private static calculateChunkQuality(content: string): number {
    let score = 0.5; // Base score

    // Length quality
    const length = content.length;
    if (length >= 100 && length <= 500) score += 0.2;
    else if (length >= 50 && length <= 800) score += 0.1;

    // Sentence structure
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length >= 2 && sentences.length <= 8) score += 0.1;

    // Information density
    const words = content.split(/\s+/);
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const density = uniqueWords.size / words.length;
    if (density > 0.6) score += 0.1;

    // Business value indicators
    const valueIndicators = [
      /price|cost|\$|€|£/i,
      /how to|guide|instruction/i,
      /benefit|advantage|feature/i,
      /available|offer|provide/i
    ];
    const valueCount = valueIndicators.filter(pattern => pattern.test(content)).length;
    score += Math.min(valueCount * 0.05, 0.1);

    return Math.min(score, 1.0);
  }

  private static diversifyResults(chunks: ProcessedChunk[], config: ContextConfiguration): ProcessedChunk[] {
    if (chunks.length <= config.maxChunks) return chunks;

    const selected: ProcessedChunk[] = [];
    const remaining = [...chunks];

    // Always include the highest similarity chunk
    const highest = remaining.sort((a, b) => b.similarity - a.similarity)[0];
    selected.push(highest);
    remaining.splice(remaining.indexOf(highest), 1);

    // Select diverse chunks
    while (selected.length < config.maxChunks && remaining.length > 0) {
      let bestCandidate = remaining[0];
      let bestDiversityScore = 0;

      for (const candidate of remaining) {
        const diversityScore = this.calculateDiversityScore(candidate, selected);
        const combinedScore = (candidate.similarity * 0.7) + (diversityScore * 0.3);
        
        if (combinedScore > bestDiversityScore) {
          bestDiversityScore = combinedScore;
          bestCandidate = candidate;
        }
      }

      selected.push(bestCandidate);
      remaining.splice(remaining.indexOf(bestCandidate), 1);
    }

    return selected;
  }

  private static calculateDiversityScore(candidate: ProcessedChunk, selected: ProcessedChunk[]): number {
    if (selected.length === 0) return 1.0;

    let minSimilarity = 1.0;
    
    for (const chunk of selected) {
      // Simple content similarity check
      const similarity = this.calculateContentSimilarity(candidate.content, chunk.content);
      minSimilarity = Math.min(minSimilarity, similarity);
    }

    // Higher diversity score for less similar content
    return 1.0 - minSimilarity;
  }

  private static calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private static rankChunks(chunks: ProcessedChunk[], query: string): ProcessedChunk[] {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    
    return chunks.sort((a, b) => {
      // Calculate query relevance
      const aWords = new Set(a.content.toLowerCase().split(/\s+/));
      const bWords = new Set(b.content.toLowerCase().split(/\s+/));
      
      const aRelevance = [...queryWords].filter(word => aWords.has(word)).length / queryWords.size;
      const bRelevance = [...queryWords].filter(word => bWords.has(word)).length / queryWords.size;
      
      // Combined ranking score
      const aScore = (a.similarity * 0.4) + (a.quality * 0.3) + (aRelevance * 0.3);
      const bScore = (b.similarity * 0.4) + (b.quality * 0.3) + (bRelevance * 0.3);
      
      return bScore - aScore;
    });
  }
}
