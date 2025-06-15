// Extend Express Request interface to include user data
declare namespace Express {
  interface Request {
    user?: {
      id: string;
      email: string;
      role: string;
      metadata?: Record<string, any>;
    };
    // Validated IDs set by authorization middleware for additional security
    validatedChatbotId?: string;
    validatedUserId?: string;
  }
}
