/**
 * Chatbot Embed Widget
 * Simple JavaScript widget that can be embedded on any website
 * 
 * Usage:
 * <script>
 *   window.ChatbotConfig = {
 *     apiKey: 'cb_xxxxxxxx_xxxxxxxxx_xxxxxxx',
 *     apiUrl: 'https://your-backend-domain.com/api/embed'
 *   };
 * </script>
 * <script src="https://your-backend-domain.com/embed/widget.js"></script>
 */

(function() {
    'use strict';

    // Configuration
    const config = window.ChatbotConfig || {};
    const API_KEY = config.apiKey;
    const API_URL = config.apiUrl || 'https://localhost:3000/api/embed';
    
    if (!API_KEY) {
        console.error('Chatbot Widget: API key is required. Please set window.ChatbotConfig.apiKey');
        return;
    }

    // Widget state
    let isOpen = false;
    let sessionId = localStorage.getItem('chatbot_session_id') || null;
    let chatbotConfig = null;
    let messages = [];

    // CSS styles
    const styles = `
        .chatbot-widget {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .chatbot-button {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .chatbot-button:hover {
            transform: scale(1.05);
            box-shadow: 0 6px 20px rgba(0,0,0,0.2);
        }
        
        .chatbot-button svg {
            width: 24px;
            height: 24px;
            fill: white;
        }
        
        .chatbot-chat {
            position: absolute;
            bottom: 80px;
            right: 0;
            width: 350px;
            height: 500px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.12);
            display: none;
            flex-direction: column;
            overflow: hidden;
        }
        
        .chatbot-chat.open {
            display: flex;
        }
        
        .chatbot-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px;
            font-weight: 600;
        }
        
        .chatbot-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            background: #f9fafb;
        }
        
        .chatbot-message {
            margin-bottom: 12px;
            display: flex;
        }
        
        .chatbot-message.user {
            justify-content: flex-end;
        }
        
        .chatbot-message-content {
            max-width: 80%;
            padding: 10px 14px;
            border-radius: 18px;
            font-size: 14px;
            line-height: 1.4;
        }
        
        .chatbot-message.user .chatbot-message-content {
            background: #667eea;
            color: white;
            border-bottom-right-radius: 4px;
        }
        
        .chatbot-message.bot .chatbot-message-content {
            background: white;
            color: #374151;
            border: 1px solid #e5e7eb;
            border-bottom-left-radius: 4px;
        }
        
        .chatbot-input-area {
            padding: 16px;
            border-top: 1px solid #e5e7eb;
            background: white;
        }
        
        .chatbot-input-form {
            display: flex;
            gap: 8px;
        }
        
        .chatbot-input {
            flex: 1;
            padding: 10px 12px;
            border: 1px solid #d1d5db;
            border-radius: 20px;
            font-size: 14px;
            outline: none;
        }
        
        .chatbot-input:focus {
            border-color: #667eea;
        }
        
        .chatbot-send-button {
            padding: 10px 16px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 20px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
        }
        
        .chatbot-send-button:hover {
            background: #5a67d8;
        }
        
        .chatbot-send-button:disabled {
            background: #9ca3af;
            cursor: not-allowed;
        }
        
        .chatbot-typing {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 10px 14px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 18px;
            border-bottom-left-radius: 4px;
            max-width: 80%;
        }
        
        .chatbot-typing-dot {
            width: 4px;
            height: 4px;
            background: #9ca3af;
            border-radius: 50%;
            animation: chatbot-typing-animation 1.4s ease-in-out infinite;
        }
        
        .chatbot-typing-dot:nth-child(2) {
            animation-delay: 0.2s;
        }
        
        .chatbot-typing-dot:nth-child(3) {
            animation-delay: 0.4s;
        }
        
        @keyframes chatbot-typing-animation {
            0%, 60%, 100% {
                transform: translateY(0);
                opacity: 0.5;
            }
            30% {
                transform: translateY(-10px);
                opacity: 1;
            }
        }
        
        @media (max-width: 480px) {
            .chatbot-chat {
                width: calc(100vw - 40px);
                height: calc(100vh - 120px);
                bottom: 80px;
                right: 20px;
            }
        }
    `;

    // Initialize widget
    function init() {
        // Add styles
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);

        // Create widget HTML
        const widget = document.createElement('div');
        widget.className = 'chatbot-widget';
        widget.innerHTML = `
            <div class="chatbot-chat" id="chatbot-chat">
                <div class="chatbot-header">
                    <div id="chatbot-title">Chat with us</div>
                </div>
                <div class="chatbot-messages" id="chatbot-messages">
                    <div class="chatbot-message bot">
                        <div class="chatbot-message-content">
                            Hi! How can I help you today?
                        </div>
                    </div>
                </div>
                <div class="chatbot-input-area">
                    <form class="chatbot-input-form" id="chatbot-form">
                        <input 
                            type="text" 
                            class="chatbot-input" 
                            id="chatbot-input" 
                            placeholder="Type your message..."
                            maxlength="1000"
                        />
                        <button type="submit" class="chatbot-send-button" id="chatbot-send">
                            Send
                        </button>
                    </form>
                </div>
            </div>
            <button class="chatbot-button" id="chatbot-toggle">
                <svg viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3.04 1.05 4.39L1 23l6.61-2.05C9.96 21.64 11.46 22 13 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
            </button>
        `;

        document.body.appendChild(widget);

        // Event listeners
        document.getElementById('chatbot-toggle').addEventListener('click', toggleChat);
        document.getElementById('chatbot-form').addEventListener('submit', sendMessage);

        // Load chatbot config
        loadChatbotConfig();
    }

    // Load chatbot configuration
    async function loadChatbotConfig() {
        try {
            const response = await fetch(`${API_URL}/config?apiKey=${encodeURIComponent(API_KEY)}`);
            const result = await response.json();
            
            if (result.success && result.responseObject) {
                chatbotConfig = result.responseObject;
                document.getElementById('chatbot-title').textContent = 
                    `Chat with ${chatbotConfig.businessName || chatbotConfig.name}`;
            }
        } catch (error) {
            console.error('Failed to load chatbot config:', error);
        }
    }

    // Toggle chat window
    function toggleChat() {
        isOpen = !isOpen;
        const chatElement = document.getElementById('chatbot-chat');
        const buttonElement = document.getElementById('chatbot-toggle');
        
        if (isOpen) {
            chatElement.classList.add('open');
            buttonElement.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            `;
        } else {
            chatElement.classList.remove('open');
            buttonElement.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3.04 1.05 4.39L1 23l6.61-2.05C9.96 21.64 11.46 22 13 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
            `;
        }
    }

    // Send message
    async function sendMessage(e) {
        e.preventDefault();
        
        const input = document.getElementById('chatbot-input');
        const sendButton = document.getElementById('chatbot-send');
        const message = input.value.trim();
        
        if (!message) return;

        // Add user message to chat
        addMessage('user', message);
        input.value = '';
        sendButton.disabled = true;

        // Show typing indicator
        showTyping();

        try {
            const response = await fetch(`${API_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    apiKey: API_KEY,
                    message: message,
                    sessionId: sessionId
                })
            });

            const result = await response.json();
            
            // Hide typing indicator
            hideTyping();

            if (result.success && result.responseObject) {
                // Update session ID if provided
                if (result.responseObject.sessionId) {
                    sessionId = result.responseObject.sessionId;
                    localStorage.setItem('chatbot_session_id', sessionId);
                }

                // Add bot response
                addMessage('bot', result.responseObject.response);
            } else {
                addMessage('bot', 'Sorry, I encountered an error. Please try again.');
            }
        } catch (error) {
            hideTyping();
            addMessage('bot', 'Sorry, I\'m having trouble connecting. Please try again later.');
            console.error('Chat error:', error);
        } finally {
            sendButton.disabled = false;
        }
    }

    // Add message to chat
    function addMessage(sender, content) {
        const messagesContainer = document.getElementById('chatbot-messages');
        const messageElement = document.createElement('div');
        messageElement.className = `chatbot-message ${sender}`;
        messageElement.innerHTML = `
            <div class="chatbot-message-content">${escapeHtml(content)}</div>
        `;
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Show typing indicator
    function showTyping() {
        const messagesContainer = document.getElementById('chatbot-messages');
        const typingElement = document.createElement('div');
        typingElement.className = 'chatbot-message bot';
        typingElement.id = 'chatbot-typing';
        typingElement.innerHTML = `
            <div class="chatbot-typing">
                <div class="chatbot-typing-dot"></div>
                <div class="chatbot-typing-dot"></div>
                <div class="chatbot-typing-dot"></div>
            </div>
        `;
        messagesContainer.appendChild(typingElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Hide typing indicator
    function hideTyping() {
        const typingElement = document.getElementById('chatbot-typing');
        if (typingElement) {
            typingElement.remove();
        }
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
