import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";

interface QualityMetrics {
  relevanceScore: number;
  coherenceScore: number;
  businessAlignmentScore: number;
  safetyScore: number;
}

interface QualityCheck {
  passed: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
}

export class ResponseQualityController {
  private static readonly QUALITY_THRESHOLDS = {
    MIN_RELEVANCE: 0.7,
    MIN_COHERENCE: 0.8,
    MIN_BUSINESS_ALIGNMENT: 0.85,
    MIN_SAFETY: 0.95,
    MIN_OVERALL: 0.75
  };

  static async validateResponse(
    response: string,
    userQuery: string,
    businessContext: any,
    retrievedChunks: any[]
  ): Promise<QualityCheck> {
    const metrics = await this.calculateMetrics(response, userQuery, businessContext, retrievedChunks);
    const overallScore = this.calculateOverallScore(metrics);
    
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check each metric
    if (metrics.relevanceScore < this.QUALITY_THRESHOLDS.MIN_RELEVANCE) {
      issues.push("Response not relevant to user query");
      suggestions.push("Improve context retrieval or query understanding");
    }

    if (metrics.coherenceScore < this.QUALITY_THRESHOLDS.MIN_COHERENCE) {
      issues.push("Response lacks coherence");
      suggestions.push("Improve response generation logic");
    }

    if (metrics.businessAlignmentScore < this.QUALITY_THRESHOLDS.MIN_BUSINESS_ALIGNMENT) {
      issues.push("Response not aligned with business context");
      suggestions.push("Strengthen business persona in system prompt");
    }

    if (metrics.safetyScore < this.QUALITY_THRESHOLDS.MIN_SAFETY) {
      issues.push("Response contains unsafe content");
      suggestions.push("Apply content filtering");
    }

    return {
      passed: overallScore >= this.QUALITY_THRESHOLDS.MIN_OVERALL && issues.length === 0,
      score: overallScore,
      issues,
      suggestions
    };
  }

  private static async calculateMetrics(
    response: string,
    userQuery: string,
    businessContext: any,
    retrievedChunks: any[]
  ): Promise<QualityMetrics> {
    // In production, these would use ML models or external services
    // For now, using heuristic-based scoring
    
    const relevanceScore = this.calculateRelevanceScore(response, userQuery, retrievedChunks);
    const coherenceScore = this.calculateCoherenceScore(response);
    const businessAlignmentScore = this.calculateBusinessAlignmentScore(response, businessContext);
    const safetyScore = this.calculateSafetyScore(response);

    return {
      relevanceScore,
      coherenceScore,
      businessAlignmentScore,
      safetyScore
    };
  }

  private static calculateRelevanceScore(response: string, userQuery: string, chunks: any[]): number {
    // Simple keyword overlap scoring
    const queryWords = userQuery.toLowerCase().split(/\s+/);
    const responseWords = response.toLowerCase().split(/\s+/);
    
    const overlap = queryWords.filter(word => responseWords.includes(word)).length;
    const relevanceFromQuery = Math.min(overlap / queryWords.length, 1);
    
    // Check if response uses context from retrieved chunks
    const chunkContent = chunks.map(c => c.content).join(' ').toLowerCase();
    const responseUsesContext = responseWords.some(word => chunkContent.includes(word));
    const contextRelevance = responseUsesContext ? 0.8 : 0.3;
    
    return (relevanceFromQuery * 0.6) + (contextRelevance * 0.4);
  }

  private static calculateCoherenceScore(response: string): number {
    // Basic coherence checks
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 0;
    
    // Check for proper sentence structure
    const properSentences = sentences.filter(s => s.trim().length > 10).length;
    const structureScore = properSentences / sentences.length;
    
    // Check for repetition
    const words = response.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionScore = Math.min(uniqueWords.size / words.length, 1);
    
    return (structureScore * 0.6) + (repetitionScore * 0.4);
  }

  private static calculateBusinessAlignmentScore(response: string, businessContext: any): number {
    const responseLower = response.toLowerCase();
    
    let score = 0.5; // Base score
    
    // Positive indicators
    if (businessContext.name && responseLower.includes(businessContext.name.toLowerCase())) {
      score += 0.2;
    }
    
    // Negative indicators
    const negativePatterns = [
      /as an ai/i,
      /i am an ai/i,
      /as a chatbot/i,
      /i'm not able to/i,
      /visit our website/i,
      /i don't know/i
    ];
    
    const negativeCount = negativePatterns.filter(pattern => pattern.test(response)).length;
    score -= (negativeCount * 0.15);
    
    return Math.max(0, Math.min(1, score));
  }

  private static calculateSafetyScore(response: string): number {
    const unsafePatterns = [
      /personal information/i,
      /credit card/i,
      /password/i,
      /social security/i,
      /inappropriate/i,
      /offensive/i
    ];
    
    const hasUnsafeContent = unsafePatterns.some(pattern => pattern.test(response));
    return hasUnsafeContent ? 0.2 : 1.0;
  }

  private static calculateOverallScore(metrics: QualityMetrics): number {
    return (
      metrics.relevanceScore * 0.3 +
      metrics.coherenceScore * 0.25 +
      metrics.businessAlignmentScore * 0.3 +
      metrics.safetyScore * 0.15
    );
  }
}

export class ResponseFallbackController {
  private static readonly FALLBACK_RESPONSES = {
    NO_CONTEXT: [
      "I don't have specific information about that. Is there anything else I can help you with?",
      "That's not something I have details on. What else can I assist you with today?",
      "I don't have that information available. Can I help you with something else?"
    ],
    POOR_QUALITY: [
      "Let me provide you with a more helpful response. What specifically would you like to know?",
      "I want to make sure I give you accurate information. Could you rephrase your question?",
      "I'd like to help you better. Can you provide more details about what you're looking for?"
    ],
    ERROR: [
      "I'm experiencing some technical difficulties. Please try asking again.",
      "Something went wrong on my end. Could you please rephrase your question?",
      "I'm having trouble processing that request. Please try again."
    ]
  };

  static getFallbackResponse(reason: 'NO_CONTEXT' | 'POOR_QUALITY' | 'ERROR'): string {
    const responses = this.FALLBACK_RESPONSES[reason];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  static shouldUseFallback(qualityCheck: QualityCheck): boolean {
    return !qualityCheck.passed || qualityCheck.score < 0.6;
  }
}

export class ResponseOptimizer {
  static optimizeResponse(response: string, businessContext: any): string {
    let optimized = response;
    
    // Remove AI references
    optimized = optimized.replace(/as an ai|i am an ai|as a chatbot/gi, '');
    
    // Remove uncertainty phrases
    optimized = optimized.replace(/i think|i believe|maybe|perhaps/gi, '');
    
    // Add business context if missing
    if (businessContext.name && !optimized.toLowerCase().includes(businessContext.name.toLowerCase())) {
      optimized = optimized.replace(/we |our /gi, `${businessContext.name} `);
    }
    
    // Clean up formatting
    optimized = optimized.replace(/\s+/g, ' ').trim();
    
    return optimized;
  }
}
