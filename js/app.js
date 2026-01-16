// ========================================
// Configuración de Supabase
// ========================================
// IMPORTANTE: Reemplazar con tus credenciales de Supabase
const SUPABASE_URL = 'https://rcmdzvbxerumzxvnubfo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CZL2FVo5YLTnUPeyAq7S-w_lfExK_yw';

// ========================================
// Elementos del DOM
// ========================================
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const contentEl = document.getElementById('content');
const debtorNameEl = document.getElementById('debtor-name');
const totalAmountEl = document.getElementById('total-amount');
const debtsListEl = document.getElementById('debts-list');
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

// ========================================
// Theme Management
// ========================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    // Default to dark if no preference
    const isLight = savedTheme === 'light';
    
    applyTheme(isLight);
}

function applyTheme(isLight) {
    if (isLight) {
        document.documentElement.setAttribute('data-theme', 'light');
        themeIcon.className = 'ri-sun-line';
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
        themeIcon.className = 'ri-moon-line';
        localStorage.setItem('theme', 'dark');
    }
}

themeToggleBtn.addEventListener('click', () => {
    const isLight = !document.documentElement.hasAttribute('data-theme');
    applyTheme(isLight); // Toggle logic is weird: if NO attribute (dark), we want to apply light.
});

// ========================================
// Utilidades
// ========================================
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(amount);
}

function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('es-EC', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function getTokenFromURL() {
    const params = new URLSearchParams(window.location.search);
    console.log(params.get('token'));    
    return params.get('token');
}

// ========================================
// Estados de la UI
// ========================================
function showLoading() {
    loadingEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
    contentEl.classList.add('hidden');
}

function showError() {
    loadingEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
}

function showContent() {
    loadingEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
}

// ========================================
// API Supabase
// ========================================
async function fetchDebtorByToken(token) {
    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/deudores?token=eq.${token}&select=*`,
        {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        }
    );
    
    if (!response.ok) throw new Error('Error fetching debtor');
    
    const data = await response.json();
    return data.length > 0 ? data[0] : null;
}

async function fetchDebtsByDebtorId(debtorId) {
    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/deudas?deudor_id=eq.${debtorId}&pagada=eq.false&select=*&order=fecha_gasto.desc`,
        {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        }
    );
    
    if (!response.ok) throw new Error('Error fetching debts');
    
    return response.json();
}

// ========================================
// Renderizado
// ========================================
// ========================================
// Animations Management (Scroll Reveal)
// ========================================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('reveal');
            // Once revealed, we don't need to observe it anymore
            revealObserver.unobserve(entry.target);
        }
    });
}, observerOptions);

function setupScrollReveal() {
    const reveals = document.querySelectorAll('.balance-card, .debt-card, .user-greeting');
    reveals.forEach(el => revealObserver.observe(el));
}

// ========================================
// Renderizado
// ========================================
function renderDebts(debts) {
    if (debts.length === 0) {
        debtsListEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="ri-checkbox-circle-line" style="color: var(--success-color, #10b981);"></i>
                </div>
                <p>¡Todo al día! No tienes deudas pendientes.</p>
            </div>
        `;
        return;
    }
    
    // Update the debt count badge
    const countEl = document.getElementById('debt-count');
    if(countEl) countEl.textContent = `${debts.length}`;

    debtsListEl.innerHTML = debts.map((debt, index) => `
        <div class="debt-card">
            <div class="debt-info">
                <p class="debt-title">${escapeHtml(debt.titulo)}</p>
                <div class="debt-date">
                    <span>${formatDate(debt.fecha_gasto)}</span>
                </div>
            </div>
            <p class="debt-amount">${formatCurrency(debt.monto)}</p>
        </div>
    `).join('');

    // Small delay to ensure DOM is ready for observation
    setTimeout(setupScrollReveal, 50);
}

function calculateTotal(debts) {
    return debts.reduce((sum, debt) => sum + parseFloat(debt.monto), 0);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// Inicialización
// ========================================
async function init() {
    showLoading();
    
    const token = getTokenFromURL();
    
    if (!token) {
        showError();
        return;
    }
    
    try {
        // Obtener deudor por token
        const debtor = await fetchDebtorByToken(token);
        
        if (!debtor) {
            showError();
            return;
        }
        
        // Obtener deudas del deudor
        const debts = await fetchDebtsByDebtorId(debtor.id);
        
        // Renderizar
        debtorNameEl.textContent = debtor.nombre;
        totalAmountEl.textContent = formatCurrency(calculateTotal(debts));
        renderDebts(debts);
        
        showContent();
        
        // Initialize reveal on static elements
        setupScrollReveal();
        
    } catch (error) {
        console.error('Error:', error);
        showError();
    }
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    init();
});
