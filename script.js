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

// Show next unvoted phrase
function showNextPhrase() {
    // Show loading indicator while transitioning
    showPhraseLoading(true);
    
    setTimeout(() => {
        // Find phrases that haven't been voted yet
        const unvotedPhrases = phrases
            .map((phrase, index) => ({ phrase, index }))
            .filter(({ index }) => userVotes[index] === null || userVotes[index] === undefined);
        
        if (unvotedPhrases.length === 0) {
            // All phrases have been voted
            showEndMessage();
            showPhraseLoading(false);
            return;
        }
        
        // Pick a random unvoted phrase
        const randomIndex = Math.floor(Math.random() * unvotedPhrases.length);
        const selected = unvotedPhrases[randomIndex];
        currentPhraseIndex = selected.index;
        
        // Display phrase with quotes and italic style
        phraseText.innerHTML = `"${selected.phrase.text}"`;
        
        // Render stars
        renderStars();
        
        // Show container
        phraseContainer.style.display = 'flex';
        endMessage.style.display = 'none';
        
        // Hide loading after phrase is shown
        setTimeout(() => {
            showPhraseLoading(false);
        }, 300);
    }, 200);
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
        star.style.cursor = hasVoted ? 'default' : 'pointer';
        star.style.opacity = i <= currentRating ? '1' : '0.3';
        
        if (!hasVoted) {
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
    
    // Update local cache immediately
    userVotes[phraseIndex] = rating;
    localStorage.setItem('userVotes', JSON.stringify(userVotes));
    
    // Update stars display to show selected rating
    renderStars();
    
    // Add flashy effects
    addVoteEffects(rating);
    
    // Update progress immediately
    updateProgress();
    
    // Send vote to server (fire and forget - don't wait for response)
    submitVote(phraseIndex, rating).then(() => {
        console.log('Vote submitted successfully');
    }).catch((err) => {
        console.error('Error submitting vote:', err);
        // Don't revert - keep the vote locally even if server fails
        // The user experience is better this way
        showError('Aviso: Voto pode não ter sido salvo. Verifique sua conexão.');
    });
    
    // Move to next phrase after a delay (show loading during transition)
    setTimeout(() => {
        showPhraseLoading(true);
        setTimeout(() => {
            showNextPhrase();
        }, 300);
    }, 800);
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
        // Create vote data - ensure userVotes array is properly updated
        const updatedVotes = [...userVotes];
        // Make sure the array has the right length
        while (updatedVotes.length < phrases.length) {
            updatedVotes.push(null);
        }
        updatedVotes[phraseIndex] = rating;
        
        const voteData = {
            action: 'vote',
            userId: userId,
            phraseIndex: phraseIndex,
            rating: rating, // 0-5 stars
            votes: updatedVotes.map(v => v === null || v === undefined ? '' : v.toString()).join(',')
        };
        
        console.log('Submitting vote:', voteData);
        
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


// Submit vote via hidden iframe
function submitViaHiddenFormVote(voteData, resolve, reject) {
    console.log('Preparing to submit vote:', voteData);
    console.log('Web App URL:', WEB_APP_URL);
    
    // Check if URL is configured
    if (!WEB_APP_URL || WEB_APP_URL.includes('YOUR_GOOGLE_APPS_SCRIPT_URL')) {
        reject(new Error('Web App URL não configurada. Configure no script.js'));
        return;
    }
    
    // Create a hidden iframe with unique name
    const iframe = document.createElement('iframe');
    const iframeName = 'hiddenFrame_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    iframe.name = iframeName;
    iframe.style.display = 'none';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    
    document.body.appendChild(iframe);
    
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = WEB_APP_URL;
    form.target = iframeName;
    form.style.display = 'none';
    form.enctype = 'application/x-www-form-urlencoded';
    
    // Send as postData parameter (form field)
    const payload = JSON.stringify(voteData);
    console.log('Payload to send:', payload);
    
    const dataInput = document.createElement('input');
    dataInput.type = 'hidden';
    dataInput.name = 'postData';
    dataInput.value = payload;
    
    form.appendChild(dataInput);
    document.body.appendChild(form);
    
    // Monitor iframe for completion
    let resolved = false;
    const timeout = setTimeout(() => {
        if (!resolved) {
            resolved = true;
            console.log('Vote submission timeout, assuming success');
            cleanup();
            resolve();
        }
    }, 3000);
    
    iframe.onload = () => {
        if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            console.log('Iframe loaded, vote submitted');
            cleanup();
            resolve();
        }
    };
    
    iframe.onerror = () => {
        if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            console.warn('Iframe error, but vote may still be submitted');
            cleanup();
            resolve(); // Assume success even on error
        }
    };
    
    function cleanup() {
        setTimeout(() => {
            try {
                if (document.body.contains(form)) {
                    document.body.removeChild(form);
                }
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            } catch (e) {
                console.warn('Cleanup error:', e);
            }
        }, 1000);
    }
    
    // Submit the form
    console.log('Submitting form to:', WEB_APP_URL);
    try {
        form.submit();
        console.log('Form submitted successfully');
    } catch (err) {
        if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
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


