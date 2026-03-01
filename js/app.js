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
        body: JSON.stringify({ deudor_id: debtorId })
    });

    if (!response.ok) {
        console.error('Failed to fetch history from Edge Function:', await response.text());
        throw new Error('Error fetching full history');
    }

    const groupedData = await response.json();
    
    // The edge function returning dates might need parsing (e.g., createdAt is timestamp)
    // We convert string dates or timestamps to Date objects for the renderer
    groupedData.forEach(g => {
        g.pagos.forEach(p => {
            p.date = new Date(p.date + 'T12:00:00'); 
            p.createdAt = new Date(p.createdAt); 
        });
        g.deudas.forEach(d => {
            d.date = new Date(d.date + 'T12:00:00');
            d.createdAt = new Date(d.createdAt);
        });
    });

    return groupedData;
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

function renderHistory(groups) {
    if (groups.length === 0) {
        historyListEl.innerHTML = `
            <div class="empty-state"><p>No hay historial disponible</p></div>
        `;
        return;
    }

    let html = '';

    groups.forEach((group) => {
        let groupTitleDate = '';
        if (group.pagos.length > 0) {
            const lastPago = group.pagos[0];
            const _d = new Date(lastPago.date);
            let wDay = _d.toLocaleDateString('es-EC', {weekday: 'short'}).replace('.', '');
            let day = _d.getDate();
            let month = _d.toLocaleDateString('es-EC', {month: 'short'}).replace('.', '');
            let year = _d.getFullYear();
            groupTitleDate = `${wDay.charAt(0).toUpperCase() + wDay.slice(1)}, ${day} ${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
        } else if (group.deudas.length > 0) {
            // Unlikely to just be deudas unless no pagos ever made for these initially. If so:
            const firstDeuda = group.deudas[0];
            const _d = new Date(firstDeuda.date);
            let month = _d.toLocaleDateString('es-EC', {month: 'short'}).replace('.', '');
            groupTitleDate = `${_d.getDate()} ${month.charAt(0).toUpperCase() + month.slice(1)} ${_d.getFullYear()}`;
        }

        let deudasVal = group.totalDeudas || 0;
        let deudasSign = deudasVal > 0 ? '+' : (deudasVal < 0 ? '-' : '');
        let deudasColor = deudasVal > 0 ? '#10b981' : (deudasVal < 0 ? '#f43f5e' : 'var(--text-dim)');
        let totalDeudasFormatted = deudasSign + formatCurrency(Math.abs(deudasVal));

        let pagosVal = group.totalPagos || 0;
        let pagosSign = pagosVal > 0 ? '+' : (pagosVal < 0 ? '-' : '');
        let pagosColor = pagosVal > 0 ? '#10b981' : (pagosVal < 0 ? '#f43f5e' : 'var(--text-dim)');
        let totalPagosFormatted = pagosSign + formatCurrency(Math.abs(pagosVal));

        const debtorBalanceAnterior = -(group.saldoAnterior || 0);
        const saldoAnteriorSign = debtorBalanceAnterior > 0 ? '+' : (debtorBalanceAnterior < 0 ? '-' : '');
        const saldoAnteriorFormatted = formatCurrency(Math.abs(debtorBalanceAnterior));

        const debtorBalance = -group.saldoPosterior;
        const saldoSign = debtorBalance > 0 ? '+' : (debtorBalance < 0 ? '-' : '');
        const saldoFormatted = formatCurrency(Math.abs(debtorBalance));

        let saldoAnteriorHtml = '';
        if (group.saldoAnterior !== undefined && debtorBalanceAnterior !== 0) {
            saldoAnteriorHtml = `
                    <div>
                        <div style="font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Saldo Anterior</div>
                        <div style="font-size: 0.9rem; color: var(--text-muted); font-weight: 700; line-height: 1;">${saldoAnteriorSign}${saldoAnteriorFormatted}</div>
                    </div>
            `;
        } else {
             saldoAnteriorHtml = `
                    <div>
                        <div style="font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Saldo Anterior</div>
                        <div style="font-size: 0.9rem; color: var(--text-muted); font-weight: 700; line-height: 1;">$0,00</div>
                    </div>
            `;
        }

        html += `
        <div class="history-group" style="margin-bottom: 32px; border-bottom: 1px dashed var(--glass-05); padding-bottom: 16px;">
            ${groupTitleDate ? `
            <div style="display: flex; align-items: center; gap: 12px; margin: 8px 8px 16px 8px;">
                <span style="color: var(--text-dim); font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">GRUPO DEL ${groupTitleDate}</span>
                <div style="flex: 1; height: 1px; background: var(--glass-05); border-radius: 1px;"></div>
            </div>
            ` : ''}
            
            <div style="background: var(--glass-02); border: 1px solid var(--border-glass); border-radius: 16px; padding: 12px 16px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    ${saldoAnteriorHtml}
                    <div style="text-align: right;">
                        <div style="font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Saldo Posterior</div>
                        <div style="font-size: 1rem; font-weight: 800; color: var(--text-main); line-height: 1;">${saldoSign}${saldoFormatted}</div>
                    </div>
                </div>
                <div style="height: 1px; background: var(--glass-05); margin-bottom: 12px;"></div>
                <div style="display: flex; justify-content: space-between;">
                    <div>
                        <div style="font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Deudas del grupo</div>
                        <div style="font-size: 0.95rem; color: ${deudasColor}; font-weight: 800; line-height: 1;">${totalDeudasFormatted}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Pagos del grupo</div>
                        <div style="font-size: 0.95rem; color: ${pagosColor}; font-weight: 800; line-height: 1;">${totalPagosFormatted}</div>
                    </div>
                </div>
            </div>
        `;

        group.pagos.forEach(item => { html += renderHistoryItem(item); });
        group.deudas.forEach(item => { html += renderHistoryItem(item); });
        
        html += `</div>`;
    });

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

        renderCredit(estadoCuenta.resumen.saldo_favor_disponible);
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
