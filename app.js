import supabase from './supabase-config.js';

// State management
let assets = [];
let transactions = [];
let filteredAssets = [];
let categories = [];
let openKitIds = new Set(); // Track which kits have their components expanded

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

    // Add Asset Button
    document.getElementById('add-asset-btn').addEventListener('click', () => {
        openAssetModal(); // Unified modal for Add/Edit
    });

    // Mobile Navigation
    const sidebar = document.getElementById('app-sidebar');
    document.getElementById('mobile-nav-toggle').addEventListener('click', () => {
        sidebar.classList.add('open');
    });

    document.getElementById('mobile-sidebar-close').addEventListener('click', () => {
        sidebar.classList.remove('open');
    });

    // Close sidebar on link click (mobile)
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                sidebar.classList.remove('open');
            }
        });
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
    
    // Extract unique categories
    categories = [...new Set(assets.map(a => a.category))].sort();

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
    const damaged = assets.filter(a => a.status === 'damaged').length;

    const totalEl = document.getElementById('count-total');
    const availableEl = document.getElementById('count-available');
    const signedOutEl = document.getElementById('count-signed-out');
    const brokenEl = document.getElementById('count-broken');

    if(totalEl) totalEl.textContent = total;
    if(availableEl) availableEl.textContent = available;
    if(signedOutEl) signedOutEl.textContent = signedOut;
    if(brokenEl) brokenEl.textContent = damaged;
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
            <th class="hide-mobile">Category</th>
            <th>Status</th>
            <th class="hide-mobile">Last Action</th>
            <th>Actions</th>
        `;
    }

    const body = document.getElementById('inventory-body');
    if(!body) return;
    body.innerHTML = '';

    items.forEach(asset => {
        const tr = document.createElement('tr');
        tr.className = 'animate-in';
        
        const isExpanded = openKitIds.has(asset.id);
        const hasComponents = asset.components && asset.components.length > 0;

        tr.innerHTML = `
            <td>
                <div style="font-weight:600">${asset.name}</div>
                ${hasComponents ? `
                    <button class="toggle-components-btn" onclick="toggleComponents(${asset.id})">
                        <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" style="width:14px;"></i>
                        ${isExpanded ? 'Hide' : 'Show'} ${asset.components.length} components
                    </button>
                    ${isExpanded ? `
                        <div class="inline-components-list">
                            ${asset.components.map(c => `
                                <div class="inline-component-item">
                                    <span>${c.name}</span>
                                    <span>x${c.qty}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                ` : ''}
            </td>
            <td class="hide-mobile">${asset.category}</td>
            <td>
                <span class="status-badge status-${asset.status}">
                    ${asset.status.replace('-', ' ').charAt(0).toUpperCase() + asset.status.replace('-', ' ').slice(1)}
                </span>
            </td>
            <td class="hide-mobile">
                <div style="font-size:0.8rem">${asset.last_action || 'No record'}</div>
                ${asset.borrower_name ? `<small style="color:var(--accent)">By ${asset.borrower_name}</small>` : ''}
            </td>
            <td>
                <div style="display:flex; gap:0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-outline btn-sm" onclick="handleAction(${asset.id})">
                        ${asset.status === 'available' ? 'Sign Out' : asset.status === 'signed-out' ? 'Sign In' : 'Details'}
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="openAssetModal(${asset.id})" title="Edit Item">
                        <i data-lucide="edit-3" style="width:14px;"></i>
                    </button>
                    ${asset.status === 'available' ? `<button class="btn btn-outline btn-sm" onclick="flagDamaged(${asset.id})" title="Report Damaged"><i data-lucide="alert-triangle" style="width:14px;"></i></button>` : ''}
                    <button class="btn btn-outline btn-sm" onclick="deleteAsset(${asset.id})" title="Delete Asset" style="color:var(--danger); border-color:rgba(239, 68, 68, 0.2)">
                        <i data-lucide="trash-2" style="width:14px;"></i>
                    </button>
                </div>
            </td>
        `;
        body.appendChild(tr);
    });
    
    if (window.lucide) lucide.createIcons();
}

window.toggleComponents = (id) => {
    if (openKitIds.has(id)) {
        openKitIds.delete(id);
    } else {
        openKitIds.add(id);
    }
    renderInventory(filteredAssets);
};

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

function openAssetModal(editId = null) {
    const asset = editId ? assets.find(a => a.id === editId) : null;
    const isEdit = !!asset;

    let categoryOptions = categories.map(c => `<option value="${c}" ${asset?.category === c ? 'selected' : ''}>${c}</option>`).join('');
    
    openModal(`
        <div class="modal-header">
            <h2>${isEdit ? 'Edit Asset' : 'Add New Asset'}</h2>
            <p style="color:var(--text-muted)">${isEdit ? 'Modify asset details and components.' : 'Register a new item at Sheen Academy.'}</p>
        </div>
        <div class="form-group">
            <label>Asset Name</label>
            <input type="text" id="asset-name" class="form-control" value="${asset?.name || ''}" placeholder="e.g. LEGO Spike Prime #5">
        </div>
        <div class="form-group">
            <label>Category</label>
            <div style="display:flex; gap:0.5rem;">
                <select id="asset-category-select" class="form-control" style="flex:1;">
                    <option value="">-- Select Category --</option>
                    ${categoryOptions}
                    <option value="__NEW__">+ Add New Category</option>
                </select>
            </div>
            <input type="text" id="asset-category-new" class="form-control" placeholder="Enter new category name" style="display:none; margin-top:0.5rem;">
        </div>
        
        <div class="form-group" style="margin-top:2rem;">
            <label style="display:flex; justify-content:space-between; align-items:center;">
                Attached Components (Kits)
                <button class="btn btn-outline btn-sm" onclick="addComponentRow()">+ Add Part</button>
            </label>
            <div id="component-builder" style="margin-top:1rem;">
                <!-- Rows injected here -->
            </div>
        </div>

        <div style="display:flex; gap:1rem; justify-content:flex-end; margin-top:2rem;">
            <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="confirmSaveAsset(${editId})">${isEdit ? 'Save Changes' : 'Add Asset'}</button>
        </div>
    `);

    // Handle initial components if editing
    if (isEdit && asset.components) {
        asset.components.forEach(c => addComponentRow(c.name, c.qty));
    } else if (!isEdit) {
        // add one empty row as a hint
        // addComponentRow(); 
    }

    // Dynamic Category Handler
    const select = document.getElementById('asset-category-select');
    const nextInput = document.getElementById('asset-category-new');
    select.addEventListener('change', (e) => {
        nextInput.style.display = e.target.value === '__NEW__' ? 'block' : 'none';
        if (e.target.value === '__NEW__') nextInput.focus();
    });
}

window.addComponentRow = (name = '', qty = 1) => {
    const builder = document.getElementById('component-builder');
    const div = document.createElement('div');
    div.className = 'component-builder-row animate-in';
    div.innerHTML = `
        <input type="text" placeholder="Part Name (e.g. Hub)" class="form-control comp-name" value="${name}" style="flex:2;">
        <input type="number" placeholder="Qty" class="form-control comp-qty" value="${qty}" style="flex:1;">
        <button class="btn btn-outline btn-sm" onclick="this.parentElement.remove()" style="color:var(--danger); border-color:rgba(239, 68, 68, 0.2)">
            <i data-lucide="trash-2" style="width:14px;"></i>
        </button>
    `;
    builder.appendChild(div);
    if (window.lucide) lucide.createIcons();
};

window.confirmSaveAsset = async (editId = null) => {
    const name = document.getElementById('asset-name').value;
    const catSelect = document.getElementById('asset-category-select').value;
    const catNew = document.getElementById('asset-category-new').value;
    
    let category = catSelect === '__NEW__' ? catNew : catSelect;

    if (!name || !category) {
        alert("Please provide both a Name and a Category.");
        return;
    }

    // Collect components
    const rows = document.querySelectorAll('.component-builder-row');
    const components = [];
    rows.forEach(row => {
        const cName = row.querySelector('.comp-name').value.trim();
        const cQty = parseInt(row.querySelector('.comp-qty').value);
        if (cName) {
            components.push({ name: cName, qty: isNaN(cQty) ? 1 : cQty });
        }
    });

    const payload = {
        name,
        category,
        components: components.length > 0 ? components : null,
    };

    if (!editId) {
        // Creating new
        payload.status = 'available';
        payload.condition = 'good';
        payload.last_action = `Registered - ${new Date().toISOString().split('T')[0]}`;
        
        const { error } = await supabase.from('assets').insert([payload]);
        if (error) alert("Error saving asset: " + error.message);
    } else {
        // Updating existing
        const { error } = await supabase.from('assets').update(payload).eq('id', editId);
        if (error) alert("Error updating asset: " + error.message);
    }

    closeModal();
    await loadData();
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
                    <option value="damaged">Item is Damaged</option>
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

    const { data: updateData, error: updateError } = await supabase
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
        alert("CONCURRENCY ERROR: This asset was just signed out by another colleague.");
        await loadData();
        closeModal();
        return;
    }

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
        status: condition === 'damaged' ? 'damaged' : 'available',
        condition: condition,
        borrower_name: null,
        reason: null,
        last_action: `Returned - ${today}`
    }).eq('id', id);

    await supabase.from('transactions').insert([{
        asset_id: id,
        asset_name: asset.name,
        user_name: borrower || "Unknown",
        action: "Returned",
        date: today,
        reason: condition === 'damaged' ? "Returned (Damaged)" : "Regular Return"
    }]);

    closeModal();
    await loadData();
};

window.deleteAsset = async (id) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    if (asset.status === 'signed-out') {
        alert("Cannot delete an asset that is currently signed out. Please have it returned first.");
        return;
    }

    if (confirm(`Are you sure you want to PERMANENTLY delete "${asset.name}"? This action cannot be undone.`)) {
        const today = new Date().toISOString().split('T')[0];

        // 1. Log the deletion for audit purposes
        await supabase.from('transactions').insert([{
            asset_id: id,
            asset_name: asset.name,
            user_name: "Staff",
            action: "Deleted",
            date: today,
            reason: "Asset removed from inventory permanently"
        }]);

        // 2. Delete from database
        const { error } = await supabase.from('assets').delete().eq('id', id);

        if (error) {
            alert("Error deleting asset: " + error.message);
        } else {
            await loadData();
        }
    }
};

window.flagDamaged = async (id) => {
    const asset = assets.find(a => a.id === id);
    if(confirm(`Are you sure you want to flag "${asset.name}" as DAMAGED?`)) {
        const today = new Date().toISOString().split('T')[0];
        
        await supabase.from('assets').update({
            status: 'damaged',
            condition: 'damaged',
            last_action: `Flagged Damaged - ${today}`
        }).eq('id', id);

        await supabase.from('transactions').insert([{
            asset_id: id,
            asset_name: asset.name,
            user_name: "Staff",
            action: "Flagged Damaged",
            date: today,
            reason: "Reported as damaged by staff member"
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
