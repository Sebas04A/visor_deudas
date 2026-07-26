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

async function fetchEstadoCuenta(debtorId) {
    const response = await fetch(
        `${SUPABASE_URL}/functions/v1/get_estado_cuenta`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ deudor_id: debtorId, pov: 'debtor' })
        }
    );
    
    if (!response.ok) throw new Error('Error fetching estado_cuenta');
    
    return response.json();
}

// ========================================
// History Logic
// ========================================

async function fetchFullHistory(debtorId) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/get_historial`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ deudor_id: debtorId, pov: 'debtor' })
    });

    if (!response.ok) {
        console.error('Failed to fetch history from Edge Function:', await response.text());
        throw new Error('Error fetching full history');
    }

    // La Edge Function ahora devuelve una LISTA PLANA cronológica descendente
    // (presente → pasado), con pagos ARRIBA de las deudas que abonaron.
    const items = await response.json();

    items.forEach(it => {
        it.date = new Date(it.date + 'T12:00:00');
        it.createdAt = new Date(it.createdAt);
    });

    return items;
}

function renderHistoryItem(item) {
    const isBeneficialForDebtor = item.type === 'deuda' ? item.esMiDeuda : item.esMiPago;
    const cardColor = isBeneficialForDebtor ? '#10b981' : '#f43f5e';
    const sign = isBeneficialForDebtor ? '+' : '-';
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const _d = new Date(item.date);
    _d.setHours(0,0,0,0);
    const diff = Math.floor((today - _d) / 86400000);
    const timeStr = item.createdAt.toLocaleTimeString('es-EC',{hour:'2-digit',minute:'2-digit'}).toUpperCase();
    
    let dateResult = '';
    if (diff === 0) {
        dateResult = `Hoy, ${timeStr}`;
    } else if (diff === 1) {
        dateResult = `Ayer, ${timeStr}`;
    } else {
        let wDay = _d.toLocaleDateString('es-EC', {weekday: 'short'}).replace('.', '');
        let day = _d.getDate();
        let month = _d.toLocaleDateString('es-EC', {month: 'short'}).replace('.', '');
        let year = _d.getFullYear();
        dateResult = `${wDay.charAt(0).toUpperCase() + wDay.slice(1)}, ${day} ${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
    }
    const dateHtml = `<span style="color: var(--text-dim);">${dateResult}</span>`;

    const debtorBalance = -item.balance;
    const saldoSign = debtorBalance > 0 ? '+' : (debtorBalance < 0 ? '-' : '');
    const displayBalance = formatCurrency(Math.abs(debtorBalance));

    if (item.type === 'pago' && item.esCompensacion) {
        return `
        <div class="history-card" style="background: var(--glass-015); border: 1px solid var(--glass-05); border-radius: 16px; padding: 16px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 14px; color: var(--text-dim);">
                    <div style="width: 44px; height: 44px; border-radius: 8px; background: rgba(59, 130, 246, 0.1); color: #60a5fa; display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">
                        <i class="ri-refresh-line"></i>
                    </div>
                    <div>
                        <div style="font-weight: 600; font-size: 1.05rem; color: var(--text-main);">Cruce automático</div>
                        <div style="color: var(--text-dim); font-size: 0.8rem; margin-top: 4px;">${dateHtml}</div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="color: #60a5fa; font-weight: 800; font-size: 1.15rem;">${formatCurrency(item.amount)}</span>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                        Saldo: ${saldoSign}${displayBalance}
                    </div>
                </div>
            </div>
        </div>
        `;
    } else if (item.type === 'pago') {
        const icon = isBeneficialForDebtor ? 'ri-arrow-left-down-line' : 'ri-arrow-right-up-line';
        let cruceHtml = '';
        if (item.linkedCruceAmount) {
            const randomId = 'cruce-' + Math.floor(Math.random() * 1000000);
            let detailsListHtml = '';
            if (item.linkedCruceDetails && item.linkedCruceDetails.length > 0) {
                let debitsHtml = '';
                let creditsHtml = '';
                item.linkedCruceDetails.forEach(det => {
                    const deudasObj = det.deudas || {};
                    const signC = deudasObj.es_mi_deuda ? '+' : '-';
                    const colorC = deudasObj.es_mi_deuda ? '#10b981' : '#f43f5e';
                    const nameC = deudasObj.titulo || 'Deuda sin título';
                    const elementHtml = `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.8rem;">
                            <span style="color: var(--text-dim);">${escapeHtml(nameC)}</span>
                            <span style="color: ${colorC}; font-weight: 700;">${signC}${formatCurrency(det.monto_asignado)}</span>
                        </div>
                    `;
                    if (deudasObj.es_mi_deuda) creditsHtml += elementHtml;
                    else debitsHtml += elementHtml;
                });
                detailsListHtml = `
                    <div id="${randomId}" style="display: none; padding-top: 12px; margin-top: 12px; border-top: 1px dashed var(--glass-05);">
                        ${debitsHtml ? `<div style="margin-bottom: 8px;"><div style="font-size: 0.65rem; color: #f43f5e; font-weight: 700; margin-bottom: 4px; text-transform: uppercase;">Abonando deudas suyas con tu dinero</div>${debitsHtml}</div>` : ''}
                        ${creditsHtml ? `<div><div style="font-size: 0.65rem; color: #10b981; font-weight: 700; margin-bottom: 4px; text-transform: uppercase;">Gastando dinero suyo a tu favor</div>${creditsHtml}</div>` : ''}
                    </div>
                `;
            }

            cruceHtml = `
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--glass-03);">
                    <div style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;" onclick="const el = document.getElementById('${randomId}'); if(el){ el.style.display = el.style.display === 'none' ? 'block' : 'none'; }">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-weight: 800; font-size: 0.70rem; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase;">Cruce: ${formatCurrency(item.linkedCruceAmount)}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="background: var(--glass-05); border-radius: 4px; padding: 2px;">
                                <i class="ri-arrow-down-s-line" style="color: var(--text-dim);"></i>
                            </div>
                        </div>
                    </div>
                    ${detailsListHtml}
                </div>
            `;
        }

        // Parciales: deudas que quedaron PARCIALMENTE cubiertas tras este pago (ámbar)
        let parcialesHtml = '';
        if (item.parciales && item.parciales.length > 0) {
            let filas = '';
            item.parciales.forEach(pc => {
                filas += `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 0.8rem;">
                        <span style="color: #fbbf24;"><i class="ri-error-warning-line" style="margin-right: 4px;"></i>${escapeHtml(pc.titulo)} — parcial</span>
                        <span style="color: #f59e0b; font-weight: 700;">queda ${formatCurrency(pc.saldo)}</span>
                    </div>
                `;
            });
            parcialesHtml = `
                <div style="margin-top: 16px; padding-top: 12px; border-top: 1px dashed rgba(245, 158, 11, 0.35);">
                    <div style="font-size: 0.65rem; color: #f59e0b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Deudas parcialmente cubiertas</div>
                    ${filas}
                </div>
            `;
        }

        const cardBg = isBeneficialForDebtor
            ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.02) 100%)'
            : 'linear-gradient(90deg, rgba(244, 63, 94, 0.15) 0%, rgba(244, 63, 94, 0.02) 100%)';
        const cardBorderColor = isBeneficialForDebtor ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)';

        return `
        <div class="history-card" style="background: ${cardBg}; border: 1px solid ${cardBorderColor}; border-radius: 16px; padding: 16px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="width: 44px; height: 44px; border-radius: 50%; background: ${cardColor}15; color: ${cardColor}; display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">
                        <i class="${icon}"></i>
                    </div>
                    <div>
                        <div style="font-weight: 800; color: var(--text-main); font-size: 1.05rem; line-height: 1.2;">${escapeHtml(item.title)}</div>
                        <div style="color: var(--text-dim); font-size: 0.8rem; margin-top: 4px;">${dateHtml}</div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 1.15rem; font-weight: 900; color: ${cardColor};">
                        ${sign}${formatCurrency(item.amount)}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                        Saldo: ${saldoSign}${displayBalance}
                    </div>
                </div>
            </div>
            ${cruceHtml}
            ${parcialesHtml}
        </div>
        `;
    } else {
        const esParcial = item.montoPagado > 0 && item.montoPagado < item.amount;
        let progressHtml = '';
        if (esParcial) {
            progressHtml = `
            <div class="progress-section" style="margin-top: 14px;">
                <div class="progress-track">
                    <div class="progress-fill" style="width: ${(item.montoPagado / item.amount) * 100}%; background: ${cardColor};"></div>
                </div>
                <div style="font-size: 0.75rem; color: ${cardColor}; font-weight: 600; margin-top: 6px;">
                    Abonado: ${formatCurrency(item.montoPagado)}
                </div>
            </div>
            `;
        }
        return `
        <div class="history-card" style="background: var(--glass-015); border: 1px solid var(--glass-03); border-radius: 16px; padding: 16px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: ${cardColor}; box-shadow: 0 0 10px ${cardColor}; margin-left: 10px;"></div>
                    <div style="margin-left: 8px;">
                        <div style="font-weight: 700; color: var(--text-main); font-size: 1rem; line-height: 1.2;">${escapeHtml(item.title)}</div>
                        <div style="color: var(--text-dim); font-size: 0.8rem; margin-top: 4px;">${dateHtml}</div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 1.1rem; font-weight: 800; color: ${cardColor};">
                        ${sign}${formatCurrency(item.amount)}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                        Saldo: ${saldoSign}${displayBalance}
                    </div>
                </div>
            </div>
            ${progressHtml}
        </div>
        `;
    }
}

function renderHistory(items) {
    if (!items || items.length === 0) {
        historyListEl.innerHTML = `
            <div class="empty-state"><p>No hay historial disponible</p></div>
        `;
        return;
    }

    // Lista plana cronológica descendente (presente → pasado): los pagos ya vienen
    // ARRIBA de las deudas que abonaron. Se recorre directo, sin agrupar.
    let html = '';
    items.forEach(item => { html += renderHistoryItem(item); });
    historyListEl.innerHTML = html;
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
function updateBalanceCard(resumen) {
    const card = document.querySelector('.balance-card');
    if (!card) return;

    const totalNeto = resumen.total_deuda;
    const isDebtorOwing = totalNeto < 0; 
    const headerColor = isDebtorOwing ? '#ef4444' : (totalNeto > 0 ? '#10b981' : 'var(--text-secondary)');
    const headerText = totalNeto !== 0 ? (isDebtorOwing ? "DEBES ABONAR" : "TE DEBEN ABONAR") : "TODO COMPENSADO";

    let html = `
        <div class="balance-header" style="justify-content: center; margin-bottom: 0.5rem; text-align: center;">
            <span class="balance-label" style="font-weight: 800; letter-spacing: 1px; font-size: 0.8rem; color: ${headerColor}; text-transform: uppercase;">${headerText}</span>
        </div>
        <div class="balance-amount-wrapper" style="justify-content: center;">
            <p class="total-amount" style="color: ${headerColor}; font-size: 3rem; letter-spacing: -1px; line-height: 1;">${formatCurrency(Math.abs(totalNeto))}</p>
        </div>
    `;

    if (resumen.monto_ideal_a_cruzar > 0) {
        html += `<div style="background: var(--glass-inverted); border-radius: 12px; padding: 12px; margin-top: 1rem; width: 100%;">
            <div style="background: rgba(59, 130, 246, 0.15); border-radius: 8px; padding: 6px 8px; display: flex; align-items: center; justify-content: center;">
                <i class="ri-refresh-line" style="color: #3b82f6; font-size: 0.9rem; margin-right: 6px;"></i>
                <span style="color: #3b82f6; font-size: 0.75rem; font-weight: 700;">Cruce automático de ${formatCurrency(resumen.monto_ideal_a_cruzar)}</span>
            </div>
        </div>`;
    }

    card.innerHTML = html;
}

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
        const compensado = debt.cruce_sugerido || 0;
        const esParcial = parseFloat(debt.monto_pagado) > 0;
        const saldoReal = debt.saldo_pendiente - compensado;
        
        const isFullyCrossed = (debt.saldo_pendiente - compensado <= 0.01) && compensado > 0;
        const opacityStyle = isFullyCrossed ? 'opacity: 0.4;' : '';
         const tagBg = debt.es_tu_deuda ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)';
         const tagColor = debt.es_tu_deuda ? '#ef4444' : '#10b981';
         const tagText = debt.es_tu_deuda ? 'TÚ DEBES' : 'TE DEBEN';

         const amountColor = isFullyCrossed ? 'var(--text-secondary)' : (debt.es_tu_deuda ? '#ef4444' : '#10b981');
         const amountPrefix = debt.es_tu_deuda ? '-' : '+';
         const titleStyle = isFullyCrossed ? 'color: var(--text-secondary);' : (debt.es_tu_deuda ? 'color: #ef4444;' : 'color: #10b981;');

        return `
        <div class="debt-card ${esParcial ? 'is-partial' : ''}" style="${opacityStyle} ${isFullyCrossed ? 'background: var(--glass-02); border-color: var(--glass-05); box-shadow: none;' : ''}">
             <div class="debt-header">
                 <div class="debt-info">
                     <p class="debt-title" style="${titleStyle}">${escapeHtml(debt.titulo)}</p>
                     <div class="debt-date" style="margin-top: 4px;">
                         <span style="background: ${tagBg}; color: ${tagColor}; padding: 2px 6px; border-radius: 4px; font-size: 0.55rem; font-weight: 900; letter-spacing: 1px;">
                            ${tagText}
                         </span>
                         <span style="margin-left: 8px;">${formatDate(debt.fecha_gasto)}</span>
                     </div>
                 </div>
                 
                  <div class="debt-main-amount" style="align-items: flex-end; justify-content: center;">
                     ${(compensado > 0 && !isFullyCrossed) ? `
                     <span style="font-size: 0.75rem; text-decoration: line-through; color: var(--text-dim);">${amountPrefix}${formatCurrency(debt.saldo_pendiente)}</span>
                     ` : ''}
                     <span class="debt-amount-value" style="font-size: 1.25rem; color: ${amountColor}; line-height: 1;">
                         ${isFullyCrossed ? (amountPrefix + formatCurrency(debt.saldo_pendiente)) : (amountPrefix + formatCurrency(saldoReal))}
                     </span>
                     ${compensado > 0 ? `
                     <span style="font-size: 0.7rem; color: #3b82f6; font-weight: 800; margin-top: 4px;">-${formatCurrency(compensado)} (cruce)</span>
                     ` : ''}
                  </div>
             </div>
             
              ${esParcial && !isFullyCrossed ? `
                <div class="progress-section" style="margin-top: 16px; padding: 0 2px;">
                    <!-- Sleek modern track -->
                    <div class="progress-track" style="height: 6px; background: var(--progress-track-bg); border-radius: 10px; position: relative; border: 0.5px solid var(--progress-track-border);">
                        <!-- Glowing progress line -->
                        <div class="progress-fill" style="height: 100%; width: ${(debt.monto_pagado / montoOriginal) * 100}%; background: linear-gradient(90deg, ${tagColor}66, ${tagColor}); border-radius: 10px; position: relative; box-shadow: 0 0 10px ${tagColor}33; transition: width 0.8s ease-out;">
                            <!-- Intense light source at the end -->
                            <div style="position: absolute; right: -4px; top: 50%; transform: translateY(-50%); width: 8px; height: 8px; background: var(--progress-tip-bg); border-radius: 50%; box-shadow: 0 0 6px var(--progress-tip-glow), 0 0 12px ${tagColor}, 0 0 20px ${tagColor}88; z-index: 5;"></div>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 10px;">
                        <span style="font-size: 0.7rem; color: ${tagColor}; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;">
                            Abonado <span style="font-size: 0.8rem; margin-left: 4px;">${formatCurrency(debt.monto_pagado)}</span>
                        </span>
                        <span style="font-size: 0.65rem; color: var(--text-dim); opacity: 0.5; font-weight: 600; letter-spacing: 0.4px;">
                            OBJETIVO: ${formatCurrency(montoOriginal)}
                        </span>
                    </div>
                </div>
             ` : ''}
        </div>
    `}).join('');

    // Small delay to ensure DOM is ready for observation
    setTimeout(setupScrollReveal, 50);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

        // Initial Data Fetch
        const estadoCuenta = await fetchEstadoCuenta(debtor.id);
        
        // Render
        debtorNameEl.textContent = debtor.nombre;
        
        updateBalanceCard(estadoCuenta.resumen);

        renderCredit(estadoCuenta.resumen.saldo_favor);
        renderDebts(estadoCuenta.deudas_pendientes);
        
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
