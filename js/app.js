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
const creditContainerEl = document.getElementById('credit-container');
const totalAmountEl = document.getElementById('total-amount');
const debtsListEl = document.getElementById('debts-list');
const historyListEl = document.getElementById('history-list');
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

// Navigation
const viewHistoryBtn = document.getElementById('view-history-btn');
const backBtn = document.getElementById('back-btn');
const historyLoadingEl = document.getElementById('history-loading');
const pendingView = document.getElementById('pending-view');
const historyView = document.getElementById('history-view');

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
        `${SUPABASE_URL}/rest/v1/vista_estado_deudas?deudor_id=eq.${debtorId}&estado=neq.PAGADA&select=*&order=fecha_gasto.desc`,
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

async function fetchPagosByDebtorId(debtorId) {
    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/pagos?deudor_id=eq.${debtorId}&select=id,monto_total`,
        {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        }
    );
     if (!response.ok) throw new Error('Error fetching payments');
    return response.json();
}

async function fetchDetallesByDebtorId(debtorId) {
     // We need details linked to debtor's payments. 
     // Supabase select filtering on related tables can be tricky with simple REST.
     // Simplest approach: Fetch ALL details for payments of this debtor.
     // But we first need the payment IDs. 
     // Optimization: JSON-based calculation might be heavy if many records, but fine for personal use.
     
     // Better strategy: We already fetch pagos. extracting IDs is easy.
     // BUT REST 'in' filter URL length limit. 
     // Let's rely on standard ID filtering if possible, or just fetch all details (not efficient) or 
     // use a Join. 
     
     // Actually, we can just fetch all details where payment.deudor_id = debtorId.
     // Supabase supports nested query: detalle_pagos!inner(pagos!inner(deudor_id))
     
     const response = await fetch(
        `${SUPABASE_URL}/rest/v1/detalle_pagos?select=monto_asignado,pagos!inner(deudor_id)&pagos.deudor_id=eq.${debtorId}`,
        {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        }
    );
    if (!response.ok) throw new Error('Error fetching details');
    return response.json();
}

// ========================================
// History Logic
// ========================================

async function fetchFullHistory(debtorId) {
    const [allDeudas, allPagos] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/deudas?deudor_id=eq.${debtorId}&select=titulo,monto,fecha_gasto,created_at`, {
             headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        }).then(r => r.json()),
        fetch(`${SUPABASE_URL}/rest/v1/pagos?deudor_id=eq.${debtorId}&select=monto_total,fecha_pago,created_at`, {
             headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        }).then(r => r.json())
    ]);

    // Merge
    let history = [];
    
    allDeudas.forEach(d => {
        history.push({
            type: 'deuda',
            title: d.titulo,
            amount: d.monto,
            date: new Date(d.fecha_gasto + 'T12:00:00'), // Force noon to avoid TZ shift issues on pure dates
            createdAt: new Date(d.created_at)
        });
    });

    allPagos.forEach(p => {
        history.push({
            type: 'pago',
            title: 'Pago Registrado',
            amount: p.monto_total,
            date: new Date(p.fecha_pago + 'T12:00:00'),
            createdAt: new Date(p.created_at)
        });
    });

    // Sort Ascending (Oldest First)
    // Primary: User Date, Secondary: Creation Time (access sequence)
    history.sort((a, b) => {
        const dateDiff = a.date - b.date;
        if (dateDiff !== 0) return dateDiff;
        return a.createdAt - b.createdAt;
    });

    // Calculate Running Balance
    let balance = 0;
    history.forEach(item => {
        if (item.type === 'deuda') balance += item.amount;
        else balance -= item.amount;
        item.balance = balance;
    });

    // Return Reversed (Newest First)
    return history.reverse();
}

function renderHistory(items) {
    if (items.length === 0) {
        historyListEl.innerHTML = `
            <div class="empty-state"><p>No hay historial disponible</p></div>
        `;
        return;
    }

    historyListEl.innerHTML = items.map(item => `
        <div class="history-card type-${item.type}">
            <div class="history-header">
                <div class="history-info">
                    <p class="history-title">${escapeHtml(item.title)}</p>
                    <span class="history-date">
                        ${item.date.toLocaleDateString('es-EC', {day: 'numeric', month: 'short', year:'numeric'})}
                    </span>
                </div>
                <div class="history-amount">
                    ${item.type === 'deuda' ? '+' : '-'} ${formatCurrency(item.amount).replace('$','')}
                </div>
            </div>
            <div class="history-footer">
                <span class="history-balance-label">Saldo tras movimiento:</span>
                <span class="history-balance-value">${formatCurrency(item.balance)}</span>
            </div>
        </div>
    `).join('');
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

    debtsListEl.innerHTML = debts.map((debt, index) => {
        const montoOriginal = parseFloat(debt.monto_original);
        const saldoPendiente = parseFloat(debt.saldo_pendiente);
        const montoPagado = parseFloat(debt.monto_pagado);
        const esParcial = montoPagado > 0;
        const porcentaje = montoOriginal > 0 ? (montoPagado / montoOriginal) * 100 : 0;

        return `
        <div class="debt-card ${esParcial ? 'is-partial' : ''}">
             <div class="debt-header">
                 <div class="debt-info">
                     <p class="debt-title">${escapeHtml(debt.titulo)}</p>
                     <div class="debt-date">
                         <span>${formatDate(debt.fecha_gasto)}</span>
                     </div>
                 </div>
                 
                 <div class="debt-main-amount">
                     <span class="debt-amount-value">${formatCurrency(saldoPendiente)}</span>
                     ${esParcial ? '<span class="debt-amount-label">Restante</span>' : ''}
                 </div>
             </div>
             
             ${esParcial ? `
                <div class="progress-section">
                    <div class="progress-track">
                        <div class="progress-fill" style="width: ${porcentaje}%"></div>
                    </div>
                    <div class="progress-stats">
                        <span style="color: #10b981">${formatCurrency(montoPagado)}</span>
                        <span>${formatCurrency(montoOriginal)}</span>
                    </div>
                </div>
             ` : ''}
        </div>
    `}).join('');

    // Small delay to ensure DOM is ready for observation
    setTimeout(setupScrollReveal, 50);
}

function calculateTotal(debts) {
    return debts.reduce((sum, debt) => sum + parseFloat(debt.saldo_pendiente), 0);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function calculateSaldoFavor(pagos, detalles) {
    const totalPagado = pagos.reduce((sum, p) => sum + p.monto_total, 0);
    const totalAsignado = detalles.reduce((sum, d) => sum + d.monto_asignado, 0);
    const saldo = totalPagado - totalAsignado;
    return saldo > 0.01 ? saldo : 0;
}

function renderCredit(saldoFavor) {
    if (!creditContainerEl) return;
    
    if (saldoFavor > 0) {
        creditContainerEl.innerHTML = `
            <div class="credit-card">
                <div class="credit-icon">
                    <i class="ri-check-double-line"></i>
                </div>
                <div class="credit-info">
                    <span class="credit-label">Saldo a Favor</span>
                    <span class="credit-amount">${formatCurrency(saldoFavor)}</span>
                </div>
            </div>
        `;
        creditContainerEl.classList.remove('hidden');
    } else {
        creditContainerEl.classList.add('hidden');
        creditContainerEl.innerHTML = '';
    }
}

// ========================================
// Inicialización
// ========================================
// Navigation Logic
let historyLoaded = false;
let currentDebtorId = null;

viewHistoryBtn.addEventListener('click', async () => {
    // Show View
    pendingView.classList.remove('active');
    pendingView.classList.add('hidden');
    historyView.classList.remove('hidden');
    setTimeout(() => historyView.classList.add('active'), 10);
    
    // Load Data if needed
    if (!historyLoaded && currentDebtorId) {
        historyLoadingEl.classList.remove('hidden');
        try {
            const historyItems = await fetchFullHistory(currentDebtorId);
            renderHistory(historyItems);
            historyLoaded = true;
        } catch (e) {
            console.error(e);
            historyListEl.innerHTML = '<div class="empty-state"><p>Error al cargar historial</p></div>';
        } finally {
            historyLoadingEl.classList.add('hidden');
        }
    }
});

backBtn.addEventListener('click', () => {
    historyView.classList.remove('active');
    historyView.classList.add('hidden');
    pendingView.classList.remove('hidden');
    setTimeout(() => pendingView.classList.add('active'), 10);
});

async function init() {
    showLoading();
    
    const token = getTokenFromURL();
    
    if (!token) {
        showError();
        return;
    }
    
    try {
        const debtor = await fetchDebtorByToken(token);
        if (!debtor) { showError(); return; }
        
        currentDebtorId = debtor.id; // Store for lazy load

        // Initial Data Fetch (Only Pending stuff)
        const [debts, pagos, detalles] = await Promise.all([
            fetchDebtsByDebtorId(debtor.id),
            fetchPagosByDebtorId(debtor.id),
            fetchDetallesByDebtorId(debtor.id)
        ]);
        
        const saldoFavor = calculateSaldoFavor(pagos, detalles);
        
        // Render
        debtorNameEl.textContent = debtor.nombre;
        totalAmountEl.textContent = formatCurrency(calculateTotal(debts));
        renderCredit(saldoFavor);
        renderDebts(debts);
        renderCredit(saldoFavor);
        renderDebts(debts);
        // renderHistory(historyItems); REMOVED from init
        
        showContent();
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
