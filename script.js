// Variables de estado globales
let data = null;                     // Datos cargados desde data.json
let readLectures = new Set();        // IDs de lecturas leídas
let doneFC = new Set();              // Índices de flashcards vistas
let doneQ = new Set();               // Índices de preguntas respondidas correctamente
let curFC = 0;                       // Flashcard actual
let curQ = 0;                        // Pregunta actual

const STORAGE_KEY = 'maritimeEthicsProgress';

// Cargar datos al iniciar
async function loadData() {
    try {
        const response = await fetch('data.json');
        data = await response.json();

        /* --- SECTIONS VISIBILITY CONTROL --- */

        // TO RE-ENABLE LECTURES, UNCOMMENT THE LINE BELOW:
        // await buildAccordion('lecturesAccordion', data.lectures, 'lecture');

        // TO RE-ENABLE RESUMEN (SUMMARY), UNCOMMENT THE LINE BELOW:
        // await loadSummary();

        /* ----------------------------------- */

        initFlashcards();
        initQuiz();
        loadProgress();
        updateProgress();
        setupKeyboardNav();
    } catch (error) {
        console.error('Error cargando data.json:', error);
    }
}

// Construir acordeón (solo lectures)
async function buildAccordion(containerId, items, type) {
    const accordion = document.getElementById(containerId);
    if (!accordion) return; // SAFETY CHECK
    accordion.innerHTML = '';

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemDiv = document.createElement('div');
        itemDiv.className = 'accordion-item shadow-sm mb-3 border-0';

        const header = document.createElement('h2');
        header.className = 'accordion-header';

        const button = document.createElement('button');
        button.className = 'accordion-button collapsed fw-bold';
        button.type = 'button';
        button.setAttribute('data-bs-toggle', 'collapse');
        button.setAttribute('data-bs-target', `#accordion-${type}-${item.id}`);
        button.setAttribute('onclick', `markAsRead('${type}', ${item.id})`);

        const icon = document.createElement('i');
        icon.id = `icon-accordion-${type}-${item.id}`;
        icon.className = 'bi bi-circle read-status-icon status-pending';

        button.appendChild(icon);
        button.appendChild(document.createTextNode(' ' + item.title));

        header.appendChild(button);

        const collapseDiv = document.createElement('div');
        collapseDiv.id = `accordion-${type}-${item.id}`;
        collapseDiv.className = 'accordion-collapse collapse';
        collapseDiv.setAttribute('data-bs-parent', `#${containerId}`);

        const body = document.createElement('div');
        body.className = 'accordion-body';
        body.id = `body-${type}-${item.id}`;
        body.innerHTML = '<p class="text-muted">Cargando contenido...</p>';

        collapseDiv.appendChild(body);
        itemDiv.appendChild(header);
        itemDiv.appendChild(collapseDiv);
        accordion.appendChild(itemDiv);

        try {
            const resp = await fetch(item.file);
            const html = await resp.text();
            body.innerHTML = html;
        } catch (err) {
            body.innerHTML = '<p class="text-danger">Error al cargar el contenido.</p>';
        }
    }
}

// Cargar resumen
async function loadSummary() {
    const summaryContainer = document.getElementById('summary-content');
    if (!summaryContainer) return;

    try {
        const resp = await fetch(data.summaryFile);
        const html = await resp.text();
        summaryContainer.innerHTML = html;
    } catch (err) {
        summaryContainer.innerHTML = '<p class="text-danger">Error al cargar el resumen.</p>';
    }
}

// ---------- FLASHCARDS ----------

function initFlashcards() {
    if (!data || data.flashcards.length === 0) return;
    curFC = 0;
    renderFC();
}

function renderFC() {
    const fc = data.flashcards[curFC];
    document.getElementById('fc-front').textContent = fc.f;
    document.getElementById('fc-back').textContent = fc.b;
    document.getElementById('fc-counter').textContent =
        `${curFC + 1} / ${data.flashcards.length}`;

    doneFC.add(curFC);
    saveProgress();
    updateProgress();

    const container = document.querySelector('.card-flip-container');
    if (container) container.classList.remove('flipped');
}

function changeFC(dir) {
    if (!data) return;
    curFC = (curFC + dir + data.flashcards.length) % data.flashcards.length;
    renderFC();
}

function setupKeyboardNav() {
    window.addEventListener('keydown', (e) => {
        const flashcardsTab = document.getElementById('flashcards');
        if (!flashcardsTab || !flashcardsTab.classList.contains('show')) return;

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            changeFC(-1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            changeFC(1);
        }
    });
}

// ---------- QUIZ ----------

function initQuiz() {
    if (!data || data.quiz.length === 0) return;
    curQ = 0;
    renderQ();
}

function renderQ() {
    const q = data.quiz[curQ];

    document.getElementById('quiz-question').textContent = q.q;
    document.getElementById('quiz-prog').textContent =
        `${curQ + 1} / ${data.quiz.length}`;

    const optCont = document.getElementById('quiz-options');
    optCont.innerHTML = "";

    const expDiv = document.getElementById('quiz-exp');
    expDiv.style.display = 'none';
    expDiv.className = 'explanation-box rounded';

    document.getElementById('btn-next-q').classList.add('d-none');

    q.o.forEach((o, i) => {
        const btn = document.createElement('button');
        btn.className = "quiz-option btn text-start mb-2 d-block w-100";
        btn.textContent = o;
        btn.onclick = () => handleQuizAnswer(i, q.c, q.e, btn);
        optCont.appendChild(btn);
    });

    if (doneQ.has(curQ)) {
        const options = document.querySelectorAll('.quiz-option');
        options.forEach(opt => opt.disabled = true);
        options[q.c].classList.add('correct');
        expDiv.textContent = q.e;
        expDiv.style.display = 'block';
        document.getElementById('btn-next-q').classList.remove('d-none');
    }
}

function handleQuizAnswer(selectedIdx, correctIdx, explanation, btn) {
    const allOptions = document.querySelectorAll('.quiz-option');
    const expDiv = document.getElementById('quiz-exp');
    const nextBtn = document.getElementById('btn-next-q');

    if (doneQ.has(curQ)) return;

    if (selectedIdx === correctIdx) {
        doneQ.add(curQ);
        saveProgress();
        updateProgress();

        allOptions.forEach(opt => opt.disabled = true);
        btn.classList.add('correct');

        expDiv.textContent = explanation;
        expDiv.style.display = 'block';
        nextBtn.classList.remove('d-none');
    } else {
        btn.classList.add('incorrect');
        expDiv.textContent = "❌ Incorrecto.";
        expDiv.classList.add('incorrect');
        expDiv.style.display = 'block';
        nextBtn.classList.add('d-none');
    }
}

function nextQuestion() {
    if (!data) return;
    curQ = (curQ + 1) % data.quiz.length;
    renderQ();
}

// ---------- LECTURES ----------

function markAsRead(type, id) {
    if (type === 'lecture') {
        readLectures.add(id);
        const icon = document.getElementById(`icon-accordion-lecture-${id}`);
        if (icon) {
            icon.classList.replace('bi-circle', 'bi-check-circle-fill');
            icon.classList.replace('status-pending', 'status-completed');
        }
    }

    saveProgress();
    updateProgress();
}

// ---------- PROGRESS ----------

function updateProgress() {
    if (!data) return;

    const total =
        data.lectures.length +
        data.flashcards.length +
        data.quiz.length;

    const current =
        readLectures.size +
        doneFC.size +
        doneQ.size;

    const perc = Math.round((current / total) * 100);

    const progBar = document.getElementById('global-progress');
    if (progBar) progBar.style.width = perc + "%";
    
    const progText = document.getElementById('progress-text');
    if (progText) progText.textContent = `${current} / ${total} hitos completados`;

    const badge = document.getElementById('progressBadge');
    if (badge) {
        badge.textContent = `${current} / ${total}`;
        if (perc === 100) {
            badge.classList.add('bg-success');
        } else {
            badge.classList.remove('bg-success');
        }
    }
}

// ---------- STORAGE ----------

function saveProgress() {
    const progress = {
        readLectures: Array.from(readLectures),
        doneFC: Array.from(doneFC),
        doneQ: Array.from(doneQ)
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function loadProgress() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
        const progress = JSON.parse(saved);
        readLectures = new Set(progress.readLectures || []);
        doneFC = new Set(progress.doneFC || []);
        doneQ = new Set(progress.doneQ || []);

        readLectures.forEach(id => {
            const icon = document.getElementById(`icon-accordion-lecture-${id}`);
            if (icon) {
                icon.classList.replace('bi-circle', 'bi-check-circle-fill');
                icon.classList.replace('status-pending', 'status-completed');
            }
        });

        updateProgress();
    } catch (e) {
        console.warn('Error al cargar progreso guardado', e);
    }
}

// Exponer funciones globales
window.markAsRead = markAsRead;
window.changeFC = changeFC;
window.nextQuestion = nextQuestion;

window.onload = loadData;