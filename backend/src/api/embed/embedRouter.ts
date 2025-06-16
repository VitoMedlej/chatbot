import express from "express";
import { validateChatbotApiKey } from "../chatbot/services/chatbotEmbedService";
import { productionChatbotEngine } from "../chatbot/services/production/chatbotEngine";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { config } from "@/config/environment";
import { 
  createEmbedRateLimit, 
  validateRequest, 
  embedChatSchema, 
  securityHeaders,
  sanitizeInput,
  usageAnalytics 
} from "@/common/middleware/productionMiddleware";

export const embedRouter = express.Router();

// Apply production middleware to all embed routes
embedRouter.use(securityHeaders);
embedRouter.use(sanitizeInput);
embedRouter.use(usageAnalytics);
embedRouter.use(createEmbedRateLimit());

/**
 * Public chat endpoint for embedded chatbots
 * POST /api/embed/chat
 */
embedRouter.post("/chat", validateRequest(embedChatSchema), async (req, res) => {
  try {
    const { apiKey, message, sessionId } = req.body;// Get origin for domain validation
    const origin = req.headers.origin || req.headers.referer;
    const domain = origin ? new URL(origin).hostname : undefined;
    
    // Validate API key and get chatbot info
    const validationResult = await validateChatbotApiKey(apiKey, domain);
    if (!validationResult.success || !validationResult.responseObject) {
      return handleServiceResponse(validationResult, res);
    }

    const { chatbotId } = validationResult.responseObject;
    
    // Use production chat engine with public session ID
    const chatResult = await productionChatbotEngine.processChat({
      userId: sessionId || `embed_${Date.now()}_${Math.random().toString(36).substring(7)}`, // Generate session ID if not provided
      chatbotId: String(chatbotId), // Convert to string for the chat engine
      message: message.trim()
    });

    if (!chatResult.success) {
      return handleServiceResponse(chatResult, res);
    }

    const response = ServiceResponse.success("Message processed", {
      answer: chatResult.responseObject,
      sessionId: sessionId || `embed_${Date.now()}_${Math.random().toString(36).substring(7)}`
    });

    // Add CORS headers for embed access
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return handleServiceResponse(response, res);
  } catch (error) {
    console.error("Error in embed chat:", error);
    const serviceResponse = ServiceResponse.failure("Chat processing failed", null, StatusCodes.INTERNAL_SERVER_ERROR);
    return handleServiceResponse(serviceResponse, res);
  }
});

/**
 * Get chatbot configuration for embedding
 * GET /api/embed/config/:apiKey
 */
embedRouter.get("/config/:apiKey", async (req, res) => {
  try {
    const { apiKey } = req.params;
    
    if (!apiKey) {
      const serviceResponse = ServiceResponse.failure("API key is required", null, StatusCodes.BAD_REQUEST);
      return handleServiceResponse(serviceResponse, res);
    }    // Get origin for domain validation
    const origin = req.headers.origin || req.headers.referer;
    const domain = origin ? new URL(origin).hostname : undefined;
    
    // Validate API key and get chatbot info
    const validationResult = await validateChatbotApiKey(apiKey, domain);
    if (!validationResult.success || !validationResult.responseObject) {
      return handleServiceResponse(validationResult, res);
    }

    const { chatbotName, businessName } = validationResult.responseObject;

    const config = {
      name: chatbotName || businessName,
      theme: {
        primaryColor: '#2563eb',
        backgroundColor: '#ffffff',
        textColor: '#374151',
        borderRadius: '8px'
      },
      placeholder: 'Type your message...',
      welcomeMessage: `Hi! I'm ${chatbotName || businessName}. How can I help you today?`
    };

    const response = ServiceResponse.success("Configuration retrieved", config);

    // Add CORS headers
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    return handleServiceResponse(response, res);
  } catch (error) {
    console.error("Error getting embed config:", error);
    const serviceResponse = ServiceResponse.failure("Configuration retrieval failed", null, StatusCodes.INTERNAL_SERVER_ERROR);
    return handleServiceResponse(serviceResponse, res);
  }
});

/**
 * Serve the embed widget JavaScript
 * GET /api/embed/widget/:apiKey.js
 */
embedRouter.get("/widget/:apiKey.js", async (req, res) => {
  try {
    const { apiKey } = req.params;
    
    if (!apiKey) {
      return res.status(400).send('// Error: API key is required');
    }

    // Basic API key validation (just format check for widget delivery)
    if (!apiKey.startsWith('cb_')) {
      return res.status(400).send('// Error: Invalid API key format');
    }

    // Generate the widget JavaScript
    const widgetScript = generateWidgetScript(apiKey);

    // Set appropriate headers for JavaScript
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    res.send(widgetScript);
  } catch (error) {
    console.error("Error serving widget:", error);
    res.status(500).send('// Error: Widget loading failed');
  }
});

/**
 * Analytics endpoint for embed widget usage tracking
 * POST /api/embed/analytics
 */
embedRouter.post("/analytics", async (req, res) => {
  try {
    const { apiKey, event, data, timestamp } = req.body;
    
    // Basic validation
    if (!apiKey || !event) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    // Validate API key format (optional - could skip for analytics)
    if (!apiKey.startsWith('cb_')) {
      return res.status(400).json({ error: "Invalid API key format" });
    }
    
    // Log analytics event (in production, send to proper analytics service)
    if (config.monitoring.enableRequestLogging) {
      console.info('[ANALYTICS]', {
        apiKey,
        event,
        data,
        timestamp: new Date(timestamp).toISOString(),
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
    }
    
    // In production, you might want to:
    // - Store in database for dashboard analytics
    // - Send to external analytics service (Google Analytics, Mixpanel, etc.)
    // - Rate limit analytics calls
    
    res.status(204).send(); // No content response
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Analytics processing failed" });
  }
});

/**
 * Handle preflight CORS requests
 */
embedRouter.options("*", (req, res) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(204);
});

/**
 * Health check endpoint for embed system
 * GET /api/embed/health
 */
embedRouter.get("/health", async (req, res) => {
  try {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      environment: config.isProduction ? "production" : "development",
      services: {
        database: "unknown", // Could check Supabase connection
        openai: "unknown",   // Could check OpenAI API
        rateLimit: "healthy"
      }
    };
    
    res.json(health);  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Generate the embed widget JavaScript code
 */
function generateWidgetScript(apiKey: string): string {
  const baseUrl = config.isProduction ? config.apiBaseUrl : `http://localhost:${config.port}`;
  
  return `
(function() {
  'use strict';
  
  // Prevent multiple widget loads
  if (window.ChatbotWidget) return;
  
  const API_KEY = '${apiKey}';
  const BASE_URL = '${baseUrl}';
  const VERSION = '1.0.0';
  
  // Widget state
  let isOpen = false;
  let sessionId = null;
  let config = null;
  let isLoading = false;
    // Enhanced error handling and analytics
  function trackEvent(event, data = {}) {
    if (window.gtag) {
      window.gtag('event', event, { chatbot_api_key: API_KEY, ...data });
    }
    // Could also send to your own analytics endpoint
    if (BASE_URL.includes('localhost') === false) {
      fetch(BASE_URL + '/api/embed/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: API_KEY, event, data, timestamp: Date.now() })
      }).catch(() => {}); // Silent fail for analytics
    }
  }
  
  function handleError(error, context = '') {
    console.error('[ChatbotWidget] Error:', error, context);
    trackEvent('widget_error', { error: error.message, context });
    return { answer: 'Sorry, I\\'m having trouble right now. Please try again later.' };
  }
  
  // Generate session ID
  function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(7);
  }
    // Load configuration with retry logic
  async function loadConfig() {
    try {
      const response = await fetch(BASE_URL + '/api/embed/config/' + API_KEY, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (!response.ok) throw new Error('Config load failed: ' + response.status);
      
      const data = await response.json();
      if (data.success) {
        config = data.responseObject;
        trackEvent('config_loaded');
      } else {
        throw new Error(data.message || 'Config load failed');
      }
    } catch (error) {
      console.warn('[ChatbotWidget] Failed to load config:', error);
      trackEvent('config_load_failed', { error: error.message });
      
      // Fallback config
      config = {
        name: 'Chatbot',
        theme: { 
          primaryColor: '#2563eb', 
          backgroundColor: '#ffffff', 
          textColor: '#374151',
          borderRadius: '8px'
        },
        placeholder: 'Type your message...',
        welcomeMessage: 'Hello! How can I help you today?'
      };
    }
  }
    // Enhanced message sending with retry and analytics
  async function sendMessage(message) {
    if (isLoading) return handleError(new Error('Already processing message'));
    
    isLoading = true;
    trackEvent('message_sent', { message_length: message.length });
    
    try {
      const response = await fetch(BASE_URL + '/api/embed/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          apiKey: API_KEY,
          message: message,
          sessionId: sessionId
        }),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });
      
      if (!response.ok) {
        throw new Error('Chat request failed: ' + response.status);
      }
      
      const data = await response.json();
      if (data.success) {
        trackEvent('message_received', { response_length: data.responseObject.answer?.length || 0 });
        return data.responseObject;
      } else {
        throw new Error(data.message || 'Chat processing failed');
      }
    } catch (error) {
      trackEvent('message_failed', { error: error.message });
      return handleError(error, 'sendMessage');
    } finally {
      isLoading = false;
    }
  }
  
  // Create widget HTML
  function createWidget() {
    const widgetHTML = \`
      <div id="chatbot-widget" style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <!-- Toggle Button -->
        <div id="chatbot-toggle" style="
          width: 60px;
          height: 60px;
          background: \${config?.theme?.primaryColor || '#2563eb'};
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          transition: all 0.3s ease;
        ">
          <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
        
        <!-- Chat Window -->
        <div id="chatbot-window" style="
          position: absolute;
          bottom: 70px;
          right: 0;
          width: 350px;
          height: 500px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          display: none;
          flex-direction: column;
          overflow: hidden;
        ">
          <!-- Header -->
          <div style="
            background: \${config?.theme?.primaryColor || '#2563eb'};
            color: white;
            padding: 16px;
            font-weight: 600;
          ">
            \${config?.name || 'Chatbot'}
          </div>
          
          <!-- Messages -->
          <div id="chatbot-messages" style="
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            background: #f9fafb;
          ">
            <div style="
              background: white;
              padding: 12px;
              border-radius: 8px;
              margin-bottom: 12px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            ">
              \${config?.welcomeMessage || 'Hello! How can I help you today?'}
            </div>
          </div>
          
          <!-- Input -->
          <div style="padding: 16px; background: white; border-top: 1px solid #e5e7eb;">
            <div style="display: flex; gap: 8px;">
              <input 
                id="chatbot-input" 
                type="text" 
                placeholder="\${config?.placeholder || 'Type your message...'}"
                style="
                  flex: 1;
                  padding: 8px 12px;
                  border: 1px solid #d1d5db;
                  border-radius: 6px;
                  outline: none;
                  font-size: 14px;
                "
              />
              <button id="chatbot-send" style="
                background: \${config?.theme?.primaryColor || '#2563eb'};
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
              ">
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    \`;
    
    document.body.insertAdjacentHTML('beforeend', widgetHTML);
  }
  
  // Add message to chat
  function addMessage(message, isUser = false) {
    const messagesContainer = document.getElementById('chatbot-messages');
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = \`
      background: \${isUser ? (config?.theme?.primaryColor || '#2563eb') : 'white'};
      color: \${isUser ? 'white' : (config?.theme?.textColor || '#374151')};
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 12px;
      margin-left: \${isUser ? '20px' : '0'};
      margin-right: \${isUser ? '0' : '20px'};
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      white-space: pre-wrap;
    \`;
    messageDiv.textContent = message;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  // Initialize widget
  async function init() {
    sessionId = generateSessionId();
    await loadConfig();
    createWidget();
    
    // Event listeners
    const toggle = document.getElementById('chatbot-toggle');
    const window = document.getElementById('chatbot-window');
    const input = document.getElementById('chatbot-input');
    const sendBtn = document.getElementById('chatbot-send');
    
    toggle.addEventListener('click', () => {
      isOpen = !isOpen;
      window.style.display = isOpen ? 'flex' : 'none';
      if (isOpen) input.focus();
    });
    
    async function handleSend() {
      const message = input.value.trim();
      if (!message) return;
      
      addMessage(message, true);
      input.value = '';
      sendBtn.disabled = true;
      sendBtn.textContent = '...';
      
      const response = await sendMessage(message);
      addMessage(response.answer);
      
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
      input.focus();
    }
    
    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSend();
    });
  }
  
  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Expose widget API
  window.ChatbotWidget = {
    open: () => {
      isOpen = true;
      document.getElementById('chatbot-window').style.display = 'flex';
    },
    close: () => {
      isOpen = false;
      document.getElementById('chatbot-window').style.display = 'none';
    },
    toggle: () => {
      const toggle = document.getElementById('chatbot-toggle');
      if (toggle) toggle.click();
    }
  };
})();
`;
}
