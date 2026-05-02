export default async function handler(req, res) {
    // 1. Handle CORS & Method
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Hanya menerima POST, Bray!' });
    }

    try {
        const { provider, modelId, messages } = req.body;
        
        // 2. Ambil Key dari Environment
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

        // 3. Cek apakah Key ada
        if (!apiKey) {
            return res.status(500).json({ error: `API Key untuk ${provider} belum dipasang di Vercel!` });
        }

        // 4. Tembak ke AI pakai Native Fetch (Tanpa Axios)
        const aiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: modelId,
                messages: messages,
                temperature: 0.2
            })
        });

        const data = await aiResponse.json();

        if (!aiResponse.ok) {
            return res.status(aiResponse.status).json({ 
                error: data.error?.message || 'AI Provider Error' 
            });
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ error: "Internal Server Error: " + error.message });
    }
}
