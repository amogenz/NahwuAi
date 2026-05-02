

document.addEventListener('DOMContentLoaded', () => {

    /* ── Modal ── */
    const modal = document.getElementById('startup-modal');
    setTimeout(() => modal.classList.add('visible'), 120);
    document.getElementById('close-modal-btn')
        .addEventListener('click', () => modal.classList.remove('visible'));

    /* ── Sidebar ── */
    const sidebar        = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const hamburger      = document.getElementById('hamburger');
    const sidebarClose   = document.getElementById('sidebar-close');

    function openSidebar() {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('visible');
        document.body.style.overflow = '';
    }
    hamburger.addEventListener('click', openSidebar);
    sidebarClose.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    /* Sidebar tabs */
    document.querySelectorAll('.sb-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.sb-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.sb-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`sbpanel-${tab.dataset.tab}`).classList.add('active');
        });
    });

    /* Sidebar accordion */
    document.querySelectorAll('.sb-entry-header').forEach(h => {
        h.addEventListener('click', () => h.closest('.sb-entry').classList.toggle('open'));
    });

    /* ── Model selector badge ── */
    const modelSelect = document.getElementById('model-select');
    const modelBadge  = document.getElementById('model-badge');
    function updateBadge() {
        const isGroq = modelSelect.value.startsWith('groq:');
        modelBadge.textContent = isGroq ? 'Groq' : 'OpenRouter';
        modelBadge.className   = 'model-badge ' + (isGroq ? 'badge-groq' : 'badge-openrouter');
    }
    modelSelect.addEventListener('change', updateBadge);
    updateBadge();

    /* ── App elements ── */
    const steps               = document.querySelectorAll('.step');
    const analyzeBtn          = document.getElementById('analyze-btn');
    const arabicTextarea      = document.getElementById('arabic-text');
    const loadingDiv          = document.getElementById('loading');
    const analysisOutput      = document.getElementById('analysis-output');
    const dalilOutput         = document.getElementById('dalil-output');
    const selectedWordDisplay = document.getElementById('selected-word-display');

    /* ── State ── */
    let currentAnalysisData = null;
    let selectedWord        = null;
    let currentAnalysisType = 'all';

    /* ════════════════════════════════════════
       HELPERS
    ════════════════════════════════════════ */

    function showStep(n) {
        steps.forEach(s => s.classList.add('hidden'));
        document.getElementById(`step-${n}`).classList.remove('hidden');
    }

    function isArabic(text) { return /[\u0600-\u06FF]/.test(text); }

    function clean(text) {
        return (text || '')
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/\*\*/g, '')
            .replace(/_{1,2}/g, '')
            .trim();
    }

    /* ════════════════════════════════════════
       MULTI-MODEL API 
    ════════════════════════════════════════ */

    function parseModel() {
        const val = modelSelect.value;
        const idx = val.indexOf(':');
        return { provider: val.slice(0, idx), modelId: val.slice(idx + 1) };
    }

    async function callLLM(messages, expectJson = false) {
        const { provider, modelId } = parseModel();

        // Panggil ke API internal milik kita sendiri
        const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider,   // 'groq' atau 'openrouter'
                modelId,    // id model asli
                messages,
                expectJson
            }),
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        let text = data.choices?.[0]?.message?.content || '';
        text = clean(text);

        if (!expectJson) return text;

        /* Parsing JSON Robust */
        text = text.replace(/^```[\w]*\n?/m, '').replace(/```$/m, '').trim();
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        if (start === -1 || end === -1) throw new Error("Format JSON tidak valid dari AI");
        
        return JSON.parse(text.slice(start, end + 1));
    }

    /* ════════════════════════════════════════
       PROMPTS
    ════════════════════════════════════════ */

    async function fetchAnalysis(text) {
        const messages = [
            {
                role: 'system',
                content: 'Kamu adalah pakar Nahwu dan Shorof Arab klasik. Balas HANYA dengan JSON array murni, tanpa kalimat pembuka/penutup, tanpa markdown fences.'
            },
            {
                role: 'user',
                content: `Analisislah setiap kata dalam teks Arab berikut. Kembalikan JSON array. Setiap elemen memiliki field:
"word": kata Arab aslinya
"nahwu": penjelasan nahwu (B.Indonesia)
"shorof": penjelasan wazan/shorof (B.Indonesia)
"irab": penjelasan i'rab lengkap (B.Indonesia)
"hasDalil": boolean
"dalilTopic": string singkat B.Inggris, misal "isim_marfu"
"dalilQuestions": array 3 pertanyaan nahwu (B.Indonesia)
"dalilOptions": array opsi dalil spesifik

Teks: ${text}`
            }
        ];
        return callLLM(messages, true);
    }

    async function fetchDalil(topic, source) {
        const messages = [
            { role: 'system', content: 'Kamu pakar kitab kuning. Jawab langsung tanpa kalimat pembuka atau penutup apapun.' },
            { role: 'user',   content: `Berikan dalil dari kitab Nahwu ${source} yang relevan dengan kaidah "${topic}". Tulis teks Arab aslinya dulu, lalu terjemahannya dalam Bahasa Indonesia.` }
        ];
        return callLLM(messages, false);
    }

    async function fetchAnswer(question) {
        const messages = [
            { role: 'system', content: 'Pakar nahwu. Jawab singkat dan jelas dalam Bahasa Indonesia. Tanpa format bold atau asterisk.' },
            { role: 'user',   content: `Konteks kaidah nahwu: ${question}` }
        ];
        return callLLM(messages, false);
    }

    /* ════════════════════════════════════════
       RENDER HELPERS
    ════════════════════════════════════════ */

    function makeInfoCard(label, content, accentColor) {
        const card = document.createElement('div');
        card.className = 'info-card';
        const color = accentColor || 'var(--emerald)';
        card.innerHTML = `
            <div class="info-card-header">
                <span class="info-card-dot" style="background:${color}"></span>
                <span class="info-card-label" style="color:${color}">${label}</span>
            </div>
            <div class="info-card-body">${clean(content)}</div>`;
        return card;
    }

    function parseDalilOutput(text, source) {
        const lines = clean(text).split('\n').map(l => l.trim()).filter(Boolean);
        let arabic = '', rest = '';
        for (let i = 0; i < lines.length; i++) {
            if (/[\u0600-\u06FF]/.test(lines[i]) && lines[i].length > 3) {
                arabic = lines[i];
                rest   = lines.slice(i + 1).join(' ').trim();
                break;
            }
        }
        if (!arabic) return `<span class="dalil-source-label">Dalil dari ${source}</span><p>${clean(text)}</p>`;
        return `<span class="dalil-source-label">Dalil dari Kitab ${source}</span>
                <div class="dalil-arabic">${arabic}</div>
                <p class="dalil-translation"><strong>Terjemahan:</strong> ${rest || '—'}</p>`;
    }

    async function loadDalil(topic, source, container) {
        container.innerHTML = `<div style="display:flex;align-items:center;gap:.5rem;color:var(--gold)"><div class="spinner" style="border-top-color:var(--gold)"></div>Mencari dari ${source}…</div>`;
        try {
            const result = await fetchDalil(topic, source);
            container.innerHTML = parseDalilOutput(result, source);
        } catch(e) {
            container.innerHTML = `<p style="color:var(--red);font-size:.85rem">Gagal: ${e.message}</p>`;
        }
    }

    function buildKitabButtons(topic, container) {
        container.innerHTML = `<p class="dalil-section-title" style="margin-bottom:.45rem">Pilih kitab untuk <em>${clean(topic).replace(/_/g,' ')}</em></p>
            <div class="tag-row">
                ${['Jurumiyah','Imriti','Alfiyah'].map(s =>
                    `<button class="tag-btn tag-gold" data-source="${s}" data-topic="${topic}">${s}</button>`
                ).join('')}
            </div>`;
        container.querySelectorAll('.tag-btn').forEach(b => {
            b.addEventListener('click', () => loadDalil(b.dataset.topic, b.dataset.source, container));
        });
    }

    /* ════════════════════════════════════════
       WORD CHIP
    ════════════════════════════════════════ */

    function createWordChip(item) {
        const chip = document.createElement('span');
        chip.className = 'word-chip';
        chip.textContent = item.word;
        chip.dataset.analysis = JSON.stringify(item);
        chip.addEventListener('click', () => selectWord(chip));
        return chip;
    }

    /* ════════════════════════════════════════
       SELECT WORD → build step 4
    ════════════════════════════════════════ */

    function selectWord(el) {
        if (selectedWord) selectedWord.classList.remove('selected');
        selectedWord = el;
        el.classList.add('selected');

        const data = JSON.parse(el.dataset.analysis);
        selectedWordDisplay.textContent = data.word;
        dalilOutput.innerHTML = '';

        const all    = currentAnalysisType === 'all';
        const doN    = all || currentAnalysisType === 'nahwu';
        const doS    = all || currentAnalysisType === 'shorof';
        const doI    = all || currentAnalysisType === 'irab';

        if (data.nahwu  && doN) dalilOutput.appendChild(makeInfoCard('Nahwu',  data.nahwu));
        if (data.shorof && doS) dalilOutput.appendChild(makeInfoCard('Shorof', data.shorof));
        if (data.irab   && doI) dalilOutput.appendChild(makeInfoCard("I'rab",  data.irab, 'var(--gold)'));

        /* ── Dalil card ── */
        if (data.hasDalil) {
            const opts = new Set(data.dalilOptions || []);
            const nl = (data.nahwu  || '').toLowerCase();
            const sl = (data.shorof || '').toLowerCase();
            ['isim jamid','isim mufrad','isim alam','isim mudzakkar','isim muannats','isim marifah','isim nakirah']
                .forEach(k => { if (nl.includes(k)) opts.add(k); });
            if (nl.includes('isim')  || sl.includes('isim'))  opts.add('isim');
            if (nl.includes('fiil')  || sl.includes('fiil'))  opts.add('fiil');
            if (nl.includes('huruf') || sl.includes('huruf')) opts.add('huruf');
            const optArr = Array.from(opts);

            const dalilCard = document.createElement('div');
            dalilCard.className = 'info-card';
            dalilCard.innerHTML = `<div class="info-card-header">
                <span class="info-card-dot" style="background:var(--gold)"></span>
                <span class="info-card-label" style="color:var(--gold)">Dalil Kaidah</span>
            </div>`;

            const dBody = document.createElement('div');
            dBody.className = 'info-card-body';
            dBody.style.display = 'flex';
            dBody.style.flexDirection = 'column';
            dBody.style.gap = '.65rem';

            const dalilContent = document.createElement('div');
            dalilContent.id = 'dalil-content';
            dalilContent.innerHTML = '<span style="color:var(--muted);font-size:.84rem">Pilih dalil di atas.</span>';

            if (optArr.length) {
                const wrap = document.createElement('div');
                wrap.innerHTML = `<p class="dalil-section-title">Pilih jenis dalil</p>`;
                const row = document.createElement('div');
                row.className = 'tag-row';
                row.style.marginTop = '.35rem';
                optArr.forEach(opt => {
                    const btn = document.createElement('button');
                    btn.className = 'tag-btn tag-gold';
                    btn.textContent = opt.replace(/_/g,' ');
                    btn.addEventListener('click', () => buildKitabButtons(opt.replace(/\s/g,'_'), dalilContent));
                    row.appendChild(btn);
                });
                wrap.appendChild(row);
                dBody.appendChild(wrap);
            } else {
                buildKitabButtons(data.dalilTopic || 'nahwu', dalilContent);
            }

            dBody.appendChild(dalilContent);
            dalilCard.appendChild(dBody);
            dalilOutput.appendChild(dalilCard);

            /* ── Questions card ── */
            if (data.dalilQuestions?.length) {
                const qCard = document.createElement('div');
                qCard.className = 'info-card';
                qCard.innerHTML = `<div class="info-card-header">
                    <span class="info-card-dot"></span>
                    <span class="info-card-label">Pertanyaan Lanjutan</span>
                </div>`;
                const qBody = document.createElement('div');
                qBody.className = 'info-card-body';
                qBody.style.display = 'flex';
                qBody.style.flexDirection = 'column';
                qBody.style.gap = '.6rem';

                const row = document.createElement('div');
                row.className = 'tag-row';
                const chatArea = document.createElement('div');
                chatArea.className = 'chat-wrap';

                data.dalilQuestions.forEach(q => {
                    const btn = document.createElement('button');
                    btn.className = 'tag-btn tag-teal';
                    btn.textContent = clean(q);
                    btn.addEventListener('click', () => askQuestion(q, chatArea));
                    row.appendChild(btn);
                });

                qBody.appendChild(row);
                qBody.appendChild(chatArea);
                qCard.appendChild(qBody);
                dalilOutput.appendChild(qCard);
            }

        } else {
            const noD = document.createElement('div');
            noD.className = 'no-dalil';
            noD.textContent = 'Tidak ada dalil spesifik untuk kaidah ini.';
            dalilOutput.appendChild(noD);
        }

        showStep(4);
    }

    async function askQuestion(question, chatArea) {
        const uBubble = document.createElement('div');
        uBubble.className = 'chat-bubble user';
        uBubble.innerHTML = `<strong>Saya:</strong> ${clean(question)}`;
        chatArea.appendChild(uBubble);

        const loadBubble = document.createElement('div');
        loadBubble.className = 'chat-bubble ai';
        loadBubble.innerHTML = `<div style="display:flex;align-items:center;gap:.4rem"><div class="spinner"></div>Menjawab…</div>`;
        chatArea.appendChild(loadBubble);
        chatArea.scrollTop = chatArea.scrollHeight;

        try {
            const ans = await fetchAnswer(question);
            loadBubble.innerHTML = `<strong>NahwuAI:</strong> ${clean(ans)}`;
        } catch(e) {
            loadBubble.innerHTML = `<span style="color:var(--red)">Gagal: ${e.message}</span>`;
        }
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    /* ════════════════════════════════════════
       DISPLAY ANALYSIS (step 3)
    ════════════════════════════════════════ */

    function displayAnalysis(data) {
        analysisOutput.innerHTML = '';
        if (!Array.isArray(data) || !data.length) {
            analysisOutput.innerHTML = '<span style="color:var(--muted);font-size:.88rem">Tidak ada kata yang berhasil dianalisis.</span>';
            return;
        }
        data.forEach(item => analysisOutput.appendChild(createWordChip(item)));
    }

    /* ════════════════════════════════════════
       EVENT LISTENERS
    ════════════════════════════════════════ */

    analyzeBtn.addEventListener('click', async () => {
        const text = arabicTextarea.value.trim();
        if (!text)           { alert('Masukkan teks bahasa Arab terlebih dahulu!'); return; }
        if (!isArabic(text)) { alert('Teks yang dimasukkan bukan bahasa Arab.'); return; }

        showStep(3);
        analysisOutput.innerHTML = '';
        loadingDiv.classList.add('visible');

        const { provider } = parseModel();
        const start = Date.now();
        const timer = setInterval(() => {
            const s = Math.floor((Date.now() - start) / 1000);
            loadingDiv.querySelector('span').textContent =
                `${provider === 'groq' ? 'Groq' : 'OpenRouter'} sedang memproses… (${s}s)`;
        }, 1000);

        try {
            const result = await fetchAnalysis(text);
            currentAnalysisData = result;
            clearInterval(timer);
            loadingDiv.classList.remove('visible');
            showStep(2);
        } catch(err) {
            clearInterval(timer);
            loadingDiv.classList.remove('visible');
            analysisOutput.innerHTML = `<span style="color:var(--red);font-size:.88rem">Error: ${err.message}</span>`;
            showStep(3);
        }
    });

    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentAnalysisType = btn.dataset.type;
            if (!currentAnalysisData?.length) { alert('Data analisis kosong.'); return; }
            displayAnalysis(currentAnalysisData);
            showStep(3);
        });
    });

    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => showStep(btn.dataset.step));
    });

    showStep(1);
});

/* ── Contoh Acak ── */
const EXAMPLES = [
    'الحمد لله رب العالمين',
    'هذا كتاب جديد',
    'ذهب الطالب إلى المسجد',
    'محمد رسول الله',
    'القرآن الكريم',
    'إِنَّ اللهَ مَعَ الصَّابِرِينَ',
    'طَلَبُ الْعِلْمِ فَرِيضَةٌ',
];

document.getElementById('example-btn').addEventListener('click', () => {
    document.getElementById('arabic-text').value =
        EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
});
