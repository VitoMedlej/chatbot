// Quick test to verify technical advice filtering is working
// This simulates what your bot should respond when asked about payment issues

const simulateResponse = (userMessage: string, context: string = "") => {
    // Simulate the conditions from your chatbot
    const hasContext = context && context.length > 100;
    
    // Sample responses that would come from OpenAI without proper filtering
    const problematicResponses = [
        "I apologize for the inconvenience you're facing with the checkout process. It seems like there might be a technical issue preventing the card payment option from appearing. To ensure a smooth checkout experience, I recommend refreshing the page or clearing your browser's cache and cookies to see if the card payment option becomes available.",
        "This sounds like a browser cache issue. Try clearing your cookies and refreshing the page.",
        "There might be a technical issue with our payment system. Try using incognito mode or a different browser."
    ];
    
    // Apply the same filters as in your updated chatbot
    const technicalAdvicePatterns = [
        /refresh.*page|clear.*cache|clear.*cookies|browser.*cache/gi,
        /try.*different.*browser|incognito.*mode|private.*browsing/gi,
        /technical.*issue|might.*be.*issue|seems.*like.*issue/gi,
        /apologize.*inconvenience|sorry.*inconvenience/gi,
        /investigate.*assist|help.*resolve.*order/gi,
        /smooth.*checkout.*experience/gi
    ];
    
    problematicResponses.forEach((response, index) => {
        console.log(`\n=== Test ${index + 1} ===`);
        console.log(`User: "${userMessage}"`);
        console.log(`Context available: ${hasContext ? 'YES' : 'NO'}`);
        console.log(`Original response: "${response}"`);
        
        const containsTechnicalAdvice = technicalAdvicePatterns.some(pattern => pattern.test(response));
        
        if (containsTechnicalAdvice && !hasContext) {
            const filteredResponse = "I don't have the current details about our payment and checkout options. Please contact our support team who can provide you with accurate information and help resolve any issues you're experiencing.";
            console.log(`✅ FILTERED response: "${filteredResponse}"`);
        } else {
            console.log(`❌ UNFILTERED response: "${response}"`);
        }
    });
};

// Test the scenarios
console.log("TESTING CHATBOT RESPONSE FILTERING");
console.log("==================================");

simulateResponse("Why don't I see card payment options in checkout?", "");
simulateResponse("Payment not working", "");
simulateResponse("Checkout issues", "");

console.log("\n\nWith proper context (should allow helpful responses):");
const properContext = "We accept credit cards, debit cards, PayPal, and Apple Pay. If you experience checkout issues, contact support@company.com or call 1-800-123-4567.";
simulateResponse("Why don't I see card payment options?", properContext);
