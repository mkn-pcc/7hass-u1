let gameData = {
    cases: [],
    dialogue: {},
    sources: {}
};

let gameState = {
    currentScene: 'title',
    currentCase: null,
    viewedSources: [],
    completedCases: [],
    dialogueIndex: 0
};

// --- Initialisation ---
async function init() {
    try {
        const [casesRes, dialRes, sourRes] = await Promise.all([
            fetch('data/cases.json'),
            fetch('data/dialogue.json'),
            fetch('data/sources.json')
        ]);
        gameData.cases = await casesRes.json();
        gameData.dialogue = await dialRes.json();
        gameData.sources = await sourRes.json();
        
        setupEventListeners();
        render();
    } catch (err) {
        console.error("Error loading game data:", err);
    }
}

function setupEventListeners() {
    document.getElementById('start-btn').onclick = () => transitionTo('hub');
    document.getElementById('help-btn').onclick = () => alert("Explore the museum. Click hotspots to find evidence. Complete all cases to win!");
    document.getElementById('next-btn').onclick = handleNextDialogue;
    document.getElementById('close-modal-btn').onclick = closeModal;
    document.getElementById('final-report-btn').onclick = () => transitionTo('final');
}

// --- Scene Management ---
function transitionTo(scene, caseId = null) {
    gameState.currentScene = scene;
    gameState.currentCase = caseId;
    gameState.viewedSources = [];
    gameState.dialogueIndex = 0;
    render();
}

function render() {
    const bg = document.getElementById('bg-layer');
    const hub = document.getElementById('hub-screen');
    const title = document.getElementById('title-screen');
    const hotspots = document.getElementById('hotspot-layer');
    const portrait = document.getElementById('portrait-layer');
    const diag = document.getElementById('dialogue-container');

    // Reset visibility
    [hub, title, hotspots, diag].forEach(el => el.classList.add('hidden'));
    portrait.innerHTML = '';
    hotspots.innerHTML = '';

    if (gameState.currentScene === 'title') {
        title.classList.remove('hidden');
        bg.style.backgroundImage = "url('assets/backgrounds/title_bg.png')";
    } 
    else if (gameState.currentScene === 'hub') {
        hub.classList.remove('hidden');
        bg.style.backgroundImage = "url('assets/backgrounds/hub_bg.png')";
        renderHub();
        showDialogue('curator', gameData.dialogue.intro);
    } 
    else if (gameState.currentScene === 'case') {
        const caseObj = gameData.cases.find(c => c.id === gameState.currentCase);
        bg.style.backgroundImage = `url(${caseObj.background})`;
        renderHotspots(caseObj);
        showDialogue(caseObj.guideId, [`Welcome to the ${caseObj.title} exhibit. Inspect the three marked items to begin.`]);
    }
    else if (gameState.currentScene === 'final') {
        bg.style.backgroundImage = "url('assets/backgrounds/hub_bg.png')";
        showDialogue('curator', gameData.dialogue.outro);
    }
}

// --- Hub Logic ---
function renderHub() {
    const menu = document.getElementById('case-menu');
    menu.innerHTML = '';
    gameData.cases.forEach(c => {
        const isComp = gameState.completedCases.includes(c.id);
        const card = document.createElement('div');
        card.className = `case-card ${isComp ? 'complete' : ''}`;
        card.innerHTML = `
            <h3>${c.title}</h3>
            ${isComp ? `<img src="assets/ui/case_complete_stamp.png" class="complete-stamp">` : '<p>Incomplete</p>'}
        `;
        card.onclick = () => transitionTo('case', c.id);
        menu.appendChild(card);
    });

    document.getElementById('progress-count').innerText = `${gameState.completedCases.length}/3`;
    if (gameState.completedCases.length === 3) {
        document.getElementById('final-report-btn').classList.remove('hidden');
    }
}

// --- Case & Source Logic ---
function renderHotspots(caseObj) {
    const layer = document.getElementById('hotspot-layer');
    layer.classList.remove('hidden');
    caseObj.hotspots.forEach(hs => {
        const btn = document.createElement('div');
        btn.className = 'hotspot';
        btn.style.left = hs.x + '%';
        btn.style.top = hs.y + '%';
        btn.onclick = () => openSource(hs.sourceId);
        layer.appendChild(btn);
    });
}

function openSource(sourceId) {
    const source = gameData.sources[sourceId];
    document.getElementById('source-title').innerText = source.title;
    document.getElementById('source-type').innerText = source.type;
    document.getElementById('source-description').innerText = source.caption;
    document.getElementById('source-prompt').innerText = "Analysis Prompt: " + source.prompt;
    
    const imgCont = document.getElementById('source-image-container');
    imgCont.innerHTML = source.image ? `<img src="${source.image}">` : '';
    
    document.getElementById('source-modal').classList.remove('hidden');

    if (!gameState.viewedSources.includes(sourceId)) {
        gameState.viewedSources.push(sourceId);
    }
}

function closeModal() {
    document.getElementById('source-modal').classList.add('hidden');
    checkCaseCompletion();
}

function checkCaseCompletion() {
    const currentCaseObj = gameData.cases.find(c => c.id === gameState.currentCase);
    if (gameState.viewedSources.length === 3 && !gameState.completedCases.includes(gameState.currentCase)) {
        showDialogue(currentCaseObj.guideId, ["You've seen all the evidence! One final question to close the file..."], true);
    }
}

// --- Dialogue Logic ---
function showDialogue(speakerKey, lines, isQuiz = false) {
    const container = document.getElementById('dialogue-container');
    container.classList.remove('hidden');
    document.getElementById('nameplate').innerText = speakerKey.toUpperCase();
    
    // Set Portrait
    const portLayer = document.getElementById('portrait-layer');
    const portImg = speakerKey === 'curator' ? 'assets/portraits/curator.png' : 
                   gameData.cases.find(c => c.guideId === speakerKey).portrait;
    portLayer.innerHTML = `<img src="${portImg}">`;

    gameState.currentDialogueLines = lines;
    gameState.dialogueIndex = 0;
    gameState.isQuizTrigger = isQuiz;
    updateDialogueText();
}

function updateDialogueText() {
    document.getElementById('dialogue-text').innerText = gameState.currentDialogueLines[gameState.dialogueIndex];
    const nextBtn = document.getElementById('next-btn');
    nextBtn.classList.remove('hidden');
    document.getElementById('dialogue-choices').innerHTML = '';
}

function handleNextDialogue() {
    if (gameState.dialogueIndex < gameState.currentDialogueLines.length - 1) {
        gameState.dialogueIndex++;
        updateDialogueText();
    } else {
        if (gameState.isQuizTrigger) {
            renderQuiz();
        } else {
            // End dialogue
            if (gameState.currentScene === 'final') {
                location.reload(); // Restart
            }
        }
    }
}

function renderQuiz() {
    const caseObj = gameData.cases.find(c => c.id === gameState.currentCase);
    const textEl = document.getElementById('dialogue-text');
    const choiceEl = document.getElementById('dialogue-choices');
    document.getElementById('next-btn').classList.add('hidden');

    textEl.innerText = caseObj.quiz.question;
    caseObj.quiz.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.innerText = opt;
        btn.className = 'quiz-option'; // Add styling in CSS if desired
        btn.onclick = () => {
            if (String.fromCharCode(65 + idx) === caseObj.quiz.answer) {
                gameState.completedCases.push(gameState.currentCase);
                alert("Correct! Case File Updated.");
                transitionTo('hub');
            } else {
                alert("Not quite. Review the evidence and try again.");
            }
        };
        choiceEl.appendChild(btn);
    });
}

init();
