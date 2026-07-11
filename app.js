// App State
let state = {
    categories: [],
    expenses: [],
    billingDay: 1,
    currentAnchorDate: new Date().toISOString(),
    activeChartType: 'categories' // 'categories' or 'trend'
};

// Global Chart.js instance
let chartInstance = null;

// Available Emojis for custom category creation
const EMOJIS = ['🍔', '🏠', '🚗', '🎮', '🛍️', '✈️', '💊', '🎓', '🎁', '🔧', '💡', '💰', '🍿', '👚', '🥦', '🏋️', '📚', '🐶', '🍕', '☕', '💅', '💈', '🎨', '🧸', '✈️', '🚗', '🚲', '🛒'];

// Premium Colors for category creation
const COLORS = [
    { name: 'סגול', hex: '#8b5cf6', alpha: 'rgba(139, 92, 246, 0.15)' },
    { name: 'אינדיגו', hex: '#6366f1', alpha: 'rgba(99, 102, 241, 0.15)' },
    { name: 'טורקיז', hex: '#14b8a6', alpha: 'rgba(20, 184, 166, 0.15)' },
    { name: 'ורוד', hex: '#f43f5e', alpha: 'rgba(244, 63, 94, 0.15)' },
    { name: 'ענבר', hex: '#f59e0b', alpha: 'rgba(245, 158, 11, 0.15)' },
    { name: 'כחול שמיים', hex: '#0ea5e9', alpha: 'rgba(14, 165, 233, 0.15)' },
    { name: 'ברקת', hex: '#10b981', alpha: 'rgba(16, 185, 129, 0.15)' }
];

// Helper: Formatter for Shekel Currency (RTL Hebrew style)
function formatCurrency(amount) {
    return new Intl.NumberFormat('he-IL', {
        style: 'currency',
        currency: 'ILS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount);
}

// Helper: Format Date to DD/MM/YYYY
function formatDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    return new Intl.DateTimeFormat('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
}

// Helper: Calculate Billing Period range (Start & End dates)
function getBillingPeriod(anchorDateStr, billingDay) {
    const anchor = new Date(anchorDateStr);
    const year = anchor.getFullYear();
    const month = anchor.getMonth(); // 0-11
    const day = anchor.getDate();

    let startYear = year;
    let startMonth = month;

    if (day < billingDay) {
        startMonth = month - 1;
        if (startMonth < 0) {
            startMonth = 11;
            startYear = year - 1;
        }
    }

    const maxDaysInStartMonth = new Date(startYear, startMonth + 1, 0).getDate();
    const actualStartDay = Math.min(billingDay, maxDaysInStartMonth);

    const startDate = new Date(startYear, startMonth, actualStartDay, 0, 0, 0, 0);

    let endMonth = startMonth + 1;
    let endYear = startYear;
    if (endMonth > 11) {
        endMonth = 0;
        endYear = startYear + 1;
    }

    const maxDaysInEndMonth = new Date(endYear, endMonth + 1, 0).getDate();
    let actualEndDay = billingDay - 1;

    let endDate;
    if (billingDay === 1 || actualEndDay <= 0) {
        endDate = new Date(endYear, endMonth, 0, 23, 59, 59, 999);
    } else {
        const finalEndDay = Math.min(actualEndDay, maxDaysInEndMonth);
        endDate = new Date(endYear, endMonth, finalEndDay, 23, 59, 59, 999);
    }

    return { start: startDate, end: endDate };
}

// Helper: Get expenses that belong to the active billing cycle
function getActiveExpenses() {
    const period = getBillingPeriod(state.currentAnchorDate, state.billingDay);
    return state.expenses.filter(exp => {
        const expTime = new Date(exp.date + 'T00:00:00').getTime();
        return expTime >= period.start.getTime() && expTime <= period.end.getTime();
    });
}

// Default initial state data
const DEFAULT_DATA = {
    categories: [
        { id: 'cat-1', name: 'קבועים', icon: '💳', budget: 3000, color: '#6366f1', colorAlpha: 'rgba(99, 102, 241, 0.15)' },
        { id: 'cat-2', name: 'מזון', icon: '🥦', budget: 1500, color: '#f59e0b', colorAlpha: 'rgba(245, 158, 11, 0.15)' },
        { id: 'cat-3', name: 'אוכל בחוץ', icon: '🍔', budget: 600, color: '#f43f5e', colorAlpha: 'rgba(244, 63, 94, 0.15)' },
        { id: 'cat-4', name: 'בגדים', icon: '🛍️', budget: 500, color: '#8b5cf6', colorAlpha: 'rgba(139, 92, 246, 0.15)' },
        { id: 'cat-5', name: 'פארמה', icon: '💊', budget: 300, color: '#14b8a6', colorAlpha: 'rgba(20, 184, 166, 0.15)' },
        { id: 'cat-6', name: 'חד פעמי', icon: '🥤', budget: 200, color: '#0ea5e9', colorAlpha: 'rgba(14, 165, 233, 0.15)' }
    ],
    expenses: [],
    billingDay: 1,
    currentAnchorDate: new Date().toISOString()
};

// Helper to calculate past date string (kept for future extensions)
function getPastDateString(daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
}

// Local Storage Backup Integration (for offline support)
function loadStateFromLocalStorage() {
    const saved = localStorage.getItem('finance_tracker_github');
    if (saved) {
        try {
            state = JSON.parse(saved);
            if (!state.activeChartType) state.activeChartType = 'categories';
            if (state.billingDay === undefined) state.billingDay = 1;
            if (!state.currentAnchorDate) state.currentAnchorDate = new Date().toISOString();
        } catch (e) {
            console.error('Error parsing local state, resetting to defaults.', e);
            state = JSON.parse(JSON.stringify(DEFAULT_DATA));
            state.activeChartType = 'categories';
            saveStateToLocalStorage();
        }
    } else {
        state = JSON.parse(JSON.stringify(DEFAULT_DATA));
        state.activeChartType = 'categories';
        saveStateToLocalStorage();
    }
}

function saveStateToLocalStorage() {
    localStorage.setItem('finance_tracker_github', JSON.stringify(state));
}

// Fetch Initial Data from Server
async function loadStateFromServer() {
    try {
        const res = await fetch('/api/init');
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        
        state.categories = data.categories || [];
        state.expenses = data.expenses || [];
        state.billingDay = data.billingDay || 1;
        state.currentAnchorDate = new Date().toISOString(); // Default to current date on load
    } catch (e) {
        console.warn('Backend server offline. Falling back to local storage.', e);
        loadStateFromLocalStorage();
    }
}

// DOM Elements
const totalProgressRing = document.getElementById('total-progress-ring');
const totalProgressPct = document.getElementById('total-progress-pct');
const statTotalBudget = document.getElementById('stat-total-budget');
const statTotalSpent = document.getElementById('stat-total-spent');
const statTotalRemaining = document.getElementById('stat-total-remaining');
const categoriesGrid = document.getElementById('categories-grid');
const filterCategory = document.getElementById('filter-category');
const searchTx = document.getElementById('search-tx');
const transactionsList = document.getElementById('transactions-list');
const expenseCategorySelect = document.getElementById('expense-category');

// Modals
const expenseModal = document.getElementById('expense-modal');
const categoryModal = document.getElementById('category-modal');
const budgetModal = document.getElementById('budget-modal');
const settingsModal = document.getElementById('settings-modal');

// Buttons
const btnOpenExpenseModal = document.getElementById('btn-open-expense-modal');
const btnOpenCategoryModal = document.getElementById('btn-open-category-modal');
const btnOpenSettingsModal = document.getElementById('btn-open-settings-modal');

// Month Switcher Elements
const btnPrevMonth = document.getElementById('btn-prev-month');
const btnNextMonth = document.getElementById('btn-next-month');
const activeMonthLabel = document.getElementById('active-month-label');
const activePeriodLabel = document.getElementById('active-period-label');

// Selected items in custom category form
let selectedEmoji = EMOJIS[0];
let selectedColorObj = COLORS[0];

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    buildPickers();
    
    // Set default date in expense modal to today
    document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
    
    // Show a loading text or indicator while fetching
    categoriesGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-icon">⏳</div>
            <div>מתחבר למסד הנתונים...</div>
        </div>`;
    
    await loadStateFromServer();
    updateSelectors();
    renderApp();
});

// Setup Form Pickers (Emoji & Colors)
function buildPickers() {
    const iconPicker = document.getElementById('icon-picker');
    iconPicker.innerHTML = '';
    EMOJIS.forEach((emoji, index) => {
        const item = document.createElement('div');
        item.className = 'picker-item' + (index === 0 ? ' selected' : '');
        item.textContent = emoji;
        item.addEventListener('click', () => {
            document.querySelectorAll('#icon-picker .picker-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            selectedEmoji = emoji;
        });
        iconPicker.appendChild(item);
    });

    const colorPicker = document.getElementById('color-picker');
    colorPicker.innerHTML = '';
    COLORS.forEach((color, index) => {
        const dot = document.createElement('div');
        dot.className = 'color-dot' + (index === 0 ? ' selected' : '');
        dot.style.backgroundColor = color.hex;
        dot.style.setProperty('--dot-color', color.hex);
        dot.addEventListener('click', () => {
            document.querySelectorAll('#color-picker .color-dot').forEach(el => el.classList.remove('selected'));
            dot.classList.add('selected');
            selectedColorObj = color;
        });
        colorPicker.appendChild(dot);
    });
}

// Update select inputs for transactions filter & adding expense
function updateSelectors() {
    // 1. Expense category dropdown
    expenseCategorySelect.innerHTML = '';
    state.categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = `${cat.icon} ${cat.name}`;
        expenseCategorySelect.appendChild(opt);
    });

    // 2. Filter category dropdown
    const currentFilterVal = filterCategory.value || 'all';
    filterCategory.innerHTML = '<option value="all">כל הקטגוריות</option>';
    state.categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = `${cat.icon} ${cat.name}`;
        filterCategory.appendChild(opt);
    });
    filterCategory.value = currentFilterVal;
}

// Event Listeners setup
function setupEventListeners() {
    // Modal toggle event listeners
    btnOpenExpenseModal.addEventListener('click', () => openModal(expenseModal));
    btnOpenCategoryModal.addEventListener('click', () => openModal(categoryModal));
    btnOpenSettingsModal.addEventListener('click', () => openModal(settingsModal));

    document.getElementById('btn-close-expense-modal').addEventListener('click', () => closeModal(expenseModal));
    document.getElementById('btn-cancel-expense').addEventListener('click', () => closeModal(expenseModal));

    document.getElementById('btn-close-category-modal').addEventListener('click', () => closeModal(categoryModal));
    document.getElementById('btn-cancel-category').addEventListener('click', () => closeModal(categoryModal));

    document.getElementById('btn-close-budget-modal').addEventListener('click', () => closeModal(budgetModal));
    document.getElementById('btn-cancel-budget').addEventListener('click', () => closeModal(budgetModal));

    document.getElementById('btn-close-settings-modal').addEventListener('click', () => closeModal(settingsModal));
    document.getElementById('btn-cancel-settings').addEventListener('click', () => closeModal(settingsModal));

    // Handle clicking outside modal content to close it
    [expenseModal, categoryModal, budgetModal, settingsModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });

    // Form Submissions
    document.getElementById('expense-form').addEventListener('submit', handleAddExpense);
    document.getElementById('category-form').addEventListener('submit', handleAddCategory);
    document.getElementById('budget-form').addEventListener('submit', handleUpdateBudget);
    document.getElementById('settings-form').addEventListener('submit', handleUpdateSettings);

    // Month Switcher Listeners
    btnPrevMonth.addEventListener('click', () => navigateMonth(-1));
    btnNextMonth.addEventListener('click', () => navigateMonth(1));

    // Filters and search
    filterCategory.addEventListener('change', renderTransactions);
    searchTx.addEventListener('input', renderTransactions);

    // Chart Tabs
    document.querySelectorAll('.chart-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.chart-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeChartType = btn.dataset.chart;
            saveState();
            renderCharts();
        });
    });
}

function navigateMonth(direction) {
    const current = new Date(state.currentAnchorDate);
    current.setMonth(current.getMonth() + direction);
    state.currentAnchorDate = current.toISOString();
    saveState();
    renderApp();
}

function openModal(modal) {
    modal.classList.add('active');
    // For expense modal, reset form fields but keep date as today
    if (modal === expenseModal) {
        document.getElementById('expense-amount').value = '';
        document.getElementById('expense-desc').value = '';
        document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
    } else if (modal === categoryModal) {
        document.getElementById('category-name').value = '';
        document.getElementById('category-budget').value = '';
        // Reset picker selections to first options
        document.querySelectorAll('#icon-picker .picker-item').forEach((el, idx) => {
            if (idx === 0) { el.classList.add('selected'); selectedEmoji = el.textContent; }
            else el.classList.remove('selected');
        });
        document.querySelectorAll('#color-picker .color-dot').forEach((el, idx) => {
            if (idx === 0) { el.classList.add('selected'); selectedColorObj = COLORS[idx]; }
            else el.classList.remove('selected');
        });
    } else if (modal === settingsModal) {
        document.getElementById('settings-billing-day').value = state.billingDay;
    }
}

function closeModal(modal) {
    modal.classList.remove('active');
}

// Add Expense Form Handler
async function handleAddExpense(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const categoryId = document.getElementById('expense-category').value;
    const date = document.getElementById('expense-date').value;
    const description = document.getElementById('expense-desc').value.trim();

    if (isNaN(amount) || amount <= 0 || !categoryId || !date || !description) {
        alert('נא למלא את כל השדות בצורה תקינה.');
        return;
    }

    const newExpense = {
        id: 'exp-' + Date.now(),
        amount,
        categoryId,
        date,
        description
    };

    try {
        const res = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newExpense)
        });
        if (!res.ok) throw new Error('API save failed');
        
        state.expenses.push(newExpense);
        saveStateToLocalStorage();
        closeModal(expenseModal);
        renderApp();
    } catch (err) {
        console.error('Error saving expense to server:', err);
        // Fallback for offline mode
        state.expenses.push(newExpense);
        saveStateToLocalStorage();
        closeModal(expenseModal);
        renderApp();
    }
}

// Add Category Form Handler
async function handleAddCategory(e) {
    e.preventDefault();
    const name = document.getElementById('category-name').value.trim();
    const budget = parseFloat(document.getElementById('category-budget').value);

    if (!name || isNaN(budget) || budget < 0) {
        alert('נא להזין שם קטגוריה ותקציב תקינים.');
        return;
    }

    // Check duplicate category name
    if (state.categories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
        alert('קטגוריה בשם זה כבר קיימת.');
        return;
    }

    const newCategory = {
        id: 'cat-' + Date.now(),
        name,
        icon: selectedEmoji,
        budget,
        color: selectedColorObj.hex,
        colorAlpha: selectedColorObj.alpha
    };

    try {
        const res = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCategory)
        });
        if (!res.ok) throw new Error('API save failed');
        
        state.categories.push(newCategory);
        saveStateToLocalStorage();
        closeModal(categoryModal);
        updateSelectors();
        renderApp();
    } catch (err) {
        console.error('Error saving category to server:', err);
        // Fallback for offline mode
        state.categories.push(newCategory);
        saveStateToLocalStorage();
        closeModal(categoryModal);
        updateSelectors();
        renderApp();
    }
}

// Update Budget Form Handler
async function handleUpdateBudget(e) {
    e.preventDefault();
    const categoryId = document.getElementById('edit-budget-category-id').value;
    const newBudget = parseFloat(document.getElementById('edit-category-budget').value);

    if (isNaN(newBudget) || newBudget < 0) {
        alert('נא להזין תקציב תקין.');
        return;
    }

    try {
        const res = await fetch(`/api/categories/${categoryId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ budget: newBudget })
        });
        if (!res.ok) throw new Error('API update failed');
        
        const catIndex = state.categories.findIndex(c => c.id === categoryId);
        if (catIndex !== -1) {
            state.categories[catIndex].budget = newBudget;
            saveStateToLocalStorage();
            closeModal(budgetModal);
            renderApp();
        }
    } catch (err) {
        console.error('Error updating budget to server:', err);
        // Fallback for offline mode
        const catIndex = state.categories.findIndex(c => c.id === categoryId);
        if (catIndex !== -1) {
            state.categories[catIndex].budget = newBudget;
            saveStateToLocalStorage();
            closeModal(budgetModal);
            renderApp();
        }
    }
}

// Update Billing Settings Handler
async function handleUpdateSettings(e) {
    e.preventDefault();
    const day = parseInt(document.getElementById('settings-billing-day').value);
    if (isNaN(day) || day < 1 || day > 31) {
        alert('נא להזין יום חיוב תקין בין 1 ל-31.');
        return;
    }
    
    try {
        const res = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ billingDay: day })
        });
        if (!res.ok) throw new Error('API update failed');
        
        state.billingDay = day;
        saveStateToLocalStorage();
        closeModal(settingsModal);
        renderApp();
    } catch (err) {
        console.error('Error updating settings to server:', err);
        // Fallback for offline mode
        state.billingDay = day;
        saveStateToLocalStorage();
        closeModal(settingsModal);
        renderApp();
    }
}

// Delete Expense Handler
async function deleteExpense(expenseId) {
    if (confirm('האם אתה בטוח שברצונך למחוק הוצאה זו?')) {
        try {
            const res = await fetch(`/api/expenses/${expenseId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('API delete failed');
            
            state.expenses = state.expenses.filter(exp => exp.id !== expenseId);
            saveStateToLocalStorage();
            renderApp();
        } catch (err) {
            console.error('Error deleting expense from server:', err);
            // Fallback for offline mode
            state.expenses = state.expenses.filter(exp => exp.id !== expenseId);
            saveStateToLocalStorage();
            renderApp();
        }
    }
}

// Delete Category Handler (with confirmation)
async function deleteCategory(categoryId) {
    const category = state.categories.find(c => c.id === categoryId);
    if (!category) return;

    if (confirm(`האם אתה בטוח שברצונך למחוק את הקטגוריה "${category.name}"?\nשים לב: מחיקת הקטגוריה תמחק לצמיתות גם את כל ההוצאות המשויכות אליה!`)) {
        try {
            const res = await fetch(`/api/categories/${categoryId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('API delete failed');
            
            state.categories = state.categories.filter(c => c.id !== categoryId);
            state.expenses = state.expenses.filter(e => e.categoryId !== categoryId);
            saveStateToLocalStorage();
            updateSelectors();
            renderApp();
        } catch (err) {
            console.error('Error deleting category from server:', err);
            // Fallback for offline mode
            state.categories = state.categories.filter(c => c.id !== categoryId);
            state.expenses = state.expenses.filter(e => e.categoryId !== categoryId);
            saveStateToLocalStorage();
            updateSelectors();
            renderApp();
        }
    }
}

// Open Inline Edit Budget Modal
function openEditBudgetModal(categoryId) {
    const category = state.categories.find(c => c.id === categoryId);
    if (!category) return;

    document.getElementById('edit-budget-category-id').value = categoryId;
    document.getElementById('edit-category-budget').value = category.budget;
    document.getElementById('budget-modal-title').textContent = `עדכון יעד תקציב עבור ${category.icon} ${category.name}`;
    openModal(budgetModal);
}

// Main Render Loop
function renderApp() {
    renderDashboard();
    renderCategoryCards();
    renderTransactions();
    renderCharts();
}

// Render Dashboard totals and progress ring
function renderDashboard() {
    const activeExpenses = getActiveExpenses();
    const period = getBillingPeriod(state.currentAnchorDate, state.billingDay);
    
    // Render Month Switcher Labels
    const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
    const anchor = new Date(state.currentAnchorDate);
    activeMonthLabel.textContent = `${monthNames[anchor.getMonth()]} ${anchor.getFullYear()}`;
    activePeriodLabel.textContent = `${formatDate(period.start)} - ${formatDate(period.end)}`;

    // Total Budget
    const totalBudget = state.categories.reduce((acc, cat) => acc + cat.budget, 0);
    // Total Spent
    const totalSpent = activeExpenses.reduce((acc, exp) => acc + exp.amount, 0);
    // Remaining Budget
    const totalRemaining = totalBudget - totalSpent;

    statTotalBudget.textContent = formatCurrency(totalBudget);
    statTotalSpent.textContent = formatCurrency(totalSpent);
    
    const remainingEl = statTotalRemaining;
    remainingEl.textContent = formatCurrency(totalRemaining);
    if (totalRemaining >= 0) {
        remainingEl.className = 'stat-val positive';
    } else {
        remainingEl.className = 'stat-val negative';
    }

    // Total Progress Ring Calculation
    let pct = 0;
    if (totalBudget > 0) {
        pct = Math.round((totalSpent / totalBudget) * 100);
    }
    totalProgressPct.textContent = `${pct}%`;

    // SVG dash offset
    // Radius of circle is 75 -> Circumference = 2 * PI * 75 = 471.24
    const circumference = 471.24;
    let offset = circumference;
    if (pct > 0) {
        // Cap visual fills at 100% (offset 0)
        const cappedPct = Math.min(pct, 100);
        offset = circumference - (cappedPct / 100) * circumference;
    }
    totalProgressRing.style.strokeDashoffset = offset;
}

// Render Category Card Grid
function renderCategoryCards() {
    categoriesGrid.innerHTML = '';
    const activeExpenses = getActiveExpenses();

    if (state.categories.length === 0) {
        categoriesGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-icon">📁</div>
                <div>אין קטגוריות פעילות. צור קטגוריה חדשה כדי להתחיל לעקוב!</div>
            </div>`;
        return;
    }

    state.categories.forEach(cat => {
        // Sum expenses in this category
        const spent = activeExpenses
            .filter(exp => exp.categoryId === cat.id)
            .reduce((acc, exp) => acc + exp.amount, 0);
        
        const remaining = cat.budget - spent;
        
        let pct = 0;
        if (cat.budget > 0) {
            pct = (spent / cat.budget) * 100;
        }

        // Determine visual color representation based on consumption status
        let statusColor = 'var(--status-safe)';
        let statusClass = 'status-badge-safe';
        let statusText = 'תקין';
        
        if (pct >= 100) {
            statusColor = 'var(--status-danger)';
            statusClass = 'status-badge-danger';
            statusText = 'חריגה!';
        } else if (pct >= 75) {
            statusColor = 'var(--status-warning)';
            statusClass = 'status-badge-warning';
            statusText = 'מתקרב לגבול';
        }

        // Render card
        const card = document.createElement('div');
        card.className = 'glass-card category-card';
        card.style.setProperty('--theme-color', cat.color);
        card.style.setProperty('--theme-color-alpha', cat.colorAlpha);
        card.style.setProperty('--status-color', statusColor);

        // Limit progress bar rendering to 100% width visually
        const visualBarWidth = Math.min(pct, 100);

        card.innerHTML = `
            <div class="category-header">
                <div class="category-title-icon">
                    <div class="category-icon">${cat.icon}</div>
                    <div>
                        <div class="category-name">${cat.name}</div>
                        <div class="category-budget-limit">יעד חודשי: <span style="cursor: pointer; text-decoration: underline;" onclick="window.triggerEditBudget('${cat.id}')">${formatCurrency(cat.budget)}</span></div>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                    <button class="btn-danger-link btn-icon btn-close" style="font-size: 13px; width: 24px; height: 24px;" onclick="window.triggerDeleteCategory('${cat.id}')" title="מחק קטגוריה">🗑️</button>
                </div>
            </div>
            <div class="category-budget-numbers">
                <div class="category-spent">${formatCurrency(spent)}</div>
                <div class="category-remaining" style="color: ${remaining >= 0 ? 'var(--text-secondary)' : 'var(--status-danger)'}">
                    ${remaining >= 0 ? `נותר: ${formatCurrency(remaining)}` : `חריגה של: ${formatCurrency(Math.abs(remaining))}`}
                </div>
            </div>
            <div class="progress-bar-wrapper">
                <div class="progress-bar-fill" style="width: ${visualBarWidth}%"></div>
            </div>
            <div class="progress-indicator-text">
                <span>ניצול: ${Math.round(pct)}%</span>
                <span>${formatCurrency(spent)} / ${formatCurrency(cat.budget)}</span>
            </div>
        `;
        categoriesGrid.appendChild(card);
    });
}

// Expose click functions to global window scope safely for inline elements
window.triggerEditBudget = function(categoryId) {
    openEditBudgetModal(categoryId);
};

window.triggerDeleteCategory = function(categoryId) {
    deleteCategory(categoryId);
};

// Render recent transactions with search & filter applied
function renderTransactions() {
    transactionsList.innerHTML = '';
    const filterVal = filterCategory.value;
    const searchVal = searchTx.value.trim().toLowerCase();

    // Filter logic
    let filtered = getActiveExpenses().filter(exp => {
        const categoryMatch = filterVal === 'all' || exp.categoryId === filterVal;
        const descriptionMatch = exp.description.toLowerCase().includes(searchVal);
        return categoryMatch && descriptionMatch;
    });

    // Sort by date descending, secondary by creation (id is exp-[timestamp])
    filtered.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA.getTime() !== dateB.getTime()) {
            return dateB.getTime() - dateA.getTime();
        }
        return b.id.localeCompare(a.id);
    });

    if (filtered.length === 0) {
        transactionsList.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <div class="empty-icon">💸</div>
                    <div>לא נמצאו הוצאות התואמות את החיפוש.</div>
                </td>
            </tr>`;
        return;
    }

    filtered.forEach(exp => {
        // Find category styling metadata
        const category = state.categories.find(c => c.id === exp.categoryId) || {
            name: 'כללי',
            icon: '🏷️',
            color: '#9ca3af',
            colorAlpha: 'rgba(156, 163, 175, 0.15)'
        };

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="tx-category-badge" style="--theme-color: ${category.color}; --theme-color-alpha: ${category.colorAlpha}">
                    <span>${category.icon}</span>
                    <span>${category.name}</span>
                </div>
            </td>
            <td>
                <div style="font-weight: 500;">${exp.description}</div>
            </td>
            <td style="text-align: center;" class="tx-date">
                <span>${formatDate(exp.date)}</span>
            </td>
            <td style="text-align: left;" class="tx-amount negative">
                <span>-${formatCurrency(exp.amount)}</span>
            </td>
            <td style="text-align: center;">
                <button class="btn btn-danger-link btn-icon btn-close" style="font-size: 14px;" onclick="window.triggerDeleteExpense('${exp.id}')">🗑️</button>
            </td>
        `;
        transactionsList.appendChild(tr);
    });
}

// Expose click function to global window scope safely for table elements
window.triggerDeleteExpense = function(expenseId) {
    deleteExpense(expenseId);
};

// Render Visual Analytics (Chart.js)
function renderCharts() {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const activeExpenses = getActiveExpenses();
    const period = getBillingPeriod(state.currentAnchorDate, state.billingDay);
    
    // Destroy previous Chart instance if active
    if (chartInstance) {
        chartInstance.destroy();
    }

    if (activeExpenses.length === 0 || state.categories.length === 0) {
        // Render Empty state overlay on chart container if no data is available
        ctx.clearRect(0, 0, 400, 400);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '16px Assistant';
        ctx.textAlign = 'center';
        ctx.fillText('אין מספיק נתונים להצגת תרשימים במחזור זה. הוסף הוצאות כדי לצפות בגרפים.', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    if (state.activeChartType === 'categories') {
        // DOUGHNUT CHART - Category distribution
        const catSpentMap = {};
        state.categories.forEach(c => { catSpentMap[c.id] = 0; });
        activeExpenses.forEach(exp => {
            if (catSpentMap[exp.categoryId] !== undefined) {
                catSpentMap[exp.categoryId] += exp.amount;
            }
        });

        // Filter out categories with zero expenditure to make the graph beautiful
        const chartData = state.categories
            .map(c => ({
                label: `${c.icon} ${c.name}`,
                value: catSpentMap[c.id],
                color: c.color
            }))
            .filter(d => d.value > 0);

        if (chartData.length === 0) {
            ctx.clearRect(0, 0, 400, 400);
            ctx.fillStyle = '#9ca3af';
            ctx.font = '16px Assistant';
            ctx.textAlign = 'center';
            ctx.fillText('כל ההוצאות כרגע עומדות על ₪0. הזן הוצאות פעילות.', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartData.map(d => d.label),
                datasets: [{
                    data: chartData.map(d => d.value),
                    backgroundColor: chartData.map(d => d.color),
                    borderColor: '#111827', // Matching page dark background
                    borderWidth: 2,
                    hoverOffset: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                rtl: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#e5e7eb',
                            font: { family: 'Assistant', size: 13, weight: '600' },
                            padding: 15
                        }
                    },
                    tooltip: {
                        rtl: true,
                        titleFont: { family: 'Assistant', size: 14 },
                        bodyFont: { family: 'Assistant', size: 14 },
                        callbacks: {
                            label: function(context) {
                                return ` הוצאה: ${formatCurrency(context.raw)}`;
                            }
                        }
                    }
                },
                cutout: '68%'
            }
        });

    } else {
        // LINE CHART - Daily Trend over the active billing cycle
        const trendData = [];
        const dateLabels = [];
        
        // Loop day-by-day from start to end of billing cycle
        const currentDate = new Date(period.start);
        const endDate = new Date(period.end);
        
        while (currentDate <= endDate) {
            const dateString = currentDate.toISOString().split('T')[0];
            
            // Format for label display: DD/MM
            const labelStr = `${String(currentDate.getDate()).padStart(2, '0')}/${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            dateLabels.push(labelStr);
            
            // Sum expenses on this date
            const daySum = activeExpenses
                .filter(exp => exp.date === dateString)
                .reduce((acc, exp) => acc + exp.amount, 0);
            trendData.push(daySum);
            
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Gradient configuration for a glowing trend line
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.45)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dateLabels,
                datasets: [{
                    label: 'הוצאות לפי יום',
                    data: trendData,
                    borderColor: '#6366f1',
                    borderWidth: 3,
                    pointBackgroundColor: '#8b5cf6',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1.5,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.3,
                    fill: true,
                    backgroundColor: gradient
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                rtl: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        rtl: true,
                        titleFont: { family: 'Assistant', size: 13 },
                        bodyFont: { family: 'Assistant', size: 13 },
                        callbacks: {
                            label: function(context) {
                                return ` סך ההוצאות: ${formatCurrency(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#9ca3af',
                            font: { family: 'Assistant', size: 11 }
                        }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#9ca3af',
                            font: { family: 'Assistant', size: 11 },
                            callback: function(value) {
                                return '₪' + value;
                            }
                        }
                    }
                }
            }
        });
    }
}
