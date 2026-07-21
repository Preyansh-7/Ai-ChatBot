const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// FIX: added 'groq' and 'llama-3.3-70b' keys to match what the frontend sends
function getGroqModelName(modelShortName) {
    const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

    const modelMap = {
        groq: DEFAULT_MODEL,

        // LLaMA models
        'llama-3.3-70b': DEFAULT_MODEL,
        'llama-3.3-70b-versatile': DEFAULT_MODEL,
        'llama-3.1-8b': 'llama-3.1-8b-instant',
        'llama-3.1-70b': 'llama-3.1-70b-versatile',

        // Google Gemma
        'gemma-7b': 'gemma2-9b-it',

        // DeepSeek
        'deepseek-r1': 'deepseek-r1-distill-llama-70b',
    };

    // Normalize input (important!)
    const key = modelShortName?.toLowerCase().trim();

    return modelMap[key] || DEFAULT_MODEL;
}

async function callGroq(message, history, settings = {}) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('Groq API key not configured');

    // FIX: cap message length to prevent abuse
    const safeMessage = message.substring(0, 4000);

    const cleanHistory = history.map(msg => ({
        role: msg.role === 'assistant' || msg.role === 'model' ? 'assistant' : 'user',
        content: String(msg.content).substring(0, 4000)
    }));

    const messages = [
        { role: 'system', content: settings.system_prompt || 'You are a helpful AI assistant.' },
        ...cleanHistory,
        { role: 'user', content: safeMessage }
    ];

    const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
            model: getGroqModelName(settings.model || 'llama-3.3-70b'),
            messages,
            temperature: Math.min(Math.max(parseFloat(settings.temperature) || 0.7, 0), 1),
            max_tokens: Math.min(parseInt(settings.max_tokens) || 2000, 4000),
            top_p: settings.top_p || 0.9,
            stream: false
        },
        {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return response.data.choices[0].message.content;
}

app.post('/chat', async (req, res) => {
    try {
        const {
            message,
            history = [],
            model = 'llama-3.3-70b',
            temperature = 0.7,
            max_tokens = 2000,
            top_p = 0.9,
            system_prompt = 'You are a helpful AI assistant.',
        } = req.body;

        // FIX: validate message exists and is a string
        if (!message || typeof message !== 'string' || message.trim() === '') {
            return res.status(400).json({ error: 'Message is required and must be a non-empty string' });
        }

        const aiResponse = await callGroq(message, history, { model, temperature, max_tokens, top_p, system_prompt });

        res.json({
            response: aiResponse,
            message: aiResponse,
            content: aiResponse,
            model
        });

    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to get AI response',
            details: error.message
        });
    }
});

app.get('/', (req, res) => {
    res.json({
        status: 'Nexus AI Backend is running ✅',
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma-7b-it'],
        endpoints: { chat: 'POST /chat', health: 'GET /' }
    });
});

app.head('/chat', (req, res) => res.status(200).end());
app.post('/chat-stream', async (req, res) => {
    const {
        message,
        history = [],
        model = 'llama-3.3-70b',
        temperature = 0.7,
        max_tokens = 2000,
        system_prompt = 'You are a helpful AI assistant.',
    } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ error: 'Message is required' });
    }

    const apiKey = process.env.GROQ_API_KEY;

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const cleanHistory = history.map(msg => ({
            role: msg.role === 'assistant' || msg.role === 'model' ? 'assistant' : 'user',
            content: String(msg.content).substring(0, 4000)
        }));

        const messages = [
            { role: 'system', content: system_prompt },
            ...cleanHistory,
            { role: 'user', content: message.substring(0, 4000) }
        ];

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: getGroqModelName(model),
                messages,
                temperature: Math.min(Math.max(parseFloat(temperature) || 0.7, 0), 1),
                max_tokens: Math.min(parseInt(max_tokens) || 2000, 4000),
                stream: true
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'stream'
            }
        );

        response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n').filter(line => line.trim());
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        res.write('data: [DONE]\n\n');
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices[0]?.delta?.content || '';
                        if (content) {
                            res.write(`data: ${JSON.stringify({ content })}\n\n`);
                        }
                    } catch {}
                }
            }
        });

        response.data.on('end', () => {
            res.write('data: [DONE]\n\n');
            res.end();
        });

        response.data.on('error', () => {
            res.end();
        });

    } catch (error) {
        console.error('Stream error:', error.message);
        res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
        res.end();
    }
});
app.listen(PORT, () => {
    console.log(`🚀 Nexus AI Server running on port ${PORT}`);
    console.log(`📡 API endpoint: http://localhost:${PORT}/chat`);
});

app.post('/generate-image', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        const response = await axios.post(
  "https://router.huggingface.co/nscale/black-forest-labs/FLUX.1-schnell",
  { inputs: prompt },
  {
    headers: {
      Authorization: `Bearer ${process.env.HF_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "image/png"
    },
    responseType: "arraybuffer",
    timeout: 60000
  }
);


        // Check if response is JSON error instead of image
        const contentType = response.headers['content-type'];
        if (contentType && contentType.includes('application/json')) {
            const errorMsg = JSON.parse(Buffer.from(response.data).toString());
            console.error('HF returned error:', errorMsg);
            return res.status(500).json({ error: errorMsg.error || 'HF error' });
        }

        const base64 = Buffer.from(response.data).toString('base64');
        res.json({ image: `data:image/png;base64,${base64}` });

    } catch (error) {
        // Try to decode error buffer
        if (error.response?.data) {
            try {
                const errMsg = JSON.parse(Buffer.from(error.response.data).toString());
                console.error('HF Error details:', errMsg);
                return res.status(500).json({ error: errMsg.error || 'Failed to generate image' });
            } catch {}
        }
        console.error('HF Error:', error.message);
        res.status(500).json({ error: 'Failed to generate image' });
    }
});