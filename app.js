// State management
let assets = [
    { id: 1, name: "Dell Latitude 5420", category: "Office", status: "available", condition: "good", lastAction: "Returned - 2024-04-10" },
    { id: 2, name: "LEGO Spike Prime Kit #1", category: "Robotics", status: "signed-out", condition: "new", currentUser: "Alice Smith", reason: "Class 7A Robotics", lastAction: "Signed Out - 2024-04-14", components: [
        { name: "Hub", qty: 1 },
        { name: "Large Motor", qty: 2 },
        { name: "Color Sensor", qty: 1 }
    ]},
    { id: 3, name: "Classroom iPad Pro #5", category: "Classroom", status: "broken", condition: "broken", lastAction: "Flagged - 2024-04-12" },
    { id: 4, name: "VEX IQ Gen 2 Starter", category: "Robotics", status: "available", condition: "good", lastAction: "Returned - 2024-04-01", components: [
        { name: "Brain", qty: 1 },
        { name: "Touch LED", qty: 1 }
    ]}
];

let transactions = [
    { date: "2024-04-14", assetName: "LEGO Spike Prime Kit #1", user: "Alice Smith", action: "Signed Out", reason: "Class 7A Robotics" },
    { date: "2024-04-12", assetName: "Classroom iPad Pro #5", user: "Technician", action: "Flagged Broken", reason: "Cracked screen reported by teacher" }
];

let filteredAssets = [...assets];

// Initialize UI
document.addEventListener('DOMContentLoaded', () => {
    updateStats();
    renderInventory(assets);
    
    // Setup event listeners for navigation
    document.getElementById('nav-dashboard').addEventListener('click', (e) => {
        e.preventDefault();
        showDashboard();
    });

    document.getElementById('nav-inventory').addEventListener('click', (e) => {
        e.preventDefault();
        setActiveLink('nav-inventory');
        document.getElementById('page-title').textContent = "All Inventory";
        filteredAssets = [...assets];
        renderInventory(filteredAssets);
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
    document.getElementById('inventory-search').addEventListener('input', (e) => {
        applyFilters();
    });
});

function applyFilters() {
    const searchTerm = document.getElementById('inventory-search').value.toLowerCase();
    const activeNav = document.querySelector('.nav-link.active').id;
    
    let baseItems = [...assets];
    if (activeNav === 'nav-robotics') baseItems = baseItems.filter(a => a.category === 'Robotics');
    
    filteredAssets = baseItems.filter(item => 
        item.name.toLowerCase().includes(searchTerm) || 
        item.category.toLowerCase().includes(searchTerm) ||
        (item.currentUser && item.currentUser.toLowerCase().includes(searchTerm))
    );
    
    renderInventory(filteredAssets);
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

    items.forEach(asset => {
        const tr = document.createElement('tr');
        tr.className = 'animate-in';
        
        tr.innerHTML = `
            <td>
                <div style="font-weight:600">${asset.name}</div>
                ${asset.components ? `<button class="btn-text" onclick="viewComponents(${asset.id})" style="color:var(--accent); background:none; border:none; padding:0; cursor:pointer; font-size:0.75rem;">View ${asset.components.length} components</button>` : ''}
            </td>
            <td>${asset.category}</td>
            <td>
                <span class="status-badge status-${asset.status}">
                    ${asset.status.replace('-', ' ').charAt(0).toUpperCase() + asset.status.replace('-', ' ').slice(1)}
                </span>
            </td>
            <td>
                <div style="font-size:0.8rem">${asset.lastAction}</div>
                ${asset.currentUser ? `<small style="color:var(--accent)">By ${asset.currentUser}</small>` : ''}
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
        // Double Check Simulation (Prevention Logic)
        // In a real app, this would be a fresh fetch from DB
        if (asset.status !== 'available') {
            alert("Error: This item was just signed out by another colleague. refreshing list...");
            return;
        }

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

window.confirmSignOut = (id) => {
    const name = document.getElementById('signer-name').value;
    const reason = document.getElementById('signer-reason').value;
    
    if (!name || !reason) {
        alert("Please fill in all fields.");
        return;
    }

    const asset = assets.find(a => a.id === id);
    
    // Final Concurrency Check (Simulation)
    if (asset.status !== 'available') {
        alert("CRITICAL ERROR: This asset is no longer available. It may have been signed out recently.");
        closeModal();
        return;
    }

    asset.status = 'signed-out';
    asset.currentUser = name;
    asset.reason = reason;
    asset.lastAction = `Signed Out - ${new Date().toISOString().split('T')[0]}`;
    
    // Add to history
    transactions.unshift({
        date: new Date().toISOString().split('T')[0],
        assetName: asset.name,
        user: name,
        action: "Signed Out",
        reason: reason
    });

    closeModal();
    updateStats();
    renderInventory(filteredAssets);
};

window.confirmSignIn = (id) => {
    const condition = document.getElementById('return-condition').value;
    const asset = assets.find(a => a.id === id);
    
    asset.status = condition === 'broken' ? 'broken' : 'available';
    asset.condition = condition;
    asset.lastAction = `Returned - ${new Date().toISOString().split('T')[0]}`;
    
    // Add to history
    transactions.unshift({
        date: new Date().toISOString().split('T')[0],
        assetName: asset.name,
        user: asset.currentUser || "Unknown",
        action: "Returned",
        reason: condition === 'broken' ? "Returned (Damaged/Broken)" : "Regular Return"
    });

    delete asset.currentUser;
    delete asset.reason;

    closeModal();
    updateStats();
    renderInventory(filteredAssets);
};

window.flagBroken = (id) => {
    const asset = assets.find(a => a.id === id);
    if(confirm(`Are you sure you want to flag "${asset.name}" as BROKEN?`)) {
        asset.status = 'broken';
        asset.condition = 'broken';
        asset.lastAction = `Flagged Broken - ${new Date().toISOString().split('T')[0]}`;
        updateStats();
        renderInventory(filteredAssets);
    }
};

function showDashboard() {
    setActiveLink('nav-dashboard');
    document.getElementById('page-title').textContent = "Inventory Dashboard";
    document.getElementById('page-description').textContent = "Overview of Sheen Academy assets and availability.";
    filteredAssets = [...assets];
    renderInventory(filteredAssets);
}

function renderHistory() {
    const tableHeader = document.querySelector('thead tr');
    const pageDescription = document.getElementById('page-description');
    
    pageDescription.textContent = "Full audit log of all item movements and condition updates.";
    
    tableHeader.innerHTML = `
        <th>Date</th>
        <th>Asset Name</th>
        <th>Person</th>
        <th>Action</th>
        <th>Reason</th>
    `;

    const body = document.getElementById('inventory-body');
    body.innerHTML = '';

    transactions.forEach(t => {
        const tr = document.createElement('tr');
        tr.className = 'animate-in';
        tr.innerHTML = `
            <td>${t.date}</td>
            <td style="font-weight:600">${t.assetName}</td>
            <td>${t.user}</td>
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
