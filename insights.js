const { createClient } = supabase;

const supabaseClient = createClient(
  "https://zialryicqmrtepmojrtj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppYWxyeWljcW1ydGVwbW9qcnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODA0NTQsImV4cCI6MjA5MjM1NjQ1NH0.lCmb5OmM2oiOhr9FV5UmzSRac51u_7itJ-rRTuV0A30"
);

const params = new URLSearchParams(window.location.search);
const userId = params.get("userid");

let spendingChartInstance = null;

// Initialize the dashboard
async function init() {
    if (!userId) {
        document.getElementById("userInfo").innerText = "No User ID provided.";
        return;
    }
    await loadCategories();
    await loadData();
}

async function loadCategories() {
    const { data, error } = await supabaseClient.from("categories").select("*");
    if (error) {
        console.error("Error fetching categories:", error);
        return;
    }
    
    const categorySelect = document.getElementById("category");
    if (data && categorySelect) {
        data.forEach(c => {
            const option = document.createElement("option");
            // Use 'id' or 'category_id' depending on the schema
            option.value = c.id || c.category_id || c.name; 
            option.innerText = c.category_name;
            categorySelect.appendChild(option);
        });
    }
}

async function loadData() {
    let output = document.getElementById("output");

    // 1. Fetch USER NAME
    const { data: userData } = await supabaseClient
        .from("users")
        .select("*")
        .eq("user_id", userId)
        .single();

    if (userData) {
        document.getElementById("userInfo").innerText =
            "User: " + userData.name + " (ID: " + userId + ")";
    }

    output.innerHTML = "<li>Loading data...</li>";

    // 2. Fetch transactions WITH category name
    const { data, error } = await supabaseClient
        .from("transactions")
        .select("*, categories(category_name)")
        .eq("user_id", userId);

    if (error) {
        output.innerHTML = "<li class='alert-item'>ERROR: " + error.message + "</li>";
        return;
    }

    if (!data || data.length === 0) {
        output.innerHTML = "<li>No transactions found. Add one above!</li>";
        if (spendingChartInstance) spendingChartInstance.destroy();
        return;
    }

    let result = "";
    let totalDebit = 0;
    let totalCredit = 0;

    // 3. SHOW EACH TRANSACTION
    data.forEach(t => {
        if (t.type === "debit") totalDebit += t.amount;
        if (t.type === "credit") totalCredit += t.amount;

        const sign = t.type === 'credit' ? '+' : '-';
        const color = t.type === 'credit' ? '#10b981' : '#ef4444';
        
        result += `<li>
            <div class="transaction-item">
                <div>
                    <strong>${t.categories?.category_name || "Unknown"}</strong>
                    <div class="transaction-meta">📅 ${t.date}</div>
                </div>
                <div style="color: ${color}; font-weight: 600;">
                    ${sign}₹${t.amount}
                </div>
            </div>
        </li>`;
    });

    let balance = totalCredit - totalDebit;

    // 4. SMART INSIGHTS
    if (data.length >= 3) {
        result += "<li class='alert-item'>⚠ Impulsive spending detected</li>";
    }

    if (totalDebit > 5000) {
        result += "<li class='alert-item'>📊 High spending detected</li>";
    }

    if (balance < 1000) {
        result += "<li class='alert-item'>📉 Low balance at month end</li>";
    }

    result += `<li class="insight-total">💰 Total Debit: ₹${totalDebit}</li>`;
    result += `<li class="insight-total">🏦 Balance: ₹${balance}</li>`;

    output.innerHTML = result;

    // 5. GENERATE PIE CHART
    const categoryTotals = {};
    data.forEach(t => {
        if (t.type === "debit") {
            const catName = t.categories?.category_name || "Unknown";
            categoryTotals[catName] = (categoryTotals[catName] || 0) + t.amount;
        }
    });

    const ctx = document.getElementById('spendingChart').getContext('2d');
    
    // Destroy existing chart if re-rendering
    if (spendingChartInstance) {
        spendingChartInstance.destroy();
    }

    spendingChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#ec4899', '#14b8a6'],
                borderWidth: 1
            }]
        },
        options: {
            plugins: {
                legend: { position: 'bottom', labels: { color: '#f8fafc', font: { family: 'Outfit' } } },
                title: { display: true, text: 'Spending by Category', color: '#f8fafc', font: { family: 'Outfit', size: 16 } }
            }
        }
    });
}


// Run init
init();
