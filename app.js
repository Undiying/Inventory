import supabase from './supabase-config.js';

// State management
let assets = [];
let transactions = [];
let filteredAssets = [];
let expandedGroups = new Set(); // Track which asset names are expanded
let openKitIds = new Set(); // Track which individual assets have their components expanded

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
    
    // Legacy Robotics Filter: checks name or internal category if it exists
    if (activeNav === 'nav-robotics') {
        baseItems = baseItems.filter(a => 
            (a.category && a.category === 'Robotics') || 
            a.name.toLowerCase().includes('kit') ||
            a.name.toLowerCase().includes('robotics')
        );
    }
    
    filteredAssets = baseItems.filter(item => 
        item.name.toLowerCase().includes(searchTerm) || 
        (item.tracking_id && item.tracking_id.toLowerCase().includes(searchTerm)) ||
        (item.location && item.location.toLowerCase().includes(searchTerm)) ||
        (item.borrower_name && item.borrower_name.toLowerCase().includes(searchTerm))
    );
    
    renderInventory(filteredAssets);
}

function renderInventory(items) {
    const body = document.getElementById('inventory-body');
    if(!body) return;
    body.innerHTML = '';

    // Group items by name
    const grouped = items.reduce((acc, item) => {
        if (!acc[item.name]) acc[item.name] = [];
        acc[item.name].push(item);
        return acc;
    }, {});

    Object.keys(grouped).sort().forEach(name => {
        const groupItems = grouped[name];
        const isExpanded = expandedGroups.has(name);
        
        // Group Header Row
        const groupTr = document.createElement('tr');
        groupTr.className = `group-row ${isExpanded ? 'expanded' : ''}`;
        groupTr.onclick = () => toggleGroup(name);
        
        const availableCount = groupItems.filter(i => i.status === 'available').length;
        const totalCount = groupItems.length;
        
        groupTr.innerHTML = `
            <td colspan="3">
                <div class="group-name-cell">
                    <i data-lucide="chevron-down" class="chevron-icon" style="width:16px;"></i>
                    <span>${name}</span>
                    <span class="asset-count-badge">${totalCount} item${totalCount > 1 ? 's' : ''}</span>
                </div>
            </td>
            <td>
                <span class="status-badge" style="background:rgba(255,255,255,0.05); color:var(--text-muted)">
                    ${availableCount} / ${totalCount} Available
                </span>
            </td>
            <td class="hide-mobile"></td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); handleGroupAction('${name}')">
                    ${availableCount > 0 ? 'Sign Out' : 'Details'}
                </button>
            </td>
        `;
        body.appendChild(groupTr);

        // Individual Item Rows (if expanded)
        if (isExpanded) {
            groupItems.forEach(asset => {
                const itemTr = document.createElement('tr');
                itemTr.className = 'item-row animate-in';
                itemTr.innerHTML = `
                    <td class="indent-cell">
                        <div style="font-size:0.75rem; color:var(--text-muted)">ID: ${asset.tracking_id || 'N/A'}</div>
                    </td>
                    <td>${asset.tracking_id || '--'}</td>
                    <td>
                        <div class="location-tag">
                            <i data-lucide="map-pin" style="width:12px;"></i>
                            ${asset.location || 'Unknown'}
                        </div>
                    </td>
                    <td>
                        <span class="status-badge status-${asset.status}">
                            ${asset.status.replace('-', ' ')}
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
                            <button class="btn btn-outline btn-sm" onclick="deleteAsset(${asset.id})" title="Delete Asset" style="color:var(--danger); border-color:rgba(239, 68, 68, 0.2)">
                                <i data-lucide="trash-2" style="width:14px;"></i>
                            </button>
                        </div>
                    </td>
                `;

                // Add component toggle if it has components
                const hasComponents = asset.components && asset.components.length > 0;
                if (hasComponents) {
                    const isKitExpanded = openKitIds.has(asset.id);
                    const componentTd = itemTr.querySelector('.indent-cell');
                    componentTd.innerHTML += `
                        <button class="toggle-components-btn" onclick="event.stopPropagation(); toggleComponents(${asset.id})">
                            <i data-lucide="${isKitExpanded ? 'chevron-up' : 'chevron-down'}" style="width:12px;"></i>
                            ${isKitExpanded ? 'Hide' : 'Show'} components
                        </button>
                        ${isKitExpanded ? `
                            <div class="inline-components-list" style="margin-left: 0;">
                                ${asset.components.map(c => `
                                    <div class="inline-component-item">
                                        <span>${c.name}</span>
                                        <span>x${c.qty}</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    `;
                }

                body.appendChild(itemTr);
            });
        }
    });

    if (window.lucide) lucide.createIcons();
}

window.toggleGroup = (name) => {
    if (expandedGroups.has(name)) {
        expandedGroups.delete(name);
    } else {
        expandedGroups.add(name);
    }
    renderInventory(filteredAssets);
};

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

window.openAssetModal = (editId = null) => {
    const asset = editId ? assets.find(a => a.id === editId) : null;
    const isEdit = !!asset;

    openModal(`
        <div class="modal-header">
            <h2>${isEdit ? 'Edit Asset' : 'Add New Asset'}</h2>
            <p style="color:var(--text-muted)">${isEdit ? 'Modify asset details and components.' : 'Register a new item at Sheen Academy.'}</p>
        </div>
        <div class="form-group">
            <label>Asset Name</label>
            <div style="display:flex; flex-direction:column; gap:0.25rem;">
                <input type="text" id="asset-name" class="form-control" value="${asset?.name || ''}" placeholder="e.g. LEGO Spike Prime">
                <small style="color:var(--text-muted)">Items with the same name will be grouped together.</small>
            </div>
        </div>
        <div class="form-group" style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
                <label>Tracking ID</label>
                <input type="text" id="asset-tracking-id" class="form-control" value="${asset?.tracking_id || ''}" placeholder="e.g. #001">
            </div>
            <div>
                <label>Current Location</label>
                <input type="text" id="asset-location" class="form-control" value="${asset?.location || ''}" placeholder="e.g. Robotics Lab">
            </div>
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
    }
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
    const tracking_id = document.getElementById('asset-tracking-id').value;
    const location = document.getElementById('asset-location').value;

    if (!name || !tracking_id) {
        alert("Please provide both a Name and a Tracking ID.");
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
        tracking_id,
        location,
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

window.handleGroupAction = (name) => {
    const groupItems = assets.filter(a => a.name === name);
    const availableItems = groupItems.filter(a => a.status === 'available');

    if (availableItems.length === 0) {
        // Just show the list (expand it)
        expandedGroups.add(name);
        renderInventory(filteredAssets);
        return;
    }

    if (availableItems.length === 1) {
        // Only one available, proceed to sign out
        handleAction(availableItems[0].id);
        return;
    }

    // Multiple available, show picker
    const pickerHtml = availableItems.map(item => `
        <div class="stat-card" style="padding:1rem; cursor:pointer;" onclick="closeModal(); handleAction(${item.id})">
            <div style="font-weight:600">${item.tracking_id || 'No ID'}</div>
            <div style="font-size:0.8rem; color:var(--text-muted)">Location: ${item.location || 'Unknown'}</div>
        </div>
    `).join('');

    openModal(`
        <div class="modal-header">
            <h2>Select Asset to Sign Out</h2>
            <p style="color:var(--text-muted)">Multiple items for <strong>${name}</strong> are available. Select which one you are taking.</p>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-top:1rem;">
            ${pickerHtml}
        </div>
        <div style="display:flex; justify-content:flex-end; margin-top:2rem;">
            <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
        </div>
    `);
};

window.handleAction = (id) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    const displayId = asset.tracking_id ? ` [${asset.tracking_id}]` : '';

    if (asset.status === 'signed-out') {
        openModal(`
            <div class="modal-header">
                <h2>Return Asset</h2>
                <p style="color:var(--text-muted)">Returning <strong>${asset.name}${displayId}</strong></p>
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
                <p style="color:var(--text-muted)">Checking out <strong>${asset.name}${displayId}</strong></p>
            </div>
            <div class="form-group">
                <label>Your Name</label>
                <input type="text" id="signer-name" class="form-control" placeholder="Who is taking it?">
            </div>
            <div class="form-group">
                <label>Reason / Destination</label>
                <input type="text" id="signer-reason" class="form-control" placeholder="e.g. Outreach at London School">
            </div>
            <div style="display:flex; gap:1rem; justify-content:flex-end; margin-top:2rem;">
                <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="confirmSignOut(${id})">Confirm Sign Out</button>
            </div>
        `);
    } else if (asset.status === 'damaged') {
        openModal(`
            <div class="modal-header">
                <h2>Damaged Asset Details</h2>
                <p style="color:var(--text-muted)"><strong>${asset.name}${displayId}</strong> is currently marked as damaged.</p>
            </div>
            <div class="form-group">
                <p>Status: <span class="status-badge status-damaged">Damaged</span></p>
                <p style="margin-top:0.5rem; font-size:0.9rem;">Location: ${asset.location || 'N/A'}</p>
                <p style="margin-top:0.25rem; font-size:0.9rem;">Last Action: ${asset.last_action}</p>
            </div>
            <div style="display:flex; gap:1rem; justify-content:flex-end; margin-top:2rem;">
                <button class="btn btn-outline" onclick="closeModal()">Close</button>
                <button class="btn btn-primary" onclick="markFixed(${id})">Mark as Fixed / Available</button>
            </div>
        `);
    }
};

window.markFixed = async (id) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    const today = new Date().toISOString().split('T')[0];

    await supabase.from('assets').update({
        status: 'available',
        condition: 'good',
        last_action: `Fixed/Restored - ${today}`
    }).eq('id', id);

    // No transaction log needed as per user request ("The system doesnt need to record that")
    
    closeModal();
    await loadData();
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
