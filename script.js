
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
    import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

    // ===== FIREBASE CONFIG =====
    const firebaseConfig = {
        apiKey: "AIzaSyBDyEfe83-_CzRchqcO_lLnuO6Rg9_AF_8",
        authDomain: "amogenz.firebaseapp.com",
        databaseURL: "https://amogenz-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "amogenz",
        storageBucket: "amogenz.firebasestorage.app",
        messagingSenderId: "864003468268",
        appId: "1:864003468268:web:7c861806529a0dacd66ec9"
    };
    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);

    // ===== SIDEBAR =====
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const btnHamburger = document.getElementById('btn-hamburger');
    const btnCloseSidebar = document.getElementById('btn-close-sidebar');

    function openSidebar() {
        sidebar.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    btnHamburger.addEventListener('click', openSidebar);
    btnCloseSidebar.addEventListener('click', closeSidebar);
    overlay.addEventListener('click', closeSidebar);

    // Nav items close sidebar + scroll
    document.querySelectorAll('.nav-item[href]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            closeSidebar();
            const target = document.querySelector(item.getAttribute('href'));
            if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
        });
    });

    // ===== BIO TABS =====
    document.querySelectorAll('.bio-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.bio-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.bio-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
        });
    });

    // ===== HELPERS =====
    function isArabic(text) { return /[\u0600-\u06FF]/.test(text); }

    function createCacheKey(text) {
        const clean = text.replace(/[\u064B-\u065F]/g, "").trim().replace(/\s+/g, '_');
        return btoa(unescape(encodeURIComponent(clean))).replace(/[/+=]/g, "");
    }

    // ===== INPUT LOGIC =====
    const inputEl = document.getElementById('arabic-input');
    const btnAnalyze = document.getElementById('btn-analyze');
    const wordCounter = document.getElementById('word-counter');

    inputEl.addEventListener('input', () => {
        const text = inputEl.value;
        const words = text.trim() === '' ? [] : text.trim().split(/\s+/).filter(w => w.length > 0);
        const count = words.length;

        wordCounter.querySelector('span').textContent = `${count} / 7 kata`;
        wordCounter.className = 'word-counter' + (count > 7 ? ' warn' : count > 0 ? ' ok' : '');

        btnAnalyze.disabled = !(isArabic(text) && count > 0 && count <= 7);
    });

    // ===== RENDER RESULT =====
    const KEY_NAMES = {
        1: 'Jenis',
        2: 'Alasan Jenis',
        3: 'Status',
        4: 'Alasan Status',
        5: "I'rob",
        6: "Alasan I'rob",
        7: "Tanda I'rob",
        8: 'Alasan Tanda',
        9: "Bina'",
        10: 'Shighot',
        11: 'Tasrif'
    };

    function escHtml(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function formatVal(raw) {
        // Bold markdown
        let s = raw.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Wrap Arabic sequences with .ar class for proper font + direction
        s = s.replace(/([\u0600-\u06FF\u064B-\u065F\s]+)/g, (m) => {
            const clean = m.trim();
            if (!clean) return m;
            if (/[\u0600-\u06FF]/.test(clean)) return ` <span class="ar">${clean}</span> `;
            return m;
        });
        return s.trim();
    }

    /**
     * Parse raw AI text into array of lafadz objects.
     * Works incrementally — safe to call during streaming.
     * Each lafadz: { arabic, points: [{num, key, val}] }
     */
    function parseText(text) {
        const lafadzList = [];

        // Split on === LAFADZ: ... === or just === LAFADZ: ... (no closing ===)
        // Pattern: start of a lafadz section
        const headerRegex = /===\s*LAFADZ\s*:\s*([^\n=]+?)(?:\s*===)?\s*\n/gi;

        const matches = [...text.matchAll(headerRegex)];
        if (!matches.length) return null; // still streaming preamble

        matches.forEach((match, i) => {
            const arabic = match[1].trim();
            const startIdx = match.index + match[0].length;
            const endIdx = i + 1 < matches.length ? matches[i + 1].index : text.length;
            const body = text.slice(startIdx, endIdx);

            // Parse numbered points from body
            // Strategy: collect lines, merge continuation lines into the last point
            const lines = body.split('\n');
            const points = [];
            let currentPoint = null;

            for (const rawLine of lines) {
                const line = rawLine.trimEnd();
                if (!line.trim()) continue;

                // Numbered point: "1. Key: value" or "1. Key :" or "1. value"
                const numMatch = line.match(/^\s*(\d{1,2})\.\s*(.+)/);
                if (numMatch) {
                    const num = parseInt(numMatch[1]);
                    const rest = numMatch[2];

                    // Check if rest has "Key: value" pattern
                    const colonIdx = rest.indexOf(':');
                    let key = KEY_NAMES[num] || `Poin ${num}`;
                    let val = '';

                    if (colonIdx !== -1) {
                        const beforeColon = rest.slice(0, colonIdx).trim();
                        const afterColon = rest.slice(colonIdx + 1).trim();
                        // If beforeColon is very short or matches key pattern, treat as key
                        if (beforeColon.length < 30) {
                            // Use AI's own key label as fallback if not in our map
                            key = KEY_NAMES[num] || beforeColon || key;
                            val = afterColon;
                        } else {
                            val = rest; // whole thing is value
                        }
                    } else {
                        val = rest;
                    }

                    currentPoint = { num, key, val };
                    points.push(currentPoint);
                } else if (currentPoint && line.trim()) {
                    // Continuation of previous point — append
                    currentPoint.val += ' ' + line.trim();
                }
            }

            lafadzList.push({ arabic, points, wordNum: i + 1 });
        });

        return lafadzList;
    }

    function buildHtml(lafadzList, isStreaming) {
        let html = '';
        lafadzList.forEach(({ arabic, points, wordNum }) => {
            let rowsHtml = '';
            points.forEach(({ num, key, val }) => {
                if (!val.trim()) return;
                rowsHtml += `
                <div class="lc-row">
                    <div class="lc-num"><div class="lc-num-inner">${num}</div></div>
                    <div class="lc-key">${escHtml(key)}</div>
                    <div class="lc-sep">:</div>
                    <div class="lc-val">${formatVal(escHtml(val))}</div>
                </div>`;
            });

            const streamingIndicator = isStreaming && wordNum === lafadzList.length
                ? `<div class="stream-placeholder"><div class="stream-dot"></div>Sedang menyusun analisis...</div>`
                : '';

            html += `
            <div class="lafadz-card">
                <div class="lc-header">
                    <div class="lc-arabic">${escHtml(arabic)}</div>
                    <div class="lc-badge">Lafadz ${wordNum}</div>
                </div>
                <div class="lc-body">
                    ${rowsHtml || '<div class="stream-placeholder"><div class="stream-dot"></div>Menganalisis...</div>'}
                    ${streamingIndicator}
                </div>
            </div>`;
        });
        return html;
    }

    function renderResult(text, isStreaming = false) {
        const content = document.getElementById('syarah-content');
        const parsed = parseText(text);

        if (!parsed) {
            // AI hasn't output first header yet — show live typing indicator
            content.innerHTML = `<div class="stream-placeholder"><div class="stream-dot"></div>Memproses teks Arab...</div>`;
            return;
        }

        content.innerHTML = buildHtml(parsed, isStreaming);
    }

    // ===== MAIN ANALYSIS =====
    async function analyze() {
        const input = inputEl.value.trim();
        if (!input) return;

        btnAnalyze.disabled = true;
        document.getElementById('result-area').style.display = 'none';
        document.getElementById('loading-area').style.display = 'flex';
        document.getElementById('syarah-content').innerHTML = '';
        document.getElementById('result-input-display').textContent = input;

        const cacheKey = createCacheKey(input);
        const cacheRef = ref(db, `syarah_cache/${cacheKey}`);

        try {
            // Check cache
            const snapshot = await get(cacheRef);
            if (snapshot.exists()) {
                const cached = snapshot.val();
                document.getElementById('loading-area').style.display = 'none';
                document.getElementById('result-area').style.display = 'block';
                document.getElementById('result-source-badge').innerHTML = '<i class="ph-fill ph-database"></i> Cache';
                document.getElementById('result-source-badge').className = 'source-badge badge-cache';
                renderResult(cached.result);
                document.getElementById('result-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }

            // Build prompt
            const prompt = `Analisis kalimat Arab berikut per lafadz dengan sangat detail sesuai kaidah ilmu Nahwu dan Shorof:
Kalimat: ${input}

Berikan analisis mendalam untuk SETIAP kata dengan format persis seperti ini (WAJIB LENGKAP sampai poin 11):

=== LAFADZ: [kata arab] ===
1. Jenis: [Isim/Fi'il/Huruf]
2. Alasan Jenis: [tanda-tanda beserta dalil dari Jurumiyyah/Imrithi/Alfiyyah jika ada]
3. Status: [Mu'rob/Mabni]
4. Alasan Status: [kenapa mu'rob atau mabni, beserta dalil jika ada]
5. I'robnya: [Rafa'/Nashab/Jarr/Jazm/Mabni]
6. Alasan I'rob: [karena menjadi apa dalam kalimat, beserta dalil jika ada]
7. Tanda I'rob: [Dhammah/Fathah/Kasroh/Ya'/Alif/Nun dll]
8. Alasan Tanda: [isim mufrad/asmaul khomsah/af'alul khomsah dll, beserta dalil jika ada]
9. Bina': [jika mabni: mabni 'ala apa; jika fi'il: bina' shohih/mu'tal dll]
10. Shighot: [jenis shorof: madhi/mudhari'/amar/masdar/isim fa'il/isim maf'ul dll]
11. Tasrif: [penjelasan tasrif istilahi dan lughowi, asal kata, perubahan bentuk]

PENTING: Selesaikan analisis SEMUA kata hingga poin 11. Jangan potong di tengah. Gunakan Bahasa Indonesia yang mudah dipahami santri.`;

       // Ganti dengan URL Vercel kamu (contoh: https://amogenz.vercel.app/api/analyze)
        // --- AUTO DETECT: Production vs Local (Acode/localhost) ---
const isLocal = location.hostname === 'localhost' 
    || location.hostname === '127.0.0.1' 
    || location.protocol === 'file:';

let resp;
if (isLocal) {
    // ACODE / LOCAL: Panggil Groq langsung (hardcode key untuk dev only)
    const GROQ_API_KEY_LOCAL = "gsk_XXXXXXXXXXXXXXXXXXXXXXXX"; // ← ganti API key kamu di sini
    resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${GROQ_API_KEY_LOCAL}`,
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
} else {
    // PRODUCTION: Pakai proxy Vercel (API key aman di server)
    const VERCEL_PROXY_URL = "https://ai-nahwu.amogenz.xyz/api/analyze";
    resp = await fetch(VERCEL_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt })
    });
}


            if (!resp.ok) throw new Error("Gagal terhubung ke AI. Coba lagi.");

            document.getElementById('loading-area').style.display = 'none';
            document.getElementById('result-area').style.display = 'block';
            document.getElementById('result-source-badge').innerHTML = '<i class="ph-fill ph-brain"></i> AI';
            document.getElementById('result-source-badge').className = 'source-badge badge-ai';
            document.getElementById('result-area').scrollIntoView({ behavior: 'smooth', block: 'start' });


            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let cumulative = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n'); // Split data per baris

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

                    const raw = trimmedLine.replace('data: ', '');
                    if (raw === '[DONE]') break;

                    try {
                        const parsed = JSON.parse(raw);
                        const token = parsed.choices[0]?.delta?.content;
                        if (token) {
                            cumulative += token;
                            renderResult(cumulative, true);
                        }
                    } catch (e) {
                        console.debug("Menunggu potongan data lengkap...");
                    }
                }
            }

            // Render terakhir tanpa indikator loading
            renderResult(cumulative, false);


            // Save to Firebase
            if (cumulative.length > 50) {
                renderResult(cumulative, false); // final clean render
                await set(cacheRef, {
                    original_input: input,
                    result: cumulative,
                    created_at: Date.now()
                });
            }

        } catch (err) {
            document.getElementById('loading-area').style.display = 'none';
            document.getElementById('syarah-content').innerHTML = `
                <div style="padding:24px; color:#ff4d4d; text-align:center;">
                    <i class="ph ph-warning-circle" style="font-size:2rem;"></i>
                    <p style="margin-top:8px;">${err.message}</p>
                </div>`;
            document.getElementById('result-area').style.display = 'block';
        } finally {
            btnAnalyze.disabled = false;
        }
    }

    btnAnalyze.addEventListener('click', analyze);
    inputEl.addEventListener('keypress', e => {
        if (e.key === 'Enter' && !btnAnalyze.disabled) analyze();
    });

    // Copy button
    document.getElementById('btn-copy').addEventListener('click', () => {
        const text = document.getElementById('syarah-content').innerText;
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('btn-copy');
            btn.innerHTML = '<i class="ph ph-check"></i> Tersalin!';
            setTimeout(() => btn.innerHTML = '<i class="ph ph-copy"></i> Salin', 2000);
        });
    });

    // ===== CUSTOM CURSOR =====
    const dot  = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    if (dot && ring) {
        let mx = -100, my = -100, rx = -100, ry = -100;
        document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
        (function animate() {
            rx += (mx - rx) * 0.18;
            ry += (my - ry) * 0.18;
            dot.style.left  = mx + 'px';
            dot.style.top   = my + 'px';
            ring.style.left = rx + 'px';
            ring.style.top  = ry + 'px';
            requestAnimationFrame(animate);
        })();
        document.querySelectorAll('button, a, input, [class*="btn"], .nav-item, .bio-tab').forEach(el => {
            el.addEventListener('mouseenter', () => ring.style.transform = 'translate(-50%,-50%) scale(1.6)');
            el.addEventListener('mouseleave', () => ring.style.transform = 'translate(-50%,-50%) scale(1)');
        });
    }
