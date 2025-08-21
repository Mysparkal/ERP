// IMPORTANT: Paste your new Google Apps Script Web App URL here
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwTNdd-WHrXMambb6PBL53SC_I7Q8hO27Gpqe98UtPep-LVtY8Rp325HtbvhKKAd74K/exec";
const loader = document.getElementById('loader');

document.addEventListener("DOMContentLoaded", () => {
    const currentPage = window.location.pathname;

    if (currentPage.includes("dashboard.html")) {
        if (!sessionStorage.getItem("loggedIn")) {
            window.location.href = "index.html";
            return;
        }
        initDashboard();
    } else {
        const loginForm = document.getElementById("loginForm");
        if (loginForm) {
            loginForm.addEventListener("submit", handleLogin);
        }
    }
});

function showLoader() { loader.style.display = 'flex'; }
function hideLoader() { loader.style.display = 'none'; }

function handleLogin(e) {
    e.preventDefault();
    showLoader();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("error-message");

    fetch(SCRIPT_URL + "?action=login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            sessionStorage.setItem("loggedIn", "true");
            window.location.href = "dashboard.html";
        } else {
            errorMessage.textContent = data.message;
        }
    })
    .catch(error => {
        console.error("Login Error:", error);
        errorMessage.textContent = "An error occurred. Please try again.";
    })
    .finally(() => hideLoader());
}

async function initDashboard() {
    setupEventListeners();
    await loadDashboardData();
    await populateProductDropdowns();
    loadAllTables();
}

function setupEventListeners() {
    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();
            switchPage(e.currentTarget.getAttribute("data-target"));
        });
    });

    document.getElementById("logout").addEventListener("click", () => {
        sessionStorage.removeItem("loggedIn");
        window.location.href = "index.html";
    });

    // Form Submissions
    document.getElementById("addProductForm").addEventListener("submit", addProduct);
    document.getElementById("addPurchaseForm").addEventListener("submit", addPurchase);
    document.getElementById("addSaleForm").addEventListener("submit", addSale);
    document.getElementById("addExpenseForm").addEventListener("submit", addExpense);

    document.querySelectorAll('.export-btn').forEach(button => {
        button.addEventListener('click', function() {
            exportTableToExcel(this.getAttribute('data-table'));
        });
    });
}

function switchPage(targetId) {
    document.querySelectorAll(".page").forEach(page => page.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    
    document.querySelector(".main-header h1").textContent = targetId.charAt(0).toUpperCase() + targetId.slice(1);
    
    document.querySelectorAll(".nav-link").forEach(link => link.classList.remove('active'));
    document.querySelector(`.nav-link[data-target="${targetId}"]`).classList.add('active');
}

async function apiCall(action, data = {}) {
    showLoader();
    try {
        const response = await fetch(`${SCRIPT_URL}?action=${action}`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (error) {
        console.error('API Call Error:', error);
        alert('An error occurred: ' + error.message);
    } finally {
        hideLoader();
    }
}

async function loadDashboardData() {
    const data = await apiCall("getDashboardData");
    if (data) {
        document.getElementById("totalSales").textContent = `₹${data.totalSalesValue.toFixed(2)}`;
        document.getElementById("totalPurchases").textContent = `₹${data.totalPurchaseValue.toFixed(2)}`;
        document.getElementById("totalExpenses").textContent = `₹${data.totalExpenses.toFixed(2)}`;
        document.getElementById("totalProfit").textContent = `₹${data.totalProfit.toFixed(2)}`;
        renderSalesChart(data.salesData);
        renderExpenseChart(data.expensesData);
    }
}

let salesChartInstance;
function renderSalesChart(salesData) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    const labels = [...new Set(salesData.map(sale => new Date(sale[7]).toLocaleDateString()))];
    const dataPoints = labels.map(label => {
        return salesData
            .filter(sale => new Date(sale[7]).toLocaleDateString() === label)
            .reduce((acc, sale) => acc + sale[5], 0);
    });

    if (salesChartInstance) salesChartInstance.destroy();
    salesChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Sales', data: dataPoints, borderColor: 'var(--primary-color)', tension: 0.1 }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

let expenseChartInstance;
function renderExpenseChart(expensesData) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const categories = {};
    expensesData.forEach(exp => {
        categories[exp[1]] = (categories[exp[1]] || 0) + exp[2];
    });

    if (expenseChartInstance) expenseChartInstance.destroy();
    expenseChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categories),
            datasets: [{
                data: Object.values(categories),
                backgroundColor: ['#4A90E2', '#F5A623', '#BD10E0', '#7ED321', '#E01050'],
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

async function loadAllTables() {
    loadTableData('products', 'productsTable', 6);
    loadTableData('purchases', 'purchasesTable', 7);
    loadTableData('sales', 'salesTable', 8);
    loadTableData('expenses', 'expensesTable', 4);
}

async function loadTableData(sheetName, tableId, columns) {
    const data = await apiCall("getData", { sheetName: sheetName.charAt(0).toUpperCase() + sheetName.slice(1) });
    const tableBody = document.getElementById(tableId).querySelector('tbody');
    tableBody.innerHTML = "";
    if (data && data.length) {
        data.forEach(rowData => {
            const row = document.createElement('tr');
            for (let i = 0; i < columns; i++) {
                const cell = document.createElement('td');
                let cellData = rowData[i];
                if (String(cellData).includes("GMT")) {
                    cell.textContent = new Date(cellData).toLocaleDateString();
                } else {
                    cell.textContent = cellData;
                }
                row.appendChild(cell);
            }
            tableBody.appendChild(row);
        });
    }
}

async function populateProductDropdowns() {
    const products = await apiCall("getProductsList");
    if (products) {
        const purchaseSelect = document.getElementById('purchaseProductId');
        const saleSelect = document.getElementById('saleProductId');
        purchaseSelect.innerHTML = '<option value="">Select a product...</option>';
        saleSelect.innerHTML = '<option value="">Select a product...</option>';
        products.forEach(p => {
            purchaseSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
            saleSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });
    }
}

async function addProduct(e) {
    e.preventDefault();
    const data = {
        productName: document.getElementById('addProductName').value,
        costPrice: document.getElementById('addCostPrice').value,
        salePrice: document.getElementById('addSalePrice').value
    };
    const response = await apiCall("addProduct", data);
    if (response.status === "success") {
        alert("Product added!");
        e.target.reset();
        await populateProductDropdowns();
        loadTableData('products', 'productsTable', 6);
    } else {
        alert("Error: " + response.message);
    }
}

async function addPurchase(e) {
    e.preventDefault();
    const data = {
        productId: document.getElementById('purchaseProductId').value,
        quantity: document.getElementById('purchaseQuantity').value,
    };
    const response = await apiCall("addPurchase", data);
    if (response.status === "success") {
        alert("Purchase added!");
        e.target.reset();
        loadTableData('purchases', 'purchasesTable', 7);
        loadTableData('products', 'productsTable', 6);
        loadDashboardData();
    } else {
        alert("Error: " + response.message);
    }
}

async function addSale(e) {
    e.preventDefault();
    const data = {
        productId: document.getElementById('saleProductId').value,
        quantity: document.getElementById('saleQuantity').value,
    };
    const response = await apiCall("addSale", data);
    if (response.status === "success") {
        alert("Sale added!");
        e.target.reset();
        loadTableData('sales', 'salesTable', 8);
        loadTableData('products', 'productsTable', 6);
        loadDashboardData();
    } else {
        alert("Error: " + response.message);
    }
}

async function addExpense(e) {
    e.preventDefault();
    const data = {
        expenseCategory: document.getElementById('expenseCategory').value,
        amount: document.getElementById('expenseAmount').value
    };
    const response = await apiCall("addExpense", data);
    if (response.status === "success") {
        alert("Expense added!");
        e.target.reset();
        loadTableData('expenses', 'expensesTable', 4);
        loadDashboardData();
    } else {
        alert("Error: " + response.message);
    }
}

function exportTableToExcel(tableID, filename = 'data') {
    const table = document.getElementById(tableID);
    const wb = XLSX.utils.table_to_book(table, { sheet: "Sheet1" });
    XLSX.writeFile(wb, `${filename}.xlsx`);

}
