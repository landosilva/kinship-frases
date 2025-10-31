// Google Sheets Configuration
const SPREADSHEET_ID = '1ajnPZy6u6nw-g5GE5ZbortN53JZ9SBkl9RYB9TxMFqs';
const SHEET_NAME = 'Frases'; // Nome da aba

// Google Apps Script Web App URL
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyvTOavkRUQaoVaRd9WKm01PPmeOhwQL9qKP4mdc0Vc-uCjyxgLNzC9bpW9yhWT7R1g/exec';

// CSV export URL for reading - vamos usar a aba "Frases"
// GID 0 é para a primeira aba, que parece ser "Frases" baseado na URL
// Tentaremos múltiplos formatos de URL caso um não funcione
const CSV_URL_GID_0 = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=0`;
const CSV_URL_GID_98642087 = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=98642087`;
const CSV_URL_NO_GID = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv`;

// DOM Elements
const refreshBtn = document.getElementById('refreshBtn');
const addBtn = document.getElementById('addBtn');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const dataTable = document.getElementById('dataTable');
const headerRow = document.getElementById('headerRow');
const dataBody = document.getElementById('dataBody');
const emptyState = document.getElementById('emptyState');
const modal = document.getElementById('modal');
const formModal = document.getElementById('formModal');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const modalTitle = document.getElementById('modalTitle');
const formFields = document.getElementById('formFields');

let phrases = []; // Array de objetos: {text: string, rating: number, index: number}
let userVotes = []; // Array de votos do usuário atual: [-1, 0, 1, ...]
let userId = null; // ID único do usuário

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
    if (!refreshBtn || !addBtn || !modal || !formModal) {
        console.error('Some DOM elements are missing');
        if (error) {
            error.textContent = 'Erro ao inicializar a página. Recarregue a página.';
            error.style.display = 'block';
        }
        return;
    }
    
    // Event Listeners
    refreshBtn.addEventListener('click', loadData);
    addBtn.addEventListener('click', () => {
        openModal('add');
    });
    closeModal.addEventListener('click', closeModalHandler);
    cancelBtn.addEventListener('click', closeModalHandler);
    formModal.addEventListener('submit', handleSubmit);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModalHandler();
        }
    });
    
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
        
        // Primeira linha pode ser cabeçalho - pular se for "Frases" ou "Rating"
        let startIndex = 0;
        if (rows.length > 0 && rows[0].length > 0) {
            const firstCell = rows[0][0].toLowerCase().trim();
            if (firstCell === 'frases' || firstCell === 'rating') {
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
        console.log('Primeiras 3 frases:', phrases.slice(0, 3));
        
        if (phrases.length === 0) {
            showEmptyState(true);
            showTable(false);
            showError('Nenhuma frase encontrada na coluna A.');
            showLoading(false);
            return;
        }
        
        renderPhrases();
        showEmptyState(false);
        showTable(true);
    } catch (err) {
        console.error('Erro ao processar CSV:', err);
        showError('Erro ao processar os dados: ' + err.message);
        showEmptyState(true);
        showTable(false);
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

// Render phrases list
function renderPhrases() {
    // Clear existing content
    headerRow.innerHTML = '';
    dataBody.innerHTML = '';
    
    // Render headers
    const th1 = document.createElement('th');
    th1.textContent = 'Frase';
    headerRow.appendChild(th1);
    
    const th2 = document.createElement('th');
    th2.textContent = 'Avaliação';
    th2.style.width = '120px';
    headerRow.appendChild(th2);
    
    const th3 = document.createElement('th');
    th3.textContent = 'Votar';
    th3.style.width = '180px';
    headerRow.appendChild(th3);
    
    // Shuffle phrases for random order
    const shuffledPhrases = [...phrases].sort(() => Math.random() - 0.5);
    
    // Render phrases
    shuffledPhrases.forEach((phraseObj, displayIndex) => {
        const tr = document.createElement('tr');
        tr.dataset.phraseIndex = phraseObj.index;
        
        // Phrase text
        const tdPhrase = document.createElement('td');
        tdPhrase.textContent = phraseObj.text;
        tdPhrase.style.wordBreak = 'break-word';
        tr.appendChild(tdPhrase);
        
        // Rating
        const tdRating = document.createElement('td');
        tdRating.style.textAlign = 'center';
        tdRating.style.fontWeight = 'bold';
        const ratingSpan = document.createElement('span');
        ratingSpan.className = 'rating-badge';
        ratingSpan.textContent = phraseObj.rating > 0 ? `+${phraseObj.rating}` : phraseObj.rating.toString();
        ratingSpan.style.color = phraseObj.rating > 0 ? '#10b981' : phraseObj.rating < 0 ? '#ef4444' : '#6b7280';
        tdRating.appendChild(ratingSpan);
        tr.appendChild(tdRating);
        
        // Vote buttons
        const tdVote = document.createElement('td');
        tdVote.style.textAlign = 'center';
        
        const voteContainer = document.createElement('div');
        voteContainer.className = 'vote-buttons';
        voteContainer.style.display = 'flex';
        voteContainer.style.gap = '0.5rem';
        voteContainer.style.justifyContent = 'center';
        
        // Check if user already voted
        const hasVoted = userVotes[phraseObj.index] !== null && userVotes[phraseObj.index] !== undefined;
        
        // Negative button
        const btnNeg = document.createElement('button');
        btnNeg.className = 'btn-vote btn-vote-negative';
        btnNeg.textContent = '−';
        btnNeg.title = 'Voto negativo';
        btnNeg.disabled = hasVoted;
        if (hasVoted && userVotes[phraseObj.index] === -1) {
            btnNeg.classList.add('active');
        }
        btnNeg.addEventListener('click', () => vote(phraseObj.index, -1));
        voteContainer.appendChild(btnNeg);
        
        // Neutral button
        const btnNeu = document.createElement('button');
        btnNeu.className = 'btn-vote btn-vote-neutral';
        btnNeu.textContent = '○';
        btnNeu.title = 'Voto neutro';
        btnNeu.disabled = hasVoted;
        if (hasVoted && userVotes[phraseObj.index] === 0) {
            btnNeu.classList.add('active');
        }
        btnNeu.addEventListener('click', () => vote(phraseObj.index, 0));
        voteContainer.appendChild(btnNeu);
        
        // Positive button
        const btnPos = document.createElement('button');
        btnPos.className = 'btn-vote btn-vote-positive';
        btnPos.textContent = '+';
        btnPos.title = 'Voto positivo';
        btnPos.disabled = hasVoted;
        if (hasVoted && userVotes[phraseObj.index] === 1) {
            btnPos.classList.add('active');
        }
        btnPos.addEventListener('click', () => vote(phraseObj.index, 1));
        voteContainer.appendChild(btnPos);
        
        tdVote.appendChild(voteContainer);
        tr.appendChild(tdVote);
        
        dataBody.appendChild(tr);
    });
}

// Vote function
async function vote(phraseIndex, voteValue) {
    // Check if already voted
    if (userVotes[phraseIndex] !== null && userVotes[phraseIndex] !== undefined) {
        showError('Você já votou nesta frase!');
        return;
    }
    
    // Update local cache
    userVotes[phraseIndex] = voteValue;
    localStorage.setItem('userVotes', JSON.stringify(userVotes));
    
    // Send vote to server
    try {
        await submitVote(phraseIndex, voteValue);
        
        // Update UI immediately
        const row = dataBody.querySelector(`tr[data-phrase-index="${phraseIndex}"]`);
        if (row) {
            const buttons = row.querySelectorAll('.btn-vote');
            buttons.forEach(btn => {
                btn.disabled = true;
                btn.classList.remove('active');
            });
            
            // Mark the voted button as active
            if (voteValue === -1) buttons[0].classList.add('active');
            else if (voteValue === 0) buttons[1].classList.add('active');
            else if (voteValue === 1) buttons[2].classList.add('active');
        }
        
        // Reload data to update ratings
        setTimeout(() => {
            loadData();
        }, 1000);
        
    } catch (err) {
        console.error('Error submitting vote:', err);
        // Revert local change
        userVotes[phraseIndex] = null;
        localStorage.setItem('userVotes', JSON.stringify(userVotes));
        showError('Erro ao salvar voto: ' + err.message);
    }
}

// Submit vote to server
async function submitVote(phraseIndex, voteValue) {
    return new Promise((resolve, reject) => {
        // Create vote data - update userVotes array first
        const updatedVotes = [...userVotes];
        updatedVotes[phraseIndex] = voteValue;
        
        const voteData = {
            action: 'vote',
            userId: userId,
            phraseIndex: phraseIndex,
            vote: voteValue,
            votes: updatedVotes.map(v => v === null || v === undefined ? '' : v).join(',')
        };
        
        submitViaHiddenFormVote(voteData, resolve, reject);
    });
}

// Open modal for adding new phrase
function openModal(mode = 'add') {
    modalTitle.textContent = 'Adicionar Nova Frase';
    formFields.innerHTML = '';
    
    // Create single field for phrase
    const group = document.createElement('div');
    group.className = 'form-group';
    
    const label = document.createElement('label');
    label.textContent = 'Frase';
    label.htmlFor = 'phrase_field';
    
    const textarea = document.createElement('textarea');
    textarea.id = 'phrase_field';
    textarea.name = 'phrase';
    textarea.placeholder = 'Digite a frase aqui...';
    textarea.rows = 4;
    textarea.required = true;
    
    group.appendChild(label);
    group.appendChild(textarea);
    formFields.appendChild(group);
    
    modal.style.display = 'flex';
}

// Handle form submission
async function handleSubmit(e) {
    e.preventDefault();
    
    if (!WEB_APP_URL || WEB_APP_URL.includes('YOUR_GOOGLE_APPS_SCRIPT_URL')) {
        showError('Por favor, configure a URL do Google Apps Script primeiro. Veja SETUP.md para instruções.');
        return;
    }
    
    // Get phrase from form
    const phraseField = document.getElementById('phrase_field');
    if (!phraseField || !phraseField.value.trim()) {
        showError('Por favor, digite uma frase.');
        showLoading(false);
        return;
    }
    
    const phrase = phraseField.value.trim();
    // For Google Sheets, we need to send an array with the phrase in the first column
    const rowData = [phrase];
    
    console.log('Submitting phrase:', phrase);
    
    showLoading(true);
    hideError();
    
    try {
        // Use a hidden iframe approach to submit the form (bypasses CORS)
        // This is the most reliable way with Google Apps Script
        submitViaHiddenForm(rowData);
        
        // Assume success after a delay (since we can't read the response)
        setTimeout(() => {
            closeModalHandler();
            showLoading(false);
            // Reload data after a short delay
            setTimeout(() => {
                loadData();
            }, 500);
        }, 1500);
        
    } catch (err) {
        console.error('Error submitting form:', err);
        showError('Erro ao salvar: ' + err.message);
        showLoading(false);
    }
}

// Submit data via hidden iframe (works around CORS)
function submitViaHiddenForm(rowData) {
    // Create a hidden iframe to submit to
    const iframe = document.createElement('iframe');
    iframe.name = 'hiddenSubmitFrame_' + Date.now();
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    // Create a form that targets the iframe
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = WEB_APP_URL;
    form.target = iframe.name;
    form.style.display = 'none';
    
    // Google Apps Script expects postData.contents as a JSON string
    const payload = JSON.stringify({
        action: 'append',
        data: rowData
    });
    
    const dataInput = document.createElement('input');
    dataInput.type = 'hidden';
    dataInput.name = 'postData';
    dataInput.value = payload;
    
    form.appendChild(dataInput);
    document.body.appendChild(form);
    
    // Submit the form
    form.submit();
    
    // Clean up after a delay
    setTimeout(() => {
        if (document.body.contains(form)) {
            document.body.removeChild(form);
        }
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
    }, 3000);
}

// Submit vote via hidden iframe
function submitViaHiddenFormVote(voteData, resolve, reject) {
    // Create a hidden iframe to submit to
    const iframe = document.createElement('iframe');
    iframe.name = 'hiddenVoteFrame_' + Date.now();
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    // Create a form that targets the iframe
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = WEB_APP_URL;
    form.target = iframe.name;
    form.style.display = 'none';
    
    const payload = JSON.stringify(voteData);
    
    const dataInput = document.createElement('input');
    dataInput.type = 'hidden';
    dataInput.name = 'postData';
    dataInput.value = payload;
    
    form.appendChild(dataInput);
    document.body.appendChild(form);
    
    // Submit the form
    form.submit();
    
    // Assume success after delay
    setTimeout(() => {
        if (document.body.contains(form)) {
            document.body.removeChild(form);
        }
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
        resolve();
    }, 2000);
}

// Close modal
function closeModalHandler() {
    modal.style.display = 'none';
    formModal.reset();
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

function showTable(show) {
    if (dataTable) {
        dataTable.style.display = show ? 'table' : 'none';
    }
}

function showEmptyState(show) {
    if (emptyState) {
        emptyState.style.display = show ? 'block' : 'none';
    }
}

