// Google Sheets Configuration
const SPREADSHEET_ID = '1ajnPZy6u6nw-g5GE5ZbortN53JZ9SBkl9RYB9TxMFqs';
const GID = '98642087';

// Google Apps Script Web App URL
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyvTOavkRUQaoVaRd9WKm01PPmeOhwQL9qKP4mdc0Vc-uCjyxgLNzC9bpW9yhWT7R1g/exec';

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
        if (headers.length === 0) {
            showError('Por favor, carregue os dados primeiro clicando em "Atualizar"');
            return;
        }
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
    
    try {
        console.log('Loading data from:', CSV_URL);
        const response = await fetch(CSV_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const csvText = await response.text();
        console.log('CSV received, length:', csvText.length);
        
        if (!csvText || csvText.trim() === '') {
            showEmptyState(true);
            showTable(false);
            showError('A planilha está vazia ou não pode ser acessada.');
            return;
        }
        
        const rows = parseCSV(csvText);
        console.log('Parsed rows:', rows.length);
        
        if (rows.length === 0) {
            showEmptyState(true);
            showTable(false);
            return;
        }
        
        // First row is headers
        headers = rows[0];
        currentData = rows.slice(1);
        
        console.log('Headers:', headers);
        console.log('Data rows:', currentData.length);
        
        renderTable();
        showEmptyState(false);
        showTable(true);
    } catch (err) {
        console.error('Error loading data:', err);
        showError('Erro ao carregar dados: ' + err.message + '. Verifique se a planilha está pública.');
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
    
    if (!WEB_APP_URL || WEB_APP_URL.includes('YOUR_GOOGLE_APPS_SCRIPT_URL')) {
        showError('Por favor, configure a URL do Google Apps Script primeiro. Veja SETUP.md para instruções.');
        return;
    }
    
    const rowData = [];
    
    headers.forEach((header, index) => {
        const field = document.getElementById(`field_${index}`);
        if (!field) {
            console.error(`Field field_${index} not found`);
            rowData.push('');
        } else {
            rowData.push(field.value || '');
        }
    });
    
    console.log('Submitting row data:', rowData);
    
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
        
        console.log('Response status:', response.status);
        
        // Google Apps Script web apps often redirect, so we need to handle that
        // Also, the response might be HTML or JSON
        const text = await response.text();
        console.log('Response text:', text.substring(0, 200));
        
        let result;
        
        // Try to parse as JSON
        try {
            result = JSON.parse(text);
        } catch (parseError) {
            // If it's not JSON, check if it's a success response
            // Google Apps Script often returns HTML redirect pages on success
            if (response.ok || response.status === 200) {
                // If status is OK, assume success
                result = { success: true };
                console.log('Assumed success from response status');
            } else {
                // Try to extract error from HTML if possible
                const errorMatch = text.match(/error[:\s]+([^<]+)/i);
                const errorMsg = errorMatch ? errorMatch[1] : 'Erro desconhecido do servidor';
                throw new Error(errorMsg);
            }
        }
        
        console.log('Result:', result);
        
        if (result.success) {
            closeModalHandler();
            // Reload data after a short delay
            setTimeout(() => {
                loadData();
            }, 1000);
        } else {
            throw new Error(result.error || 'Erro ao salvar dados');
        }
    } catch (err) {
        console.error('Error submitting form:', err);
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
    if (dataTable) {
        dataTable.style.display = show ? 'table' : 'none';
    }
}

function showEmptyState(show) {
    if (emptyState) {
        emptyState.style.display = show ? 'block' : 'none';
    }
}

