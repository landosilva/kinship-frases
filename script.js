// Google Sheets Configuration
const SPREADSHEET_ID = '1ajnPZy6u6nw-g5GE5ZbortN53JZ9SBkl9RYB9TxMFqs';
const SHEET_NAME = 'Phrases'; // Nome da aba

// Google Apps Script Web App URL
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxHCyT1KijjXsSDrU3cv8FksKNdsJH1lTpP2OZI5sjMfP5xK9yoryexW7aSrdev1eL1/exec';

// CSV export URL for reading - vamos usar a aba "Frases"
const CSV_URL_GID_0 = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=0`;
const CSV_URL_GID_98642087 = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=98642087`;
const CSV_URL_NO_GID = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv`;

// DOM Elements
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const phraseContainer = document.getElementById('phraseContainer');
const phraseText = document.getElementById('phraseText');
const starsContainer = document.getElementById('starsContainer');
const endMessage = document.getElementById('endMessage');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

let phrases = []; // Array de objetos: {text: string, rating: number, index: number}
let userVotes = []; // Array de votos do usuário atual: [0-5 ou null]
let userId = null; // ID único do usuário
let currentPhraseIndex = -1; // Índice da frase atual sendo exibida

// Initialize user ID and votes from localStorage
function initUserData() {
    userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', userId);
    }
    
    const savedVotes = localStorage.getItem('userVotes');
    if (savedVotes) {
        userVotes = JSON.parse(savedVotes);
    } else {
        userVotes = [];
    }
    
    console.log('User ID:', userId);
    console.log('User votes:', userVotes);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Verify all elements exist
    if (!phraseContainer || !phraseText || !starsContainer || !progressFill || !progressText) {
        console.error('Some DOM elements are missing');
        if (error) {
            error.textContent = 'Erro ao inicializar a página. Recarregue a página.';
            error.style.display = 'block';
        }
        return;
    }
    
    // Initialize progress bar
    updateProgress();
    
    // Initialize user data
    initUserData();
    
    // Load data on page load
    loadData();
});

// Load data from Google Sheets
async function loadData() {
    showLoading(true);
    hideError();
    
    // Try multiple URLs in order of preference
    const urls = [
        CSV_URL_GID_0,
        CSV_URL_GID_98642087,
        CSV_URL_NO_GID
    ];
    
    let csvText = null;
    let lastError = null;
    
    for (let i = 0; i < urls.length; i++) {
        try {
            console.log(`Tentativa ${i + 1}: Carregando de`, urls[i]);
            const response = await fetch(urls[i]);
            
            if (!response.ok) {
                console.warn(`URL ${i + 1} falhou: HTTP ${response.status}`);
                continue;
            }
            
            csvText = await response.text();
            console.log('CSV recebido, tamanho:', csvText.length);
            console.log('Primeiras 200 caracteres:', csvText.substring(0, 200));
            
            if (csvText && csvText.trim() !== '') {
                break; // Success, exit loop
            }
        } catch (err) {
            console.warn(`Erro ao tentar URL ${i + 1}:`, err);
            lastError = err;
            continue;
        }
    }
    
    if (!csvText || csvText.trim() === '') {
        showEmptyState(true);
        showTable(false);
        showError('Não foi possível acessar a planilha. Verifique se ela está publicada como "Qualquer pessoa com o link pode visualizar".');
        console.error('Todas as URLs falharam. Último erro:', lastError);
        showLoading(false);
        return;
    }
    
    try {
        const rows = parseCSV(csvText);
        console.log('Linhas parseadas:', rows.length);
        
        if (rows.length === 0) {
            showEmptyState(true);
            showTable(false);
            showError('A planilha não contém dados.');
            showLoading(false);
            return;
        }
        
        // Primeira linha pode ser cabeçalho - pular se for "Phrases" ou "Rating"
        let startIndex = 0;
        if (rows.length > 0 && rows[0].length > 0) {
            const firstCell = rows[0][0].toLowerCase().trim();
            if (firstCell === 'phrases' || firstCell === 'frases' || firstCell === 'rating') {
                startIndex = 1; // Pular cabeçalho
            }
        }
        
        // Extrair frases da coluna A e ratings da coluna B
        phrases = rows
            .slice(startIndex) // Pula cabeçalho se houver
            .map((row, idx) => ({
                text: row[0] || '',
                rating: parseInt(row[1]) || 0,
                index: idx
            }))
            .filter(phrase => phrase.text && phrase.text.trim() !== ''); // Remove linhas vazias
        
        // Expandir userVotes se necessário (se novas frases foram adicionadas)
        while (userVotes.length < phrases.length) {
            userVotes.push(null); // null significa que ainda não votou
        }
        
        console.log('Frases encontradas:', phrases.length);
        console.log('User votes:', userVotes);
        
        if (phrases.length === 0) {
            showEndMessage();
            showLoading(false);
            return;
        }
        
        // Update progress
        updateProgress();
        
        // Show next unvoted phrase
        showNextPhrase();
    } catch (err) {
        console.error('Erro ao processar CSV:', err);
        showError('Erro ao processar os dados: ' + err.message);
    } finally {
        showLoading(false);
    }
}

// Parse CSV text into array of arrays
function parseCSV(text) {
    const rows = [];
    const lines = text.split('\n');
    
    for (let line of lines) {
        if (line.trim() === '') continue;
        
        const row = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                row.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        row.push(current.trim());
        rows.push(row);
    }
    
    return rows;
}

// Show next unvoted phrase (used on initial load)
function showNextPhrase() {
    // Find phrases that haven't been voted yet
    const unvotedPhrases = phrases
        .map((phrase, index) => ({ phrase, index }))
        .filter(({ index }) => userVotes[index] === null || userVotes[index] === undefined);
    
    if (unvotedPhrases.length === 0) {
        // All phrases have been voted
        showEndMessage();
        return;
    }
    
    // Pick a random unvoted phrase
    const randomIndex = Math.floor(Math.random() * unvotedPhrases.length);
    const selected = unvotedPhrases[randomIndex];
    
    displayPhrase(selected);
}

// Show/hide loading indicator for phrase transition
function showPhraseLoading(show) {
    let loadingOverlay = document.getElementById('phraseLoadingOverlay');
    
    if (show && !loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'phraseLoadingOverlay';
        loadingOverlay.className = 'phrase-loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-spinner-small"></div>
            <p>Carregando próxima frase...</p>
        `;
        phraseContainer.appendChild(loadingOverlay);
    } else if (!show && loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            if (loadingOverlay.parentNode) {
                loadingOverlay.parentNode.removeChild(loadingOverlay);
            }
        }, 300);
    }
}

// Render star rating (0-5)
function renderStars() {
    starsContainer.innerHTML = '';
    
    const hasVoted = userVotes[currentPhraseIndex] !== null && userVotes[currentPhraseIndex] !== undefined;
    const currentRating = hasVoted ? userVotes[currentPhraseIndex] : 0;
    
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.className = 'star';
        // Always show filled stars for the selected rating
        star.textContent = i <= currentRating ? '⭐️' : '☆';
        star.dataset.rating = i;
        
        // If voted, disable interactions; otherwise enable
        if (hasVoted) {
            star.style.cursor = 'default';
            star.style.pointerEvents = 'none';
            star.style.opacity = i <= currentRating ? '1' : '0.3';
        } else {
            star.style.cursor = 'pointer';
            star.style.pointerEvents = 'auto';
            star.style.opacity = '1';
            
            star.addEventListener('click', () => vote(currentPhraseIndex, i));
            star.addEventListener('mouseenter', () => {
                // On hover, show preview of that rating
                const stars = starsContainer.querySelectorAll('.star');
                stars.forEach((s, idx) => {
                    const starNum = idx + 1;
                    s.textContent = starNum <= i ? '⭐️' : '☆';
                    s.style.opacity = starNum <= i ? '1' : '0.3';
                });
            });
        }
        
        starsContainer.appendChild(star);
    }
    
    // Reset hover when mouse leaves (only if not voted)
    if (!hasVoted) {
        const handleMouseLeave = () => {
            const stars = starsContainer.querySelectorAll('.star');
            stars.forEach((star, index) => {
                const starNumber = index + 1;
                star.textContent = starNumber <= currentRating ? '⭐️' : '☆';
                star.style.opacity = starNumber <= currentRating ? '1' : '0.3';
            });
        };
        starsContainer.removeEventListener('mouseleave', handleMouseLeave);
        starsContainer.addEventListener('mouseleave', handleMouseLeave);
    }
}

// Highlight stars on hover (or show current rating)
function highlightStars(rating) {
    const stars = starsContainer.querySelectorAll('.star');
    stars.forEach((star, index) => {
        const starNumber = index + 1;
        star.textContent = starNumber <= rating ? '⭐️' : '☆';
    });
}

// Vote function (0-5 stars)
async function vote(phraseIndex, rating) {
    // Check if already voted
    if (userVotes[phraseIndex] !== null && userVotes[phraseIndex] !== undefined) {
        return; // Already voted, ignore
    }
    
    // Disable all interactions immediately
    disableInteractions(true);
    
    // Update local cache immediately
    userVotes[phraseIndex] = rating;
    localStorage.setItem('userVotes', JSON.stringify(userVotes));
    
    // Update stars display to show selected rating (keep them filled and disable)
    renderStars();
    
    // Start loading next phrase in background IMMEDIATELY
    const nextPhrasePromise = prepareNextPhrase();
    
    // Add flashy effects
    addVoteEffects(rating);
    
    // Update progress immediately
    updateProgress();
    
    // Send vote to server (fire and forget - don't wait for response)
    submitVote(phraseIndex, rating).then(() => {
        console.log('Vote submitted successfully');
    }).catch((err) => {
        console.error('Error submitting vote:', err);
        showError('Aviso: Voto pode não ter sido salvo. Verifique sua conexão.');
    });
    
    // Wait for animation to complete, then show next phrase
    setTimeout(async () => {
        showPhraseLoading(true);
        
        // Wait for next phrase to be ready
        const nextPhrase = await nextPhrasePromise;
        
        setTimeout(() => {
            // Show the prepared phrase
            displayPhrase(nextPhrase);
            showPhraseLoading(false);
            disableInteractions(false);
        }, 300);
    }, 1000); // Wait for animation
}

// Disable/enable user interactions
function disableInteractions(disable) {
    const stars = starsContainer.querySelectorAll('.star');
    stars.forEach(star => {
        star.style.pointerEvents = disable ? 'none' : 'auto';
        star.style.cursor = disable ? 'default' : 'pointer';
    });
    
    phraseContainer.style.pointerEvents = disable ? 'none' : 'auto';
}

// Prepare next phrase in background (returns promise)
async function prepareNextPhrase() {
    return new Promise((resolve) => {
        // Find phrases that haven't been voted yet
        const unvotedPhrases = phrases
            .map((phrase, index) => ({ phrase, index }))
            .filter(({ index }) => userVotes[index] === null || userVotes[index] === undefined);
        
        if (unvotedPhrases.length === 0) {
            resolve(null); // No more phrases
            return;
        }
        
        // Pick a random unvoted phrase
        const randomIndex = Math.floor(Math.random() * unvotedPhrases.length);
        const selected = unvotedPhrases[randomIndex];
        
        resolve(selected);
    });
}

// Display a prepared phrase
function displayPhrase(selected) {
    if (!selected) {
        showEndMessage();
        return;
    }
    
    currentPhraseIndex = selected.index;
    phraseText.innerHTML = `"${selected.phrase.text}"`;
    renderStars();
    phraseContainer.style.display = 'flex';
    endMessage.style.display = 'none';
}

// Add flashy effects after voting
function addVoteEffects(rating) {
    // Add animation to phrase container
    phraseContainer.style.animation = 'none';
    setTimeout(() => {
        phraseContainer.style.animation = 'voteFlash 0.6s ease-out';
    }, 10);
    
    // Add sparkle effect to stars
    const stars = starsContainer.querySelectorAll('.star');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.style.animation = 'starPop 0.5s ease-out';
            star.style.animationDelay = (index * 0.1) + 's';
        }
    });
    
    // Show success message temporarily
    const successMsg = document.createElement('div');
    successMsg.className = 'vote-success';
    successMsg.textContent = '✓ Voto registrado!';
    phraseContainer.appendChild(successMsg);
    
    setTimeout(() => {
        successMsg.style.opacity = '0';
        setTimeout(() => {
            if (successMsg.parentNode) {
                successMsg.parentNode.removeChild(successMsg);
            }
        }, 300);
    }, 1500);
}

// Submit vote to server (rating 0-5)
async function submitVote(phraseIndex, rating) {
    return new Promise((resolve, reject) => {
        // Always send ALL votes for this user
        // Make sure the array has the right length
        const allVotes = [...userVotes];
        while (allVotes.length < phrases.length) {
            allVotes.push(null);
        }
        // Update the current vote in the array
        allVotes[phraseIndex] = rating;
        
        const voteData = {
            action: 'vote',
            userId: userId,
            phraseIndex: phraseIndex,
            rating: rating, // 0-5 stars - the current vote
            votes: allVotes.map(v => v === null || v === undefined ? '' : v.toString()).join(',') // ALL votes as comma-separated string
        };
        
        console.log('Submitting vote:', voteData);
        console.log('All votes being sent:', voteData.votes);
        
        submitViaHiddenFormVote(voteData, resolve, reject);
    });
}

// Update progress bar
function updateProgress() {
    if (phrases.length === 0) {
        progressFill.style.width = '0%';
        progressText.textContent = '0 / 0';
        return;
    }
    
    const votedCount = userVotes.filter(v => v !== null && v !== undefined).length;
    const totalCount = phrases.length;
    const percentage = (votedCount / totalCount) * 100;
    
    progressFill.style.width = percentage + '%';
    progressText.textContent = `${votedCount} / ${totalCount}`;
}

// Show end message
function showEndMessage() {
    phraseContainer.style.display = 'none';
    endMessage.style.display = 'block';
    updateProgress(); // Update progress to show 100%
}


// Submit vote via hidden iframe - optimized for Google Apps Script
function submitViaHiddenFormVote(voteData, resolve, reject) {
    console.log('Preparing to submit vote:', voteData);
    console.log('Web App URL:', WEB_APP_URL);
    
    // Check if URL is configured
    if (!WEB_APP_URL || WEB_APP_URL.includes('YOUR_GOOGLE_APPS_SCRIPT_URL')) {
        reject(new Error('Web App URL não configurada. Configure no script.js'));
        return;
    }
    
    // Create form that submits to Google Apps Script
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = WEB_APP_URL;
    form.style.display = 'none';
    form.enctype = 'application/x-www-form-urlencoded';
    form.acceptCharset = 'UTF-8';
    
    // Create hidden iframe to receive response (avoids page navigation)
    const iframe = document.createElement('iframe');
    const iframeName = 'voteFrame_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    iframe.name = iframeName;
    iframe.id = iframeName;
    iframe.style.display = 'none';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = 'none';
    iframe.style.position = 'absolute';
    iframe.style.top = '-1000px';
    iframe.style.left = '-1000px';
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms');
    
    form.target = iframeName;
    
    const payload = JSON.stringify(voteData);
    const dataInput = document.createElement('input');
    dataInput.type = 'hidden';
    dataInput.name = 'postData';
    dataInput.value = payload;
    
    form.appendChild(dataInput);
    document.body.appendChild(iframe);
    document.body.appendChild(form);
    
    console.log('Submitting vote via form POST to:', WEB_APP_URL);
    
    // Monitor iframe load (response received)
    let isComplete = false;
    const completeTimeout = setTimeout(() => {
        if (!isComplete) {
            isComplete = true;
            console.log('Vote submission timeout - assuming success (may be 403 but continuing)');
            cleanup();
            resolve(); // Assume success to not block UX
        }
    }, 2000);
    
    // Try to detect when iframe loads
    iframe.onload = () => {
        if (!isComplete) {
            isComplete = true;
            clearTimeout(completeTimeout);
            console.log('Iframe loaded - vote may have been submitted');
            cleanup();
            resolve();
        }
    };
    
    function cleanup() {
        setTimeout(() => {
            try {
                if (form.parentNode) {
                    form.parentNode.removeChild(form);
                }
                if (iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }
            } catch (e) {
                console.warn('Cleanup error:', e);
            }
        }, 500);
    }
    
    // Submit the form
    try {
        form.submit();
        console.log('Form submitted successfully');
    } catch (err) {
        if (!isComplete) {
            isComplete = true;
            clearTimeout(completeTimeout);
            console.error('Error submitting form:', err);
            cleanup();
            reject(err);
        }
    }
}

// UI Helper functions
function showLoading(show) {
    loading.style.display = show ? 'block' : 'none';
}

function showError(message) {
    error.textContent = message;
    error.style.display = 'block';
}

function hideError() {
    error.style.display = 'none';
}


