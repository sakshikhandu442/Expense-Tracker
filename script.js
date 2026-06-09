const STORAGE_KEY = "expenseTracker.records";
const USERS_KEY = "expenseTracker.users";
const AUTH_KEY = "expenseTracker.session";
const CURRENCY_KEY = "expenseTracker.currency";
const INCOME_KEY = "expenseTracker.monthlyIncome";

const PUBLIC_PAGES = ["login.html", "register.html", "logout.html"];
const PROTECTED_PAGES = ["index.html", "dashboard.html", "graph.html", "about.html", "contact.html"];

const categoryColors = {
  Food: "#14b8a6",
  Transport: "#3b82f6",
  Bills: "#f97316",
  Shopping: "#ec4899",
  Entertainment: "#8b5cf6",
  Health: "#22c55e",
  Others: "#64748b"
};

const SESSION_KEYS = [
  "token",
  "authToken",
  "sessionToken",
  "currentUser",
  "userEmail",
  "expenseTracker.user",
  AUTH_KEY
];

let fallbackExpenses = [];
let editingExpenseId = null;

function initAuthGuard() {
  const page = getCurrentPage();
  const loggedIn = isLoggedIn();

  if (PROTECTED_PAGES.includes(page) && !loggedIn) {
    window.location.replace(`login.html?next=${encodeURIComponent(page)}`);
    return false;
  }

  if ((page === "login.html" || page === "register.html") && loggedIn) {
    window.location.replace("index.html");
    return false;
  }

  return true;
}

function getCurrentPage() {
  return window.location.pathname.split("/").pop() || "login.html";
}

function isLoggedIn() {
  return Boolean(getCurrentSession());
}

function getCurrentSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY));
  } catch (error) {
    return null;
  }
}

function setCurrentSession(user) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({
    email: user.email,
    name: user.name,
    loginAt: new Date().toISOString()
  }));
}

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
  } catch (error) {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function getNextPage() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");
  return next && !PUBLIC_PAGES.includes(next) ? next : "index.html";
}

function readExpenses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (error) {
    return fallbackExpenses;
  }
}

function saveExpenses(expenses) {
  fallbackExpenses = expenses;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  } catch (error) {
    return;
  }
}

function getCurrency() {
  return localStorage.getItem(CURRENCY_KEY) || "INR";
}

function setCurrency(currency) {
  localStorage.setItem(CURRENCY_KEY, currency);
}

function getMonthlyIncome() {
  return Number(localStorage.getItem(INCOME_KEY)) || 0;
}

function setMonthlyIncome(value) {
  localStorage.setItem(INCOME_KEY, String(value));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: getCurrency(),
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(value) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function getTodayValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthKey(value = getTodayValue()) {
  return value.slice(0, 7);
}

function groupByCategory(expenses) {
  return expenses.reduce((totals, expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
    return totals;
  }, {});
}

function groupByMonth(expenses) {
  return expenses.reduce((totals, expense) => {
    const key = getMonthKey(expense.date);
    totals[key] = (totals[key] || 0) + expense.amount;
    return totals;
  }, {});
}

function getTotal(expenses) {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

function getTopCategory(expenses) {
  const totals = groupByCategory(expenses);
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries[0][0] : "None";
}

function getFilteredExpenses(expenses) {
  const search = document.getElementById("filter-search")?.value.trim().toLowerCase() || "";
  const category = document.getElementById("filter-category")?.value || "";
  const fromDate = document.getElementById("filter-from")?.value || "";
  const toDate = document.getElementById("filter-to")?.value || "";

  return expenses.filter((expense) => {
    const matchesSearch = !search || expense.description.toLowerCase().includes(search);
    const matchesCategory = !category || expense.category === category;
    const afterFrom = !fromDate || expense.date >= fromDate;
    const beforeTo = !toDate || expense.date <= toDate;
    return matchesSearch && matchesCategory && afterFrom && beforeTo;
  });
}

function initLoginPage() {
  const form = document.getElementById("login-form");

  if (!form) {
    return;
  }

  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const message = document.getElementById("auth-message");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = normalizeEmail(emailInput.value);
    const password = passwordInput.value;
    const users = readUsers();
    const user = users[email];

    if (!user || user.password !== password) {
      showAuthMessage(message, "Please register first or enter the correct password.", true);
      return;
    }

    setCurrentSession(user);
    showAuthMessage(message, "Login successful. Opening tracker...", false);
    window.location.href = getNextPage();
  });
}

function initRegisterPage() {
  const form = document.getElementById("register-form");

  if (!form) {
    return;
  }

  const nameInput = document.getElementById("register-name");
  const emailInput = document.getElementById("register-email");
  const passwordInput = document.getElementById("register-password");
  const confirmInput = document.getElementById("register-confirm");
  const message = document.getElementById("auth-message");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = nameInput.value.trim();
    const email = normalizeEmail(emailInput.value);
    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;
    const users = readUsers();

    if (password.length < 4) {
      showAuthMessage(message, "Password must be at least 4 characters.", true);
      return;
    }

    if (password !== confirmPassword) {
      showAuthMessage(message, "Passwords do not match.", true);
      return;
    }

    if (users[email]) {
      showAuthMessage(message, "This email is already registered. Please login.", true);
      return;
    }

    const user = { name, email, password };
    users[email] = user;
    saveUsers(users);
    setCurrentSession(user);
    showAuthMessage(message, "Account created. Opening tracker...", false);
    window.location.href = "index.html";
  });
}

function showAuthMessage(element, text, isError) {
  element.textContent = text;
  element.classList.toggle("is-error", isError);
  element.classList.toggle("is-success", !isError);
}

function initTrackerPage() {
  const form = document.getElementById("expense-form");

  if (!form) {
    return;
  }

  const dateInput = document.getElementById("date");
  const clearButton = document.getElementById("clear-all");
  const cancelEditButton = document.getElementById("cancel-edit");
  const currencyInput = document.getElementById("currency");

  dateInput.value = getTodayValue();
  currencyInput.value = getCurrency();
  renderTracker();

  form.addEventListener("submit", handleExpenseSubmit);
  clearButton.addEventListener("click", handleClearAll);
  cancelEditButton.addEventListener("click", resetExpenseForm);

  currencyInput.addEventListener("change", () => {
    setCurrency(currencyInput.value);
    renderTracker();
  });

  ["filter-search", "filter-category", "filter-from", "filter-to"].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderTracker);
  });

  document.getElementById("reset-filters").addEventListener("click", () => {
    ["filter-search", "filter-category", "filter-from", "filter-to"].forEach((id) => {
      document.getElementById(id).value = "";
    });
    renderTracker();
  });
}

function handleExpenseSubmit(event) {
  event.preventDefault();

  const descriptionInput = document.getElementById("description");
  const amountInput = document.getElementById("amount");
  const categoryInput = document.getElementById("category");
  const dateInput = document.getElementById("date");
  const description = descriptionInput.value.trim();
  const amount = Number(amountInput.value);
  const category = categoryInput.value;
  const date = dateInput.value;

  if (!description || !category || !date || !Number.isFinite(amount) || amount <= 0) {
    alert("Please enter a description, valid amount, category, and date.");
    return;
  }

  const expenses = readExpenses();

  if (editingExpenseId) {
    const updatedExpenses = expenses.map((expense) => (
      expense.id === editingExpenseId
        ? { ...expense, description, amount, category, date }
        : expense
    ));
    saveExpenses(updatedExpenses);
  } else {
    const hasRandomId = window.crypto && typeof window.crypto.randomUUID === "function";
    expenses.unshift({
      id: hasRandomId ? window.crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      description,
      amount,
      category,
      date
    });
    saveExpenses(expenses);
  }

  resetExpenseForm();
  renderTracker();
}

function handleClearAll() {
  if (!readExpenses().length) {
    return;
  }

  const shouldClear = confirm("Clear all saved expenses?");
  if (shouldClear) {
    saveExpenses([]);
    resetExpenseForm();
    renderTracker();
  }
}

function resetExpenseForm() {
  editingExpenseId = null;
  document.getElementById("expense-form").reset();
  document.getElementById("date").value = getTodayValue();
  document.getElementById("currency").value = getCurrency();
  document.getElementById("expense-form-title").textContent = "Add Expense";
  document.getElementById("submit-expense").textContent = "Add Expense";
  document.getElementById("cancel-edit").hidden = true;
}

function startEditExpense(id) {
  const expense = readExpenses().find((item) => item.id === id);

  if (!expense) {
    return;
  }

  editingExpenseId = id;
  document.getElementById("description").value = expense.description;
  document.getElementById("amount").value = expense.amount;
  document.getElementById("category").value = expense.category;
  document.getElementById("date").value = expense.date;
  document.getElementById("expense-form-title").textContent = "Edit Expense";
  document.getElementById("submit-expense").textContent = "Update Expense";
  document.getElementById("cancel-edit").hidden = false;
  document.getElementById("description").focus();
}

function renderTracker() {
  const expenses = readExpenses();
  const filteredExpenses = getFilteredExpenses(expenses);
  const list = document.getElementById("expenses-list");
  const tableWrap = document.getElementById("records-table-wrap");
  const emptyState = document.getElementById("empty-state");
  const emptyTitle = document.getElementById("empty-title");
  const emptyCopy = document.getElementById("empty-copy");
  const today = getTodayValue();
  const monthKey = getMonthKey();
  const todayTotal = expenses
    .filter((expense) => expense.date === today)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const monthTotal = expenses
    .filter((expense) => getMonthKey(expense.date) === monthKey)
    .reduce((sum, expense) => sum + expense.amount, 0);

  document.getElementById("total-spent").textContent = formatCurrency(getTotal(expenses));
  document.getElementById("expense-count").textContent = expenses.length;
  document.getElementById("top-category").textContent = getTopCategory(expenses);
  document.getElementById("today-total").textContent = formatCurrency(todayTotal);
  document.getElementById("month-total").textContent = formatCurrency(monthTotal);

  list.innerHTML = "";
  emptyState.hidden = filteredExpenses.length > 0;
  tableWrap.hidden = filteredExpenses.length === 0;

  if (!expenses.length) {
    emptyTitle.textContent = "No expenses yet";
    emptyCopy.textContent = "Add your first expense to see records and update the graph.";
  } else if (!filteredExpenses.length) {
    emptyTitle.textContent = "No matching records";
    emptyCopy.textContent = "Try changing the search, category, or date filters.";
  }

  filteredExpenses.forEach((expense) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(expense.description)}</strong></td>
      <td><span class="category-pill" style="--pill-color: ${categoryColors[expense.category] || categoryColors.Others}">${escapeHtml(expense.category)}</span></td>
      <td>${formatDate(expense.date)}</td>
      <td>${formatCurrency(expense.amount)}</td>
      <td>
        <div class="table-actions">
          <button class="edit-btn" type="button" data-id="${expense.id}">Edit</button>
          <button class="delete-btn" type="button" data-id="${expense.id}">Delete</button>
        </div>
      </td>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll(".edit-btn").forEach((button) => {
    button.addEventListener("click", () => startEditExpense(button.dataset.id));
  });

  list.querySelectorAll(".delete-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const nextExpenses = readExpenses().filter((expense) => expense.id !== button.dataset.id);
      saveExpenses(nextExpenses);
      if (editingExpenseId === button.dataset.id) {
        resetExpenseForm();
      }
      renderTracker();
    });
  });
}

function initGraphPage() {
  const canvas = document.getElementById("expense-chart");

  if (!canvas) {
    return;
  }

  renderGraph();
}

function initDashboardPage() {
  const dashboard = document.getElementById("monthly-expense-chart");

  if (!dashboard) {
    return;
  }

  const incomeInput = document.getElementById("monthly-income");
  const saveIncome = document.getElementById("save-income");

  incomeInput.value = getMonthlyIncome() || "";
  saveIncome.addEventListener("click", () => {
    const income = Number(incomeInput.value);

    if (!Number.isFinite(income) || income < 0) {
      alert("Please enter a valid monthly income.");
      return;
    }

    setMonthlyIncome(income);
    renderDashboard();
  });

  renderDashboard();
}

function initLogoutPage() {
  const logoutPage = document.getElementById("logout-page");

  if (!logoutPage) {
    return;
  }

  const expenses = readExpenses();
  const recordCount = document.getElementById("logout-record-count");
  const savedTotal = document.getElementById("logout-saved-total");

  clearSessionOnly();

  recordCount.textContent = expenses.length;
  savedTotal.textContent = formatCurrency(getTotal(expenses));
}

function clearSessionOnly() {
  SESSION_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch (error) {
      return;
    }
  });
  updateAuthNavigation();
}

function updateAuthNavigation() {
  const loggedIn = isLoggedIn();

  document.querySelectorAll('a[href="login.html"]').forEach((link) => {
    link.hidden = loggedIn;
  });

  document.querySelectorAll('a[href="logout.html"]').forEach((link) => {
    link.hidden = !loggedIn && getCurrentPage() !== "logout.html";
  });
}

function renderGraph() {
  const expenses = readExpenses();
  const totals = groupByCategory(expenses);
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const canvas = document.getElementById("expense-chart");
  const empty = document.getElementById("chart-empty");
  const breakdown = document.getElementById("category-breakdown");
  const graphTotal = document.getElementById("graph-total");
  const ctx = canvas.getContext("2d");
  const currentMonthTotal = expenses
    .filter((expense) => getMonthKey(expense.date) === getMonthKey())
    .reduce((sum, expense) => sum + expense.amount, 0);
  const largest = expenses.reduce((max, expense) => Math.max(max, expense.amount), 0);
  const average = expenses.length ? total / expenses.length : 0;

  graphTotal.textContent = formatCurrency(total);
  document.getElementById("graph-month-total").textContent = formatCurrency(currentMonthTotal);
  document.getElementById("graph-average").textContent = formatCurrency(average);
  document.getElementById("graph-largest").textContent = formatCurrency(largest);
  breakdown.innerHTML = "";
  empty.hidden = total > 0;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!total) {
    drawEmptyChart(ctx, canvas);
  } else {
    drawDoughnutChart(ctx, canvas, entries, total);
  }

  entries.forEach(([category, amount]) => {
    const percentage = Math.round((amount / total) * 100);
    const item = document.createElement("li");
    item.innerHTML = `
      <span class="category-key" style="--key-color: ${categoryColors[category] || categoryColors.Others}"></span>
      <div>
        <strong>${escapeHtml(category)}</strong>
        <small>${percentage}% of total</small>
      </div>
      <span>${formatCurrency(amount)}</span>
    `;
    breakdown.appendChild(item);
  });

  renderMonthlyBars(expenses);
}

function renderMonthlyBars(expenses) {
  const container = document.getElementById("monthly-bars");
  const totals = groupByMonth(expenses);
  const entries = Object.entries(totals).sort((a, b) => a[0].localeCompare(b[0]));
  const max = entries.reduce((largest, [, value]) => Math.max(largest, value), 0);

  container.innerHTML = "";

  if (!entries.length) {
    container.innerHTML = '<p class="muted-copy">No monthly data yet.</p>';
    return;
  }

  entries.forEach(([month, amount]) => {
    const width = max ? Math.max((amount / max) * 100, 8) : 0;
    const row = document.createElement("div");
    row.className = "monthly-row";
    row.innerHTML = `
      <span>${formatMonth(month)}</span>
      <div class="monthly-track"><span style="width: ${width}%"></span></div>
      <strong>${formatCurrency(amount)}</strong>
    `;
    container.appendChild(row);
  });
}

function renderDashboard() {
  const expenses = readExpenses();
  const monthlyIncome = getMonthlyIncome();
  const months = getRecentMonths(6);
  const expenseByMonth = groupByMonth(expenses);
  const expenseValues = months.map((month) => expenseByMonth[month] || 0);
  const incomeValues = months.map(() => monthlyIncome);
  const savingsValues = months.map((month) => monthlyIncome - (expenseByMonth[month] || 0));
  const thisMonthExpense = expenseByMonth[getMonthKey()] || 0;

  document.getElementById("monthly-income").value = monthlyIncome || "";
  document.getElementById("dashboard-income").textContent = formatCurrency(monthlyIncome);
  document.getElementById("dashboard-expense").textContent = formatCurrency(thisMonthExpense);
  document.getElementById("dashboard-savings").textContent = formatCurrency(monthlyIncome - thisMonthExpense);

  drawBarChart(
    document.getElementById("monthly-expense-chart"),
    months.map(formatShortMonth),
    expenseValues,
    "#2563eb"
  );
  drawPieChart(
    document.getElementById("category-analysis-chart"),
    Object.entries(groupByCategory(expenses)).sort((a, b) => b[1] - a[1])
  );
  drawLineChart(
    document.getElementById("income-expense-chart"),
    months.map(formatShortMonth),
    [
      { label: "Income", values: incomeValues, color: "#0d9488" },
      { label: "Expense", values: expenseValues, color: "#e11d48" }
    ]
  );
  drawLineChart(
    document.getElementById("savings-trend-chart"),
    months.map(formatShortMonth),
    [
      { label: "Savings", values: savingsValues, color: "#d97706" }
    ],
    true
  );
}

function getRecentMonths(count) {
  const months = [];
  const current = new Date();

  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(current.getFullYear(), current.getMonth() - index, 1);
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }

  return months;
}

function formatShortMonth(monthKey) {
  const [year, month] = monthKey.split("-");
  return new Intl.DateTimeFormat("en-IN", {
    month: "short"
  }).format(new Date(Number(year), Number(month) - 1, 1));
}

function drawBarChart(canvas, labels, values, color) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = 44;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const max = Math.max(...values, 1);

  clearCanvas(ctx, width, height);
  drawChartTitle(ctx, "Monthly expense total");
  drawAxis(ctx, padding, height - padding, width - padding, padding);

  values.forEach((value, index) => {
    const barWidth = chartWidth / values.length - 18;
    const x = padding + index * (chartWidth / values.length) + 9;
    const barHeight = (value / max) * (chartHeight - 20);
    const y = height - padding - barHeight;

    ctx.fillStyle = color;
    roundRect(ctx, x, y, barWidth, barHeight, 8);
    ctx.fill();

    ctx.fillStyle = "#64748b";
    ctx.font = "700 13px Arial";
    ctx.textAlign = "center";
    ctx.fillText(labels[index], x + barWidth / 2, height - 18);
  });

  if (!values.some(Boolean)) {
    drawNoData(ctx, width, height, "No monthly expenses yet");
  }
}

function drawPieChart(canvas, entries) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const centerX = width * 0.35;
  const centerY = height * 0.55;
  const radius = 88;
  let startAngle = -Math.PI / 2;

  clearCanvas(ctx, width, height);
  drawChartTitle(ctx, "Category share");

  if (!total) {
    drawNoData(ctx, width, height, "No category data yet");
    return;
  }

  entries.forEach(([category, value]) => {
    const angle = (value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.fillStyle = categoryColors[category] || categoryColors.Others;
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + angle);
    ctx.closePath();
    ctx.fill();
    startAngle += angle;
  });

  entries.slice(0, 6).forEach(([category, value], index) => {
    const x = width * 0.62;
    const y = 84 + index * 32;
    const percent = Math.round((value / total) * 100);

    ctx.fillStyle = categoryColors[category] || categoryColors.Others;
    roundRect(ctx, x, y - 12, 14, 14, 4);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 14px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`${category} ${percent}%`, x + 24, y);
  });
}

function drawLineChart(canvas, labels, series, fillArea = false) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = 46;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const allValues = series.flatMap((item) => item.values);
  const max = Math.max(...allValues, 1);
  const min = Math.min(...allValues, 0);
  const range = max - min || 1;

  clearCanvas(ctx, width, height);
  drawChartTitle(ctx, fillArea ? "Savings trend" : "Income compared with expense");
  drawAxis(ctx, padding, height - padding, width - padding, padding);

  labels.forEach((label, index) => {
    const x = padding + index * (chartWidth / Math.max(labels.length - 1, 1));
    ctx.fillStyle = "#64748b";
    ctx.font = "700 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(label, x, height - 18);
  });

  series.forEach((item, seriesIndex) => {
    const points = item.values.map((value, index) => ({
      x: padding + index * (chartWidth / Math.max(item.values.length - 1, 1)),
      y: height - padding - ((value - min) / range) * chartHeight
    }));

    if (fillArea && points.length) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, height - padding);
      points.forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.lineTo(points[points.length - 1].x, height - padding);
      ctx.closePath();
      ctx.fillStyle = "rgba(217, 119, 6, 0.16)";
      ctx.fill();
    }

    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 4;
    ctx.stroke();

    points.forEach((point) => {
      ctx.beginPath();
      ctx.fillStyle = "#ffffff";
      ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 3;
      ctx.stroke();
    });

    drawLegendItem(ctx, item.label, item.color, width - 160, 36 + seriesIndex * 24);
  });
}

function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
}

function drawChartTitle(ctx, title) {
  ctx.fillStyle = "#0f172a";
  ctx.font = "800 18px Arial";
  ctx.textAlign = "left";
  ctx.fillText(title, 24, 34);
}

function drawAxis(ctx, left, bottom, right, top) {
  ctx.strokeStyle = "#dbe5ef";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.stroke();
}

function drawLegendItem(ctx, label, color, x, y) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y - 12, 14, 14, 4);
  ctx.fill();
  ctx.fillStyle = "#334155";
  ctx.font = "700 13px Arial";
  ctx.textAlign = "left";
  ctx.fillText(label, x + 22, y);
}

function drawNoData(ctx, width, height, message) {
  ctx.fillStyle = "#64748b";
  ctx.font = "800 18px Arial";
  ctx.textAlign = "center";
  ctx.fillText(message, width / 2, height / 2);
}

function roundRect(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function formatMonth(monthKey) {
  const [year, month] = monthKey.split("-");
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric"
  }).format(new Date(Number(year), Number(month) - 1, 1));
}

function drawDoughnutChart(ctx, canvas, entries, total) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(canvas.width, canvas.height) * 0.38;
  const lineWidth = radius * 0.38;
  let startAngle = -Math.PI / 2;

  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";

  entries.forEach(([category, amount]) => {
    const sliceAngle = (amount / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.strokeStyle = categoryColors[category] || categoryColors.Others;
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.stroke();
    startAngle += sliceAngle;
  });

  ctx.fillStyle = "#0f172a";
  ctx.font = "700 32px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(formatCurrency(total), centerX, centerY - 8);

  ctx.fillStyle = "#64748b";
  ctx.font = "600 15px Arial";
  ctx.fillText("total spent", centerX, centerY + 26);
}

function drawEmptyChart(ctx, canvas) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(canvas.width, canvas.height) * 0.34;

  ctx.beginPath();
  ctx.lineWidth = radius * 0.34;
  ctx.strokeStyle = "#dbe3ef";
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#64748b";
  ctx.font = "700 24px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("No data", centerX, centerY - 6);

  ctx.font = "500 15px Arial";
  ctx.fillText("Add an expense first", centerX, centerY + 24);
}

function initContactPage() {
  const form = document.getElementById("contact-form");

  if (!form) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    document.getElementById("contact-status").textContent = "Message noted for this demo.";
    form.reset();
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

if (initAuthGuard()) {
  updateAuthNavigation();
  initLoginPage();
  initRegisterPage();
  initTrackerPage();
  initDashboardPage();
  initGraphPage();
  initLogoutPage();
  initContactPage();
}
