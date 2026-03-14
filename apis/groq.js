const axios = require('axios');

async function callGroq(message, history) {
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
        throw new Error('Groq API key not configured');
    }
    
    try {
        // Format messages for Groq (OpenAI-compatible format)
        const messages = [
            { role: 'system', content: 'You are a helpful AI assistant.' },
            ...history,
            { role: 'user', content: message }
        ];
        
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.3-70b-versatile', // Free, fast, and powerful!
                messages: messages,
                temperature: 0.7,
                max_tokens: 1000
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return response.data.choices[0].message.content;
        
    } catch (error) {
        console.error('Groq Error:', error.response?.data || error.message);
        throw new Error('Failed to get response from Groq');
    }
}

module.exports = { callGroq };
