import supabase from './supabase-config.js';

// State management
let assets = [];
let transactions = [];
let filteredAssets = [];

// Initialize UI
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    
    // Setup event listeners for navigation
    document.getElementById('nav-dashboard').addEventListener('click', (e) => {
        e.preventDefault();
        showDashboard();
    });

    document.getElementById('nav-inventory').addEventListener('click', (e) => {
        e.preventDefault();
        setActiveLink('nav-inventory');
        document.getElementById('page-title').textContent = "All Inventory";
        applyFilters();
    });

    document.getElementById('nav-robotics').addEventListener('click', (e) => {
        e.preventDefault();
        setActiveLink('nav-robotics');
        document.getElementById('page-title').textContent = "Robotics Kits";
        applyFilters();
    });

    document.getElementById('nav-history').addEventListener('click', (e) => {
        e.preventDefault();
        setActiveLink('nav-history');
        document.getElementById('page-title').textContent = "Activity History";
        renderHistory();
    });

    // Search input handler
    document.getElementById('inventory-search').addEventListener('input', () => {
        applyFilters();
    });
});

async function loadData() {
    const { data: assetsData, error: assetsError } = await supabase
        .from('assets')
        .select('*')
        .order('name', { ascending: true });

    const { data: transData, error: transError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .limit(50);

    if (assetsError || transError) {
        console.error("Error loading data:", assetsError || transError);
        return;
    }

    assets = assetsData;
    transactions = transData;
    filteredAssets = [...assets];
    
    updateStats();
    applyFilters();
}

function setActiveLink(id) {
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function updateStats() {
    const total = assets.length;
    const available = assets.filter(a => a.status === 'available').length;
    const signedOut = assets.filter(a => a.status === 'signed-out').length;
    const broken = assets.filter(a => a.status === 'broken').length;

    const totalEl = document.getElementById('count-total');
    const availableEl = document.getElementById('count-available');
    const signedOutEl = document.getElementById('count-signed-out');
    const brokenEl = document.getElementById('count-broken');

    if(totalEl) totalEl.textContent = total;
    if(availableEl) availableEl.textContent = available;
    if(signedOutEl) signedOutEl.textContent = signedOut;
    if(brokenEl) brokenEl.textContent = broken;
}

function applyFilters() {
    const searchTerm = document.getElementById('inventory-search').value.toLowerCase();
    const activeNav = document.querySelector('.nav-link.active').id;
    
    let baseItems = [...assets];
    if (activeNav === 'nav-robotics') baseItems = baseItems.filter(a => a.category === 'Robotics');
    
    filteredAssets = baseItems.filter(item => 
        item.name.toLowerCase().includes(searchTerm) || 
        item.category.toLowerCase().includes(searchTerm) ||
        (item.borrower_name && item.borrower_name.toLowerCase().includes(searchTerm))
    );
    
    renderInventory(filteredAssets);
}

function renderInventory(items) {
    const tableHeader = document.querySelector('thead tr');
    if (tableHeader) {
        tableHeader.innerHTML = `
            <th>Asset Name</th>
            <th>Category</th>
            <th>Status</th>
            <th>Last Action</th>
            <th>Actions</th>
        `;
    }

    const body = document.getElementById('inventory-body');
    if(!body) return;
    body.innerHTML = '';

    items.forEach(asset => {
        const tr = document.createElement('tr');
        tr.className = 'animate-in';
        
        tr.innerHTML = `
            <td>
                <div style="font-weight:600">${asset.name}</div>
                ${asset.components ? `<button class="btn-text" onclick="viewComponents(${asset.id})" style="color:var(--accent); background:none; border:none; padding:0; cursor:pointer; font-size:0.75rem;">View components</button>` : ''}
            </td>
            <td>${asset.category}</td>
            <td>
                <span class="status-badge status-${asset.status}">
                    ${asset.status.replace('-', ' ').charAt(0).toUpperCase() + asset.status.replace('-', ' ').slice(1)}
                </span>
            </td>
            <td>
                <div style="font-size:0.8rem">${asset.last_action || 'No record'}</div>
                ${asset.borrower_name ? `<small style="color:var(--accent)">By ${asset.borrower_name}</small>` : ''}
            </td>
            <td>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn btn-outline btn-sm" onclick="handleAction(${asset.id})">
                        ${asset.status === 'available' ? 'Sign Out' : asset.status === 'signed-out' ? 'Sign In' : 'Details'}
                    </button>
                    ${asset.status === 'available' ? `<button class="btn btn-outline btn-sm" onclick="flagBroken(${asset.id})" title="Report Broken"><i data-lucide="alert-triangle"></i></button>` : ''}
                </div>
            </td>
        `;
        body.appendChild(tr);
    });
    
    if (window.lucide) lucide.createIcons();
}

// Modal System Logic
function openModal(html) {
    const container = document.getElementById('modal-container');
    container.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content animate-in">
                <button class="modal-close" onclick="closeModal()"><i data-lucide="x"></i></button>
                ${html}
            </div>
        </div>
    `;
    container.style.display = 'block';
    if (window.lucide) lucide.createIcons();
}

window.closeModal = () => {
    document.getElementById('modal-container').style.display = 'none';
};

window.viewComponents = (id) => {
    const asset = assets.find(a => a.id === id);
    if (!asset.components) return;
    
    let componentsHtml = asset.components.map(c => `
        <div class="component-item">
            <span>${c.name}</span>
            <span style="font-weight:700">x${c.qty}</span>
        </div>
    `).join('');

    openModal(`
        <div class="modal-header">
            <h2>${asset.name} Components</h2>
        </div>
        <div class="components-list">
            ${componentsHtml}
        </div>
        <div style="margin-top:2rem; display:flex; justify-content:flex-end;">
            <button class="btn btn-primary" onclick="closeModal()">Close</button>
        </div>
    `);
};

window.handleAction = (id) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    if (asset.status === 'signed-out') {
        openModal(`
            <div class="modal-header">
                <h2>Return Asset</h2>
                <p style="color:var(--text-muted)">Returning <strong>${asset.name}</strong></p>
            </div>
            <div class="form-group">
                <label>Inventory Condition Update</label>
                <select id="return-condition" class="form-control">
                    <option value="good">Still Good</option>
                    <option value="broken">Item is Broken</option>
                </select>
            </div>
            <div style="display:flex; gap:1rem; justify-content:flex-end; margin-top:2rem;">
                <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="confirmSignIn(${id})">Confirm Return</button>
            </div>
        `);
    } else if (asset.status === 'available') {
        openModal(`
            <div class="modal-header">
                <h2>Sign Out Asset</h2>
                <p style="color:var(--text-muted)">Checking out <strong>${asset.name}</strong></p>
            </div>
            <div class="form-group">
                <label>Your Name</label>
                <input type="text" id="signer-name" class="form-control" placeholder="Who is taking it?">
            </div>
            <div class="form-group">
                <label>Reason / Location</label>
                <input type="text" id="signer-reason" class="form-control" placeholder="e.g. Outreach at London School">
            </div>
            <div style="display:flex; gap:1rem; justify-content:flex-end; margin-top:2rem;">
                <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="confirmSignOut(${id})">Confirm Sign Out</button>
            </div>
        `);
    }
};

window.confirmSignOut = async (id) => {
    const name = document.getElementById('signer-name').value;
    const reason = document.getElementById('signer-reason').value;
    
    if (!name || !reason) {
        alert("Please fill in all fields.");
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const asset = assets.find(a => a.id === id);

    // Concurrency Lock: update ONLY IF status is still 'available'
    const { data: updateData, error: updateError, count } = await supabase
        .from('assets')
        .update({
            status: 'signed-out',
            borrower_name: name,
            reason: reason,
            last_action: `Signed Out - ${today}`
        })
        .eq('id', id)
        .eq('status', 'available')
        .select();

    if (updateError || !updateData || updateData.length === 0) {
        alert("CONCURRENCY ERROR: This asset was just signed out by another colleague. Refreshing list...");
        await loadData();
        closeModal();
        return;
    }

    // Add to history
    await supabase.from('transactions').insert([{
        asset_id: id,
        asset_name: asset.name,
        user_name: name,
        action: "Signed Out",
        date: today,
        reason: reason
    }]);
    
    closeModal();
    await loadData();
};

window.confirmSignIn = async (id) => {
    const condition = document.getElementById('return-condition').value;
    const today = new Date().toISOString().split('T')[0];
    const asset = assets.find(a => a.id === id);
    const borrower = asset.borrower_name;
    
    await supabase.from('assets').update({
        status: condition === 'broken' ? 'broken' : 'available',
        condition: condition,
        borrower_name: null,
        reason: null,
        last_action: `Returned - ${today}`
    }).eq('id', id);

    // Add to history
    await supabase.from('transactions').insert([{
        asset_id: id,
        asset_name: asset.name,
        user_name: borrower || "Unknown",
        action: "Returned",
        date: today,
        reason: condition === 'broken' ? "Returned (Damaged/Broken)" : "Regular Return"
    }]);

    closeModal();
    await loadData();
};

window.flagBroken = async (id) => {
    const asset = assets.find(a => a.id === id);
    if(confirm(`Are you sure you want to flag "${asset.name}" as BROKEN?`)) {
        const today = new Date().toISOString().split('T')[0];
        
        await supabase.from('assets').update({
            status: 'broken',
            condition: 'broken',
            last_action: `Flagged Broken - ${today}`
        }).eq('id', id);

        await supabase.from('transactions').insert([{
            asset_id: id,
            asset_name: asset.name,
            user_name: "Staff",
            action: "Flagged Broken",
            date: today,
            reason: "Reported as broken by staff member"
        }]);

        await loadData();
    }
};

function showDashboard() {
    setActiveLink('nav-dashboard');
    document.getElementById('page-title').textContent = "Inventory Dashboard";
    document.getElementById('page-description').textContent = "Overview of Sheen Academy assets and availability.";
    applyFilters();
}

function renderHistory() {
    const tableHeader = document.querySelector('thead tr');
    const pageDescription = document.getElementById('page-description');
    
    pageDescription.textContent = "Full audit log of all item movements and condition updates.";
    
    if (tableHeader) {
        tableHeader.innerHTML = `
            <th>Date</th>
            <th>Asset Name</th>
            <th>Person</th>
            <th>Action</th>
            <th>Reason</th>
        `;
    }

    const body = document.getElementById('inventory-body');
    if(!body) return;
    body.innerHTML = '';

    transactions.forEach(t => {
        const tr = document.createElement('tr');
        tr.className = 'animate-in';
        tr.innerHTML = `
            <td>${t.date}</td>
            <td style="font-weight:600">${t.asset_name}</td>
            <td>${t.user_name}</td>
            <td>
                <span class="status-badge ${t.action === 'Signed Out' ? 'status-signed-out' : 'status-available'}">
                    ${t.action}
                </span>
            </td>
            <td>${t.reason}</td>
        `;
        body.appendChild(tr);
    });
}
