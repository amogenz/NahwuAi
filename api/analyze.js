// Logic NahwuAI - By Amogenz
const axios = require('axios');

export default async function handler(req, res) {
    // 1. Cek Method
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Hanya menerima POST bray!' });
    }

    try {
        const { provider, modelId, messages } = req.body;
        
        // 2. Ambil Key dari Environment Vercel
        const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
        const GROQ_KEY = process.env.GROQ_API_KEY;

        let apiUrl = provider === 'groq' 
            ? 'https://api.groq.com/openai/v1/chat/completions' 
            : 'https://openrouter.ai/api/v1/chat/completions';
        
        let apiKey = provider === 'groq' ? GROQ_KEY : OPENROUTER_KEY;

        // 3. Tembak ke AI
        const response = await axios.post(apiUrl, {
            model: modelId,
            messages: messages,
            temperature: 0.2
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        // 4. Balikin hasil ke frontend
        return res.status(200).json(response.data);

    } catch (error) {
        return res.status(500).json({ 
            error: error.response?.data?.error?.message || error.message 
        });
    }
}
