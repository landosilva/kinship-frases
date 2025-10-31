// Google Sheets Configuration
const SPREADSHEET_ID = '1ajnPZy6u6nw-g5GE5ZbortN53JZ9SBkl9RYB9TxMFqs';
const GID = '98642087';

// IMPORTANT: Replace this with your Google Apps Script Web App URL after deployment
// See SETUP.md for instructions
const WEB_APP_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';

// CSV export URL for reading
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID}`;

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

let headers = [];
let currentData = [];

// Event Listeners
refreshBtn.addEventListener('click', loadData);
addBtn.addEventListener('click', () => openModal('add'));
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
document.addEventListener('DOMContentLoaded', () => {
    loadData();
});

// Load data from Google Sheets
async function loadData() {
    showLoading(true);
    hideError();
    
    try {
        const response = await fetch(CSV_URL);
        
        if (!response.ok) {
            throw new Error('Erro ao carregar dados da planilha');
        }
        
        const csvText = await response.text();
        const rows = parseCSV(csvText);
        
        if (rows.length === 0) {
            showEmptyState(true);
            showTable(false);
            return;
        }
        
        // First row is headers
        headers = rows[0];
        currentData = rows.slice(1);
        
        renderTable();
        showEmptyState(false);
        showTable(true);
    } catch (err) {
        showError('Erro ao carregar dados: ' + err.message);
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

// Render table with data
function renderTable() {
    // Clear existing content
    headerRow.innerHTML = '';
    dataBody.innerHTML = '';
    
    // Render headers
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header || 'Coluna';
        headerRow.appendChild(th);
    });
    
    // Render data rows
    if (currentData.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = headers.length;
        td.textContent = 'Nenhum dado encontrado';
        td.style.textAlign = 'center';
        td.style.color = 'var(--text-secondary)';
        tr.appendChild(td);
        dataBody.appendChild(tr);
    } else {
        currentData.forEach((row, index) => {
            const tr = document.createElement('tr');
            
            // Ensure row has same number of cells as headers
            while (row.length < headers.length) {
                row.push('');
            }
            
            row.forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell || '';
                tr.appendChild(td);
            });
            
            dataBody.appendChild(tr);
        });
    }
}

// Open modal for adding new row
function openModal(mode = 'add') {
    modalTitle.textContent = mode === 'add' ? 'Adicionar Nova Linha' : 'Editar Linha';
    formFields.innerHTML = '';
    
    // Create form fields based on headers
    headers.forEach((header, index) => {
        const group = document.createElement('div');
        group.className = 'form-group';
        
        const label = document.createElement('label');
        label.textContent = header || `Coluna ${index + 1}`;
        label.htmlFor = `field_${index}`;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `field_${index}`;
        input.name = header || `col_${index}`;
        input.placeholder = `Digite ${header || 'valor'}...`;
        
        group.appendChild(label);
        group.appendChild(input);
        formFields.appendChild(group);
    });
    
    modal.style.display = 'flex';
}

// Handle form submission
async function handleSubmit(e) {
    e.preventDefault();
    
    if (WEB_APP_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
        showError('Por favor, configure a URL do Google Apps Script primeiro. Veja SETUP.md para instruções.');
        return;
    }
    
    const formData = new FormData(formModal);
    const rowData = [];
    
    headers.forEach((header, index) => {
        const field = document.getElementById(`field_${index}`);
        rowData.push(field.value || '');
    });
    
    showLoading(true);
    hideError();
    
    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'append',
                data: rowData
            })
        });
        
        if (!response.ok) {
            throw new Error('Erro ao salvar dados');
        }
        
        const result = await response.json();
        
        if (result.success) {
            closeModalHandler();
            // Reload data after a short delay
            setTimeout(() => {
                loadData();
            }, 500);
        } else {
            throw new Error(result.error || 'Erro ao salvar dados');
        }
    } catch (err) {
        showError('Erro ao salvar: ' + err.message);
    } finally {
        showLoading(false);
    }
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
    dataTable.style.display = show ? 'table' : 'none';
}

function showEmptyState(show) {
    emptyState.style.display = show ? 'block' : 'none';
}

