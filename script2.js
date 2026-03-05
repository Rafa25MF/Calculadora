const STORAGE_KEY = "calculator_history_v2";
const HISTORY_LIMIT = 80;
const THEME_STORAGE_KEY = "calculator_theme_v1";
const OPERATORS = new Set(["+", "-", "\u00D7", "\u00F7", "^"]);

const elements = {
    appShell: document.querySelector(".app-shell"),
    visor: document.getElementById("visor"),
    preview: document.getElementById("preview"),
    keyboard: document.querySelector(".keyboard"),
    toggleTheme: document.getElementById("toggle-theme"),
    toggleHistory: document.getElementById("toggle-history"),
    closeHistory: document.getElementById("close-history"),
    clearHistory: document.getElementById("clear-history"),
    historyPanel: document.getElementById("history-panel"),
    historyList: document.getElementById("history-list"),
    historyEmpty: document.getElementById("history-empty")
};

const desktopQuery = window.matchMedia("(min-width: 1025px)");
const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
});

const state = {
    expression: "",
    history: loadHistory(),
    theme: getInitialTheme()
};

init();

function init() {
    applyTheme(state.theme);
    bindEvents();
    syncHistoryVisibility();
    renderExpression();
    renderHistory();
    updatePreview();
}

function bindEvents() {
    elements.keyboard.addEventListener("click", handleKeyboardClick);
    elements.toggleTheme?.addEventListener("click", toggleTheme);
    elements.toggleHistory.addEventListener("click", () => setHistoryVisibility(isHistoryHidden()));
    elements.closeHistory.addEventListener("click", () => setHistoryVisibility(false));
    elements.clearHistory.addEventListener("click", handleClearHistory);
    elements.historyList.addEventListener("click", handleHistorySelection);
    document.addEventListener("keydown", handlePhysicalKeyboard);

    if (desktopQuery.addEventListener) {
        desktopQuery.addEventListener("change", syncHistoryVisibility);
    } else {
        desktopQuery.addListener(syncHistoryVisibility);
    }
}

function getInitialTheme() {
    return "dark";
}

function toggleTheme() {
    state.theme = "dark";
    applyTheme(state.theme);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
}

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    updateThemeButtonLabel();
}

function updateThemeButtonLabel() {
    if (!elements.toggleTheme) {
        return;
    }

    elements.toggleTheme.textContent = "Modo escuro";
    elements.toggleTheme.setAttribute("aria-label", "Ativar modo escuro");
}

function handleKeyboardClick(event) {
    const button = event.target.closest("button");
    if (!button) {
        return;
    }

    const { action, value } = button.dataset;

    if (action) {
        handleAction(action);
        return;
    }

    if (typeof value === "string") {
        appendValue(value);
    }
}

function handleAction(action) {
    if (action === "clear") {
        clearExpression();
        return;
    }

    if (action === "backspace") {
        backspace();
        return;
    }

    if (action === "sqrt") {
        appendSquareRoot();
        return;
    }

    if (action === "calculate") {
        calculate();
    }
}

function appendValue(value) {
    if (state.expression === "Erro") {
        state.expression = "";
    }

    if (/\d/.test(value)) {
        appendDigit(value);
    } else if (value === ".") {
        appendDecimalPoint();
    } else if (value === "(") {
        appendOpenParenthesis();
    } else if (value === ")") {
        appendCloseParenthesis();
    } else if (value === "\u03C0") {
        appendPi();
    } else if (value === "%") {
        appendPercent();
    } else {
        appendOperator(value);
    }

    renderExpression();
    updatePreview();
}

function appendDigit(digit) {
    const lastChar = getLastChar();

    if (lastChar && (lastChar === ")" || lastChar === "\u03C0" || lastChar === "%")) {
        state.expression += "\u00D7";
    }

    state.expression += digit;
}

function appendDecimalPoint() {
    const lastChar = getLastChar();

    if (lastChar && (lastChar === ")" || lastChar === "\u03C0" || lastChar === "%")) {
        state.expression += "\u00D70.";
        return;
    }

    if (!lastChar || isOperator(lastChar) || lastChar === "(") {
        state.expression += "0.";
        return;
    }

    const currentNumber = getCurrentNumberSegment(state.expression);
    if (currentNumber.includes(".")) {
        return;
    }

    state.expression += ".";
}

function appendOpenParenthesis() {
    const lastChar = getLastChar();

    if (lastChar && (isDigit(lastChar) || lastChar === ")" || lastChar === "\u03C0" || lastChar === "%")) {
        state.expression += "\u00D7";
    }

    state.expression += "(";
}

function appendCloseParenthesis() {
    const lastChar = getLastChar();

    if (!lastChar || isOperator(lastChar) || lastChar === "(" || lastChar === ".") {
        return;
    }

    if (getParenthesisBalance(state.expression) <= 0) {
        return;
    }

    state.expression += ")";
}

function appendPi() {
    const lastChar = getLastChar();

    if (lastChar && (isDigit(lastChar) || lastChar === ")" || lastChar === "\u03C0" || lastChar === "%")) {
        state.expression += "\u00D7";
    }

    state.expression += "\u03C0";
}

function appendPercent() {
    const lastChar = getLastChar();

    if (!lastChar || isOperator(lastChar) || lastChar === "(" || lastChar === "." || lastChar === "%") {
        return;
    }

    state.expression += "%";
}

function appendOperator(operator) {
    const lastChar = getLastChar();

    if (!lastChar) {
        if (operator === "-") {
            state.expression = "-";
        }
        return;
    }

    if (lastChar === "(") {
        if (operator === "-") {
            state.expression += "-";
        }
        return;
    }

    if (isOperator(lastChar)) {
        state.expression = `${state.expression.slice(0, -1)}${operator}`;
        return;
    }

    if (lastChar === ".") {
        state.expression += "0";
    }

    state.expression += operator;
}

function appendSquareRoot() {
    if (state.expression === "Erro") {
        state.expression = "";
    }

    const lastChar = getLastChar();
    if (lastChar && (isDigit(lastChar) || lastChar === ")" || lastChar === "\u03C0" || lastChar === "%")) {
        state.expression += "\u00D7";
    }

    state.expression += "\u221A(";
    renderExpression();
    updatePreview();
}

function clearExpression() {
    state.expression = "";
    renderExpression();
    updatePreview();
}

function backspace() {
    if (state.expression === "Erro") {
        state.expression = "";
    } else if (state.expression.endsWith("\u221A(")) {
        state.expression = state.expression.slice(0, -2);
    } else {
        state.expression = state.expression.slice(0, -1);
    }

    renderExpression();
    updatePreview();
}

function calculate() {
    if (!state.expression || state.expression === "Erro") {
        return;
    }

    try {
        const result = evaluateExpression(state.expression);
        const formattedResult = formatNumber(result);

        addToHistory(state.expression, formattedResult);

        state.expression = formattedResult;
        renderExpression();
        elements.preview.textContent = `Resultado: ${formattedResult}`;
    } catch {
        state.expression = "Erro";
        renderExpression();
        elements.preview.textContent = "Express\u00E3o inv\u00E1lida";
    }
}

function updatePreview() {
    if (!state.expression) {
        elements.preview.textContent = "Pronto para calcular";
        return;
    }

    if (state.expression === "Erro") {
        elements.preview.textContent = "Limpe para continuar";
        return;
    }

    const lastChar = getLastChar();
    if (
        isOperator(lastChar) ||
        lastChar === "(" ||
        lastChar === "." ||
        state.expression.endsWith("\u221A(")
    ) {
        elements.preview.textContent = "Continue digitando...";
        return;
    }

    if (getParenthesisBalance(state.expression) !== 0) {
        elements.preview.textContent = "Feche os par\u00EAnteses";
        return;
    }

    try {
        const previewResult = formatNumber(evaluateExpression(state.expression));
        elements.preview.textContent = `Pr\u00E9via: ${previewResult}`;
    } catch {
        elements.preview.textContent = "Express\u00E3o inv\u00E1lida";
    }
}

function evaluateExpression(rawExpression) {
    let expression = rawExpression.replace(/\s+/g, "");

    if (!/^[0-9+\-\u00D7\u00F7^().%\u03C0\u221A]+$/u.test(expression)) {
        throw new Error("Express\u00E3o cont\u00E9m caracteres inv\u00E1lidos");
    }

    if (getParenthesisBalance(expression) !== 0) {
        throw new Error("Par\u00EAnteses inv\u00E1lidos");
    }

    expression = expression
        .replace(/\u00D7/g, "*")
        .replace(/\u00F7/g, "/")
        .replace(/\u03C0/g, `(${Math.PI})`)
        .replace(/\u221A\(/g, "Math.sqrt(")
        .replace(/\^/g, "**");

    expression = normalizePercent(expression);
    expression = insertImplicitMultiplication(expression);

    if (/[+\-*/^(.]$/.test(expression)) {
        throw new Error("Express\u00E3o incompleta");
    }

    const result = Function(`"use strict"; return (${expression});`)();

    if (typeof result !== "number" || !Number.isFinite(result)) {
        throw new Error("Resultado inv\u00E1lido");
    }

    return result;
}

function normalizePercent(expression) {
    let transformed = expression;

    while (transformed.includes("%")) {
        const percentIndex = transformed.indexOf("%");
        const operandStart = findOperandStart(transformed, percentIndex - 1);

        if (operandStart < 0) {
            throw new Error("Porcentagem inv\u00E1lida");
        }

        const operand = transformed.slice(operandStart, percentIndex);
        transformed = `${transformed.slice(0, operandStart)}(${operand}/100)${transformed.slice(percentIndex + 1)}`;
    }

    return transformed;
}

function findOperandStart(expression, endIndex) {
    if (endIndex < 0) {
        return -1;
    }

    let index = endIndex;

    if (expression[index] === ")") {
        let depth = 1;
        index -= 1;

        while (index >= 0) {
            if (expression[index] === ")") {
                depth += 1;
            } else if (expression[index] === "(") {
                depth -= 1;
            }

            if (depth === 0) {
                let start = index;
                if (start > 0 && expression[start - 1] === "-" && isUnaryMinus(expression, start - 1)) {
                    start -= 1;
                }
                return start;
            }

            index -= 1;
        }

        return -1;
    }

    while (index >= 0 && /[0-9.]/.test(expression[index])) {
        index -= 1;
    }

    if (index === endIndex) {
        return -1;
    }

    if (index >= 0 && expression[index] === "-" && isUnaryMinus(expression, index)) {
        return index;
    }

    return index + 1;
}

function isUnaryMinus(expression, index) {
    if (expression[index] !== "-") {
        return false;
    }

    if (index === 0) {
        return true;
    }

    return /[+\-*/^(]/.test(expression[index - 1]);
}

function insertImplicitMultiplication(expression) {
    return expression
        .replace(/(\d|\))(?=\()/g, "$1*")
        .replace(/(\d|\))(?=Math\.sqrt)/g, "$1*")
        .replace(/\)(?=\d)/g, ")*");
}

function formatNumber(value) {
    if (Object.is(value, -0)) {
        return "0";
    }

    if (Number.isInteger(value)) {
        return String(value);
    }

    return Number.parseFloat(value.toPrecision(12)).toString();
}

function renderExpression() {
    elements.visor.value = state.expression || "0";
}

function loadHistory() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
            return [];
        }

        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter((entry) => (
                entry &&
                typeof entry.expression === "string" &&
                typeof entry.result === "string" &&
                typeof entry.createdAt === "string"
            ))
            .slice(0, HISTORY_LIMIT);
    } catch {
        return [];
    }
}

function saveHistory() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
}

function addToHistory(expression, result) {
    const entry = {
        expression,
        result,
        createdAt: new Date().toISOString()
    };

    const firstEntry = state.history[0];
    if (firstEntry && firstEntry.expression === expression && firstEntry.result === result) {
        state.history[0] = entry;
    } else {
        state.history.unshift(entry);
    }

    if (state.history.length > HISTORY_LIMIT) {
        state.history = state.history.slice(0, HISTORY_LIMIT);
    }

    saveHistory();
    renderHistory();
}

function renderHistory() {
    elements.historyList.innerHTML = "";

    if (state.history.length === 0) {
        elements.historyEmpty.hidden = false;
        return;
    }

    elements.historyEmpty.hidden = true;

    state.history.forEach((entry, index) => {
        const item = document.createElement("li");
        item.className = "history-item";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "history-item__button";
        button.dataset.index = String(index);

        const expressionSpan = document.createElement("span");
        expressionSpan.className = "history-item__expression";
        expressionSpan.textContent = entry.expression;

        const resultSpan = document.createElement("span");
        resultSpan.className = "history-item__result";
        resultSpan.textContent = `= ${entry.result}`;

        const timeSpan = document.createElement("span");
        timeSpan.className = "history-item__time";

        const date = new Date(entry.createdAt);
        timeSpan.textContent = Number.isNaN(date.getTime())
            ? "sem data"
            : timeFormatter.format(date);

        button.append(expressionSpan, resultSpan, timeSpan);
        item.appendChild(button);
        elements.historyList.appendChild(item);
    });
}

function handleHistorySelection(event) {
    const button = event.target.closest("button[data-index]");
    if (!button) {
        return;
    }

    const index = Number(button.dataset.index);
    const entry = state.history[index];

    if (!entry) {
        return;
    }

    state.expression = entry.expression;
    renderExpression();
    updatePreview();

    if (!desktopQuery.matches) {
        setHistoryVisibility(false);
    }
}

function handleClearHistory() {
    if (state.history.length === 0) {
        return;
    }

    const confirmed = window.confirm("Deseja apagar todo o hist\u00F3rico de c\u00E1lculos?");
    if (!confirmed) {
        return;
    }

    state.history = [];
    saveHistory();
    renderHistory();
}

function isHistoryHidden() {
    return elements.historyPanel.classList.contains("history-panel--hidden");
}

function setHistoryVisibility(visible) {
    elements.historyPanel.classList.toggle("history-panel--hidden", !visible);
    syncHistoryVisibility();
}

function syncHistoryVisibility() {
    const visible = !isHistoryHidden();
    elements.appShell.classList.toggle("history-open", visible && desktopQuery.matches);
    elements.toggleHistory.setAttribute("aria-expanded", String(visible));
}

function getLastChar() {
    return state.expression.slice(-1);
}

function isOperator(char) {
    return OPERATORS.has(char);
}

function isDigit(char) {
    return /\d/.test(char);
}

function getCurrentNumberSegment(expression) {
    let index = expression.length - 1;

    while (index >= 0 && /[0-9.]/.test(expression[index])) {
        index -= 1;
    }

    return expression.slice(index + 1);
}

function getParenthesisBalance(expression) {
    let balance = 0;

    for (const char of expression) {
        if (char === "(") {
            balance += 1;
        } else if (char === ")") {
            balance -= 1;
            if (balance < 0) {
                return -1;
            }
        }
    }

    return balance;
}

function handlePhysicalKeyboard(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
    }

    const keyMap = {
        "+": "+",
        "-": "-",
        "*": "\u00D7",
        "/": "\u00F7",
        "^": "^",
        "%": "%",
        "(": "(",
        ")": ")",
        ".": "."
    };

    if (/^[0-9]$/.test(event.key)) {
        appendValue(event.key);
        return;
    }

    if (Object.prototype.hasOwnProperty.call(keyMap, event.key)) {
        event.preventDefault();
        appendValue(keyMap[event.key]);
        return;
    }

    if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        calculate();
        return;
    }

    if (event.key === "Backspace") {
        event.preventDefault();
        backspace();
        return;
    }

    if (event.key === "Escape") {
        clearExpression();
        return;
    }

    if (event.key.toLowerCase() === "p") {
        appendValue("\u03C0");
        return;
    }

    if (event.key.toLowerCase() === "r") {
        appendSquareRoot();
    }
}
