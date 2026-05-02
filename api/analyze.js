// Logic NahwuAI - By Amogenz
const axios = require('axios');

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Hanya menerima POST bray!" };
    }

    try {
        const { provider, modelId, messages } = JSON.parse(event.body);
        
        // Ambil Key dari Environment Variables (Dashboard Netlify)
        const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
        const GROQ_KEY = process.env.GROQ_API_KEY;

        let apiUrl = "";
        let apiKey = "";

        if (provider === 'groq') {
            apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
            apiKey = GROQ_KEY;
        } else {
            apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
            apiKey = OPENROUTER_KEY;
        }

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

        return {
            statusCode: 200,
            body: JSON.stringify(response.data)
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.response?.data?.error?.message || error.message })
        };
    }
};
