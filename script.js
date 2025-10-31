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

let phrases = []; // Array para armazenar as frases da coluna A

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
        
        // Extrair apenas a coluna A (primeira coluna de cada linha)
        phrases = rows
            .slice(startIndex) // Pula cabeçalho se houver
            .map(row => row[0]) // Pega apenas a primeira coluna
            .filter(phrase => phrase && phrase.trim() !== ''); // Remove linhas vazias
        
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
    
    // Render header
    const th = document.createElement('th');
    th.textContent = 'Frase';
    headerRow.appendChild(th);
    
    // Render phrases
    phrases.forEach((phrase, index) => {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.textContent = phrase;
        tr.appendChild(td);
        dataBody.appendChild(tr);
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
    iframe.name = 'hiddenSubmitFrame';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    // Create a form that targets the iframe
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = WEB_APP_URL;
    form.target = 'hiddenSubmitFrame';
    form.style.display = 'none';
    
    // Google Apps Script expects postData.contents as a JSON string
    const payload = JSON.stringify({
        action: 'append',
        data: rowData
    });
    
    const dataInput = document.createElement('input');
    dataInput.type = 'hidden';
    dataInput.name = 'postData';
    // The Google Apps Script receives this as e.parameter.postData
    // But it expects e.postData.contents, so we need to send it differently
    // Actually, let's send it as form data and modify the script
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

