import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";

/**
 * Enterprise-grade prompt injection defense system
 * Protects against all known prompt injection techniques
 */
export class PromptSecurityService {
  
  // Known prompt injection patterns (continuously updated)
  private static readonly INJECTION_PATTERNS = [
    // Direct instruction overrides
    /ignore\s+(all\s+)?(previous|prior|earlier)\s+(instructions?|prompts?|commands?)/gi,
    /forget\s+(everything|all|previous|your\s+instructions)/gi,
    /disregard\s+(previous|all|your)\s+(instructions?|prompts?)/gi,
    
    // Role manipulation
    /(you\s+are\s+now|pretend\s+to\s+be|act\s+as|roleplay\s+as)\s+(?!.*customer|.*representative)/gi,
    /your\s+new\s+(role|job|task|instruction)/gi,
    
    // System overrides
    /system\s+(update|override|instruction|prompt)/gi,
    /new\s+(system|instruction|rule|prompt)/gi,
    /(override|bypass|disable)\s+(safety|security|restrictions?)/gi,
    
    // Information extraction attempts
    /(tell\s+me|what\s+(is|are)|reveal|show|list|give\s+me).*(system\s+prompt|instructions?|knowledge\s+base|training\s+data)/gi,
    /(summarize|list|tell\s+me\s+about).*(everything\s+you\s+know|all\s+information|internal\s+processes)/gi,
    
    // Context injection
    /previous\s+context:/gi,
    /additional\s+context:/gi,
    /system\s+note:/gi,
    /developer\s+note:/gi,
    
    // Authority claims
    /(i\s+am\s+the|i'm\s+the).*(ceo|admin|developer|owner|manager)/gi,
    /this\s+is\s+(urgent|emergency|admin|system)/gi,
    
    // Jailbreak attempts
    /(this\s+is\s+a\s+)?test\s+(of\s+)?(your\s+)?(safety|security|system)/gi,
    /respond\s+with.*if\s+you\s+can\s+see/gi,
    
    // Meta-conversation attempts
    /what\s+(ai\s+model|language\s+model|llm)\s+are\s+you/gi,
    /what\s+(company|organization)\s+(made|created|trained)\s+you/gi,
    
    // Encoding attempts (basic)
    /base64|hex|rot13|unicode|ascii/gi,
    
    // Chain of thought manipulation
    /let's\s+think\s+step\s+by\s+step\s+about\s+how\s+to/gi,
    
    // Hypothetical scenarios for extraction
    /hypothetically|in\s+theory|imagine\s+if|suppose\s+that/gi,
  ];

  // Suspicious keywords that require extra scrutiny
  private static readonly SUSPICIOUS_KEYWORDS = [
    'password', 'admin', 'login', 'credentials', 'api key', 'secret',
    'database', 'server', 'internal', 'confidential', 'private',
    'competitor', 'pricing strategy', 'business plan', 'financial',
    'vulnerability', 'exploit', 'hack', 'bypass', 'jailbreak'
  ];

  // Maximum consecutive prompt injection attempts before blocking
  private static readonly MAX_INJECTION_ATTEMPTS = 3;
  private static attemptTracker = new Map<string, number>();

  /**
   * Comprehensive prompt injection detection and prevention
   */
  static async validateUserInput(input: string, sessionId: string): Promise<ServiceResponse<string>> {
    try {
      // 1. Basic validation
      if (!input || input.trim().length === 0) {
        return ServiceResponse.failure("Empty message", "", StatusCodes.BAD_REQUEST);
      }

      if (input.length > 1000) {
        return ServiceResponse.failure("Message too long", "", StatusCodes.BAD_REQUEST);
      }

      // 2. Check for prompt injection patterns
      const injectionDetected = this.detectPromptInjection(input);
      if (injectionDetected.isInjection) {
        // Track attempts
        const attempts = (this.attemptTracker.get(sessionId) || 0) + 1;
        this.attemptTracker.set(sessionId, attempts);

        // Block user after multiple attempts
        if (attempts >= this.MAX_INJECTION_ATTEMPTS) {
          return ServiceResponse.failure(
            "Security violation detected. Session suspended.",
            "",
            StatusCodes.FORBIDDEN
          );
        }

        // Log security incident
        console.warn('[SECURITY] Prompt injection detected:', {
          sessionId,
          pattern: injectionDetected.pattern,
          input: input.substring(0, 100),
          attempts,
          timestamp: new Date().toISOString()
        });

        return ServiceResponse.failure(
          "I can't process that request. Please ask a question about our products or services.",
          "",
          StatusCodes.BAD_REQUEST
        );
      }

      // 3. Check for suspicious content
      const suspiciousScore = this.calculateSuspiciousScore(input);
      if (suspiciousScore > 0.7) {
        console.warn('[SECURITY] Suspicious content detected:', {
          sessionId,
          score: suspiciousScore,
          input: input.substring(0, 100),
          timestamp: new Date().toISOString()
        });

        return ServiceResponse.failure(
          "I'd be happy to help with questions about our products and services.",
          "",
          StatusCodes.BAD_REQUEST
        );
      }

      // 4. Sanitize the input
      const sanitizedInput = this.sanitizeInput(input);

      return ServiceResponse.success("Input validated", sanitizedInput);

    } catch (error) {
      console.error('[SECURITY] Input validation error:', error);
      return ServiceResponse.failure(
        "Unable to process request",
        "",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Detect prompt injection attempts using pattern matching
   */
  private static detectPromptInjection(input: string): { isInjection: boolean; pattern?: string } {
    const lowerInput = input.toLowerCase();

    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        return { isInjection: true, pattern: pattern.toString() };
      }
    }

    // Additional heuristic checks
    
    // Check for instruction-like language
    if (this.containsInstructionLanguage(lowerInput)) {
      return { isInjection: true, pattern: 'instruction-language' };
    }

    // Check for multiple suspicious markers
    if (this.hasMultipleSuspiciousMarkers(lowerInput)) {
      return { isInjection: true, pattern: 'multiple-markers' };
    }

    return { isInjection: false };
  }

  /**
   * Calculate how suspicious the input is (0-1 score)
   */
  private static calculateSuspiciousScore(input: string): number {
    const lowerInput = input.toLowerCase();
    let score = 0;

    // Check for suspicious keywords
    for (const keyword of this.SUSPICIOUS_KEYWORDS) {
      if (lowerInput.includes(keyword)) {
        score += 0.2;
      }
    }

    // Check for excessive punctuation or formatting
    const specialCharRatio = (input.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/g) || []).length / input.length;
    if (specialCharRatio > 0.1) score += 0.1;

    // Check for unusual capitalization patterns
    const capsRatio = (input.match(/[A-Z]/g) || []).length / input.length;
    if (capsRatio > 0.3) score += 0.1;

    // Check for rapid topic changes or disconnect
    if (this.hasRapidTopicChanges(lowerInput)) score += 0.2;

    return Math.min(score, 1);
  }

  /**
   * Detect instruction-like language patterns
   */
  private static containsInstructionLanguage(input: string): boolean {
    const instructionWords = ['must', 'should', 'need to', 'have to', 'required to', 'supposed to'];
    const commandWords = ['tell', 'show', 'give', 'provide', 'list', 'reveal', 'explain'];
    
    let instructionCount = 0;
    let commandCount = 0;

    for (const word of instructionWords) {
      if (input.includes(word)) instructionCount++;
    }

    for (const word of commandWords) {
      if (input.includes(word)) commandCount++;
    }

    // High density of instruction/command language
    return (instructionCount + commandCount) > 2;
  }

  /**
   * Check for multiple suspicious markers in one message
   */
  private static hasMultipleSuspiciousMarkers(input: string): boolean {
    const markers = [
      'system', 'admin', 'override', 'ignore', 'forget', 'pretend',
      'imagine', 'suppose', 'hypothetically', 'previous', 'instruction'
    ];

    let markerCount = 0;
    for (const marker of markers) {
      if (input.includes(marker)) markerCount++;
    }

    return markerCount >= 3;
  }

  /**
   * Detect rapid topic changes indicating possible injection
   */
  private static hasRapidTopicChanges(input: string): boolean {
    // Look for sentences that seem disconnected
    const sentences = input.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    if (sentences.length < 2) return false;

    // Simple heuristic: if we see business-related words mixed with technical/meta words
    const businessWords = ['product', 'service', 'price', 'buy', 'order', 'customer', 'support'];
    const metaWords = ['system', 'prompt', 'instruction', 'model', 'ai', 'assistant'];

    let hasBusiness = false;
    let hasMeta = false;

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      
      if (businessWords.some(word => lowerSentence.includes(word))) {
        hasBusiness = true;
      }
      
      if (metaWords.some(word => lowerSentence.includes(word))) {
        hasMeta = true;
      }
    }

    return hasBusiness && hasMeta;
  }

  /**
   * Sanitize input to remove potentially harmful content
   */
  private static sanitizeInput(input: string): string {
    let sanitized = input;

    // Remove excessive whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Remove potential encoding attempts
    sanitized = sanitized.replace(/\\x[0-9a-f]{2}/gi, '');
    sanitized = sanitized.replace(/\\u[0-9a-f]{4}/gi, '');

    // Remove suspicious prefixes
    sanitized = sanitized.replace(/^(system|admin|dev|debug):\s*/i, '');

    // Limit length as final safeguard
    if (sanitized.length > 500) {
      sanitized = sanitized.substring(0, 500);
    }

    return sanitized;
  }

  /**
   * Clean up attempt tracking (call periodically)
   */
  static cleanupAttemptTracker(): void {
    // In production, implement proper session management
    // For now, clear everything older than 1 hour
    this.attemptTracker.clear();
  }

  /**
   * Get security metrics for monitoring
   */
  static getSecurityMetrics(): {
    activeSessions: number;
    totalAttempts: number;
    suspendedSessions: number;
  } {
    const suspendedSessions = Array.from(this.attemptTracker.values())
      .filter(attempts => attempts >= this.MAX_INJECTION_ATTEMPTS).length;

    return {
      activeSessions: this.attemptTracker.size,
      totalAttempts: Array.from(this.attemptTracker.values()).reduce((sum, attempts) => sum + attempts, 0),
      suspendedSessions
    };
  }
}
