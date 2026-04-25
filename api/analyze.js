// api/analyze.js
export default async function handler(req, res) {
    // 1. CORS Headers PERTAMA sebelum apapun
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // 2. Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 3. Tolak selain POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt } = req.body;
    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
        return res.status(500).json({ error: 'GROQ_API_KEY tidak ditemukan di environment variables.' });
    }

    // 4. Set streaming headers SEBELUM memanggil Groq
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.status(200);

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
                max_tokens: 7000,
                stream: true
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            res.write(`data: ${JSON.stringify({ error: errText })}\n\n`);
            res.end();
            return;
        }

        // 5. Pipe stream dari Groq ke client
        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }
        res.end();

    } catch (error) {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
}
