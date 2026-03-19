// Game State
let state = {
    currentScene: 'title',
    completedCases: [],
    activeCase: null,
    viewedSources: [], // Tracks source IDs viewed in current case
    dialogueIndex: 0,
    currentDialogueSet: null,
    data: {
        cases: null,
        dialogue: null,
        sources: null
    }
};

// DOM Elements
const el = {
    bg: document.getElementById('scene-bg'),
    title: document.getElementById('title-screen'),
    dialogue: document.getElementById('dialogue-container'),
    npcName: document.getElementById('npc-name'),
    npcPortrait: document.getElementById('npc-portrait'),
    text: document.getElementById('dialogue-text'),
    btnNext: document.getElementById('btn-next'),
    hotspots: document.getElementById('hotspot-layer'),
    progress: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    sourceModal: document.getElementById('source-modal'),
    quizModal: document.getElementById('quiz-modal'),
    finalScreen: document.getElementById('final-screen')
};

// Initialize Game
async function init() {
    try {
        const [casesRes, dialogueRes, sourcesRes] = await Promise.all([
            fetch('data/cases.json'),
            fetch('data/dialogue.json'),
            fetch('data/sources.json')
        ]);
        state.data.cases = await casesRes.json();
        state.data.dialogue = await dialogueRes.json();
        state.data.sources = await sourcesRes.json();
        
        setupEventListeners();
        showTitle();
    } catch (err) {
        console.error("Data loading failed:", err);
    }
}

function setupEventListeners() {
    document.getElementById('btn-start').onclick = startToHub;
    document.getElementById('btn-help').onclick = () => alert("Click objects in the museum to investigate sources. Complete all cases to finish your report.");
    el.btnNext.onclick = advanceDialogue;
    document.getElementById('btn-close-source').onclick = closeSource;
    document.getElementById('btn-replay').onclick = () => location.reload();
}

// Scene Transitions
function showTitle() {
    el.bg.style.backgroundImage = `url('assets/backgrounds/title_bg.png')`;
}

function startToHub() {
    state.currentScene = 'hub';
    state.activeCase = null;
    el.title.classList.add('hidden');
    el.progress.classList.remove('hidden');
    renderHub();
}

function renderHub() {
    el.bg.style.backgroundImage = `url('assets/backgrounds/hub_bg.png')`;
    el.hotspots.innerHTML = '';
    el.hotspots.classList.remove('hidden');
    el.dialogue.classList.remove('hidden');
    
    // NPC Hub Welcome
    setDialogue('curator', state.completedCases.length === 0 ? 'hub_intro' : 'hub_return');

    // Create Case Hotspots
    state.data.cases.forEach((c, idx) => {
        const btn = document.createElement('div');
        btn.className = 'hotspot';
        btn.style.left = `${25 + (idx * 25)}%`;
        btn.style.top = `50%`;
        
        if (state.completedCases.includes(c.id)) {
            btn.style.filter = 'grayscale(1) brightness(0.5)';
            const stamp = document.createElement('img');
            stamp.src = 'assets/ui/case_complete_stamp.png';
            stamp.style.width = '40px';
            btn.appendChild(stamp);
        } else {
            btn.onclick = () => enterCase(c);
        }
        el.hotspots.appendChild(btn);
    });

    // Check for Game Completion
    if (state.completedCases.length === 3) {
        const finalBtn = document.createElement('button');
        finalBtn.className = 'img-btn';
        finalBtn.innerHTML = `<img src="assets/ui/text_continue.png">`;
        finalBtn.style.position = 'absolute';
        finalBtn.style.bottom = '100px';
        finalBtn.style.left = '50%';
        finalBtn.onclick = () => el.finalScreen.classList.remove('hidden');
        el.hotspots.appendChild(finalBtn);
    }
}

function enterCase(caseData) {
    state.currentScene = 'case';
    state.activeCase = caseData;
    state.viewedSources = [];
    
    el.bg.style.backgroundImage = `url('${caseData.background}')`;
    el.hotspots.innerHTML = '';
    
    // Set NPC
    setDialogue(caseData.guideId, 'intro', caseData.id);

    // Create Source Hotspots
    caseData.hotspots.forEach(hs => {
        const h = document.createElement('div');
        h.className = 'hotspot';
        h.style.left = hs.x;
        h.style.top = hs.y;
        h.onclick = () => openSource(hs.sourceId);
        el.hotspots.appendChild(h);
    });
}

// Dialogue Logic
function setDialogue(npcId, setKey, caseId = null) {
    const set = caseId ? state.data.dialogue.cases[caseId][setKey] : state.data.dialogue[setKey];
    state.currentDialogueSet = set;
    state.dialogueIndex = 0;
    
    el.npcName.innerText = npcId.toUpperCase().replace('_', ' ');
    el.npcPortrait.src = `assets/portraits/${npcId}.png`;
    
    updateDialogueBox();
}

function updateDialogueBox() {
    el.text.innerText = state.currentDialogueSet[state.dialogueIndex];
    if (state.dialogueIndex < state.currentDialogueSet.length - 1) {
        el.btnNext.classList.remove('hidden');
    } else {
        el.btnNext.classList.add('hidden');
    }
}

function advanceDialogue() {
    state.dialogueIndex++;
    updateDialogueBox();
}

// Source Modal Logic
function openSource(sourceId) {
    const source = state.data.sources.find(s => s.id === sourceId);
    if (!source) return;

    document.getElementById('source-title').innerText = source.title;
    document.getElementById('source-type').innerText = `Type: ${source.type} | Origin: ${source.sourceLabel}`;
    
    const imgCont = document.getElementById('source-image-container');
    imgCont.innerHTML = source.image ? `<img src="${source.image}">` : '';
    
    document.getElementById('source-description').innerText = source.caption;
    document.getElementById('source-prompt').innerText = source.prompt;
    
    el.sourceModal.classList.remove('hidden');

    if (!state.viewedSources.includes(sourceId)) {
        state.viewedSources.push(sourceId);
    }
}

function closeSource() {
    el.sourceModal.classList.add('hidden');
    // If all sources viewed, trigger quiz
    if (state.viewedSources.length === 3) {
        showQuiz();
    }
}

// Quiz Logic
function showQuiz() {
    const caseData = state.activeCase;
    const quiz = caseData.completionQuestion;
    
    document.getElementById('quiz-question').innerText = quiz.question;
    const optionsCont = document.getElementById('quiz-options');
    optionsCont.innerHTML = '';
    
    quiz.options.forEach(opt => {
        const b = document.createElement('button');
        b.className = 'quiz-btn';
        b.innerText = opt;
        b.onclick = () => handleQuizAnswer(opt, quiz.correct);
        optionsCont.appendChild(b);
    });
    
    el.quizModal.classList.remove('hidden');
}

function handleQuizAnswer(selected, correct) {
    if (selected === correct) {
        alert("Correct! You have completed this case file.");
        state.completedCases.push(state.activeCase.id);
        el.quizModal.classList.add('hidden');
        el.progressText.innerText = `Cases Complete: ${state.completedCases.length}/3`;
        renderHub();
    } else {
        alert("Not quite. Review the sources and try again.");
    }
}

init();
