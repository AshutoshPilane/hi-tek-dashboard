// ==============================================================================
// script.js: ONLINE VERSION (Google Sheet API Integration)
// Data is fetched from and sent to the live Google Sheet via a Web App.
// ==============================================================================

// 🎯 CRITICAL: PASTE YOUR NEW VERIFIED APPS SCRIPT URL HERE!
// !!! REPLACE THIS PLACEHOLDER AFTER PUBLISHING YOUR GOOGLE APPS SCRIPT !!!
// NOTE: Renamed variable to match usage in postDataToSheet
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxPem8Y-rANmN6hc2tyuCd1O1lgUoCVwYHn4mV8K1-QwhVkWSCzjf_k7WQkCh8_gcEnMw/s"; 

let currentProjectID = null; 
let allProjects = [];

// --- 1. THE HI TEK 23-STEP WORKFLOW LIST ---
const HI_TEK_TASKS_MAP = [
    { Name: '1. Understanding the System', Responsible: 'Project Manager' },
    { Name: '2. Identifying Scope', Responsible: 'Site Engineer/Project coordinator' },
    { Name: '3. Measurement', Responsible: 'Surveyor/Field Engineer' },
    { Name: '4. Cross-Check Scope', Responsible: 'Site Engineer/Quality Inspector' },
    { Name: '5. Calculate Project Cost', Responsible: 'Estimation Engineer/Cost Analyst' },
    { Name: '6. Review Payment Terms', Responsible: 'Accounts Manager/Contract Specialist' },
    { Name: '7. Calculate BOQ', Responsible: 'Estimation Engineer/Procurement Manager' },
    { Name: '8. Compare Costs', Responsible: 'Procurement Manager/Cost Analyst' },
    { Name: '9. Manage Materials', Responsible: 'Procurement Manager/Warehouse Supervisor' },
    { Name: '10. Prepare BOQ for Production', Responsible: 'Production Planner' },
    { Name: '11. Approval from Director', Responsible: 'Director/General Manager' },
    { Name: '12. Production', Responsible: 'Production Supervisor' },
    { Name: '13. Post-Production Check', Responsible: 'Quality Inspector' },
    { Name: '14. Dispatch', Responsible: 'Logistics Manager' },
    { Name: '15. Installation', Responsible: 'Site Engineer' },
    { Name: '16. Handover Measurements', Responsible: 'Surveyor' },
    { Name: '17. Cross-Check Final Work', Responsible: 'Quality Inspector' },
    { Name: '18. Create Abstract Invoice', Responsible: 'Accounts Manager' },
    { Name: '19. Approval from Director', Responsible: 'Director' },
    { Name: '20. Process Invoice', Responsible: 'Accounts Executive' },
    { Name: '21. Submit Bill On-Site', Responsible: 'Accounts Executive' },
    { Name: '22. Payment Follow-Up', Responsible: 'Accounts Manager' },
    { Name: '23. Submit No-Objection Letter', Responsible: 'Project Manager' }
];

// ==============================================================================
// 2. DATA UTILITIES (API FUNCTIONS) - COMPLETE CORS WORKAROUND VERSION
// All data traffic uses the CORS-exempt form submission method.
// ==============================================================================

/**
 * Main function to communicate with the Google Apps Script Web App.
 * Uses a hidden iframe/form submission technique to bypass CORS restrictions.
 * * @param {object} payload - The data to send to the Apps Script (includes 'action').
 * @param {boolean} isGet - True if this is a Read action (expects JSON response).
 * @returns {Promise<object|Array>} Resolves with data array for GET, or status object for POST.
 */
function postDataToSheet(payload, isGet = false) {
    return new Promise((resolve, reject) => {
        // 1. Create a dynamic form and iframe
        const form = document.createElement('form');
        form.action = APPS_SCRIPT_URL; // Uses the /s endpoint URL
        form.method = 'POST';
        form.target = 'iframe_upload';
        form.style.display = 'none';

        const iframe = document.createElement('iframe');
        iframe.name = 'iframe_upload';
        iframe.style.display = 'none';

        // 2. Append payload data as hidden fields
        for (const key in payload) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = payload[key];
            form.appendChild(input);
        }

        document.body.appendChild(iframe);
        document.body.appendChild(form);

        // 3. Handle response using iframe.onload
        iframe.onload = () => {
            let responseText = '';
            
            try {
                // Reading content should now work with the /s URL
                responseText = iframe.contentWindow.document.body.textContent;
            } catch (e) {
                // Fallback for unexpected security issues
                console.warn("Iframe content reading failed unexpectedly. Using fallback.", e);
                responseText = isGet ? '' : 'success_callback'; 
            }
            
            // Cleanup
            form.remove();
            iframe.remove();

            const trimmedResponse = String(responseText || '').trim();

            if (isGet) {
                // For GET/Read requests, we expect a JSON string response
                try {
                    const result = JSON.parse(trimmedResponse);
                    
                    if (result.status === 'success') {
                        console.log("SUCCESSFUL GET RESPONSE DATA:", result.data);
                        resolve(result.data || []); // Resolve with the data array
                    } else {
                        console.error(`API Error for ${payload.action}:`, result.message);
                        resolve([]); // Resolve with empty array on server-side error
                    }
                } catch (e) {
                    console.error(`GET response parsing failed for ${payload.action}: Raw Response:`, trimmedResponse, e);
                    resolve([]); // Resolve with empty array on parsing error
                }
            } else {
                // For POST/Write requests, we expect the simple 'success_callback' string
                if (trimmedResponse.includes('success_callback')) {
                    resolve({ status: 'success', message: 'Operation successful' });
                } else {
                    console.error('Server reported an error (via form submission): Raw Response:', trimmedResponse);
                    const message = trimmedResponse.replace('error_callback:', '').trim() || 'Operation failed. Check Apps Script logs.';
                    reject({ status: 'error', message: message });
                }
            }
        };

        // 4. Submit the form to trigger the Apps Script execution
        form.submit();
    });
}


/**
 * Helper function to call postDataToSheet for GET actions.
 * @param {string} action - The action string (e.g., 'getProjects').
 * @param {string} [projectID] - Optional Project ID for filtering.
 * @returns {Promise<Array>}
 */
function fetchDataFromSheet(action, projectID = '') {
    const payload = {
        action: action,
        projectID: projectID
    };
    return postDataToSheet(payload, true);
}


// ==============================================================================
// 3. CORE LOGIC FUNCTIONS
// ==============================================================================

async function loadProjects() {
    allProjects = await fetchDataFromSheet('getProjects');
    
    const selector = document.getElementById('projectSelector');
    selector.innerHTML = ''; 
    
    // CRITICAL FIX: Ensure allProjects is an array before filtering, and check for null/undefined objects
    const validProjects = (allProjects || []).filter(project => 
        project && String(project.ProjectID || '').trim()
    );

    if (validProjects.length === 0) {
        selector.innerHTML = '<option value="">-- No Projects Found --</option>';
        document.getElementById('currentProjectName').textContent = 'Please add a project.';
        // Clear dashboard view when no projects are present
        currentProjectID = null;
        renderDashboard(); 
        return;
    }

    validProjects.forEach(project => {
        const option = document.createElement('option');
        option.value = String(project.ProjectID).trim(); 
        option.textContent = project.Name;
        selector.appendChild(option);
    });

    const storedProjectID = localStorage.getItem('currentProjectID');
    const projectToSelect = validProjects.find(p => String(p.ProjectID).trim() === storedProjectID) 
                            ? storedProjectID 
                            : validProjects[0].ProjectID;

    selector.value = String(projectToSelect).trim();
    handleProjectSelectionChange(String(projectToSelect).trim());
}

function handleProjectSelectionChange(id) {
    currentProjectID = id;
    localStorage.setItem('currentProjectID', id);
    if (currentProjectID) {
        renderDashboard();
    }
}

async function renderDashboard() {
    if (!currentProjectID) {
        // Clear all dashboard elements if no project is selected
        document.getElementById('currentProjectName').textContent = 'Select a Project';
        document.getElementById('taskTableBody').innerHTML = '<tr><td colspan="5">No tasks loaded...</td></tr>';
        document.getElementById('materialTableBody').innerHTML = '<tr><td colspan="5">No materials loaded...</td></tr>';
        document.getElementById('recentExpensesList').innerHTML = '<li class="placeholder">No expenses loaded...</li>';
        
        // Reset KPIs and details display
        renderProjectDetails({});
        renderKPIs({}, [], [], []);
        return;
    }

    // Show loading state
    document.getElementById('currentProjectName').textContent = 'Loading...';

    const currentProject = allProjects.find(p => String(p.ProjectID).trim() === String(currentProjectID).trim());
    if (!currentProject) {
        document.getElementById('currentProjectName').textContent = 'Project Not Found';
        return;
    }

    document.getElementById('currentProjectName').textContent = `${currentProject.Name} (${currentProject.ProjectID})`;

    renderProjectDetails(currentProject);

    // Fetch all related data in parallel
    const [tasks, expenses, materials] = await Promise.all([
        fetchDataFromSheet('getTasks', currentProjectID),
        fetchDataFromSheet('getExpenses', currentProjectID),
        fetchDataFromSheet('getMaterials', currentProjectID)
    ]);
    
    // Sort tasks numerically (important for dependency logic)
    const sortedTasks = tasks.sort((a, b) => {
        const numA = parseInt(a.Name);
        const numB = parseInt(b.Name);
        return numA - numB;
    });

    renderTaskTable(sortedTasks);
    populateTaskUpdateSelector(sortedTasks); 
    
    renderRecentExpenses(expenses);
    
    renderMaterialTable(materials);
    populateMaterialSelector(materials);
    
    renderKPIs(currentProject, sortedTasks, expenses, materials);
}

function renderProjectDetails(project) {
    const formatAmount = (amount) => {
        if (!amount || isNaN(Number(amount))) return 'N/A';
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(Number(amount));
    };

    document.getElementById('display-name').textContent = project.Name || 'N/A';
    document.getElementById('display-start-date').textContent = project.StartDate ? new Date(project.StartDate).toLocaleDateString() : 'N/A';
    document.getElementById('display-deadline').textContent = project.Deadline ? new Date(project.Deadline).toLocaleDateString() : 'N/A';
    document.getElementById('display-location').textContent = project.Location || 'N/A';
    document.getElementById('display-amount').textContent = formatAmount(project.Amount);
    document.getElementById('display-contractor').textContent = project.Contractor || 'N/A';
    document.getElementById('display-engineers').textContent = project.Engineers || 'N/A';
    document.getElementById('display-contact1').textContent = project.Contact1 || 'N/A';
    document.getElementById('display-contact2').textContent = project.Contact2 || 'N/A';

    // Populate edit form
    document.getElementById('input-name').value = project.Name || '';
    document.getElementById('input-start-date').value = project.StartDate ? project.StartDate.split('T')[0] : '';
    document.getElementById('input-deadline').value = project.Deadline ? project.Deadline.split('T')[0] : '';
    document.getElementById('input-location').value = project.Location || '';
    document.getElementById('input-amount').value = project.Amount || '';
    document.getElementById('input-contractor').value = project.Contractor || '';
    document.getElementById('input-engineers').value = project.Engineers || '';
    document.getElementById('input-contact1').value = project.Contact1 || '';
    document.getElementById('input-contact2').value = project.Contact2 || '';
}

function renderRecentExpenses(expenses) {
    const list = document.getElementById('recentExpensesList');
    list.innerHTML = '';
    
    if (expenses.length === 0) {
        list.innerHTML = '<li class="placeholder">No expenses recorded yet.</li>';
        return;
    }

    const recentExpenses = expenses.sort((a, b) => new Date(b.Date) - new Date(a.Date)).slice(0, 5);

    recentExpenses.forEach(expense => {
        const dateString = expense.Date ? new Date(expense.Date).toLocaleDateString() : 'N/A';
        const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(Number(expense.Amount));
        
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <span class="expense-date">[${dateString}]</span>
            <span class="expense-desc">${expense.Description}</span>
            <span class="expense-amount">${formattedAmount} (${expense.Category})</span>
        `;
        list.appendChild(listItem);
    });
}

function renderMaterialTable(materials) {
    const tableBody = document.getElementById('materialTableBody');
    tableBody.innerHTML = '';

    if (materials.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">No materials recorded for this project.</td></tr>';
        return;
    }
    
    materials.forEach(material => {
        const required = Number(material.RequiredQty) || 0;
        const dispatched = Number(material.DispatchedQty) || 0; 
        const balance = required - dispatched;
        const percentage = required > 0 ? Math.min(100, Math.round((dispatched / required) * 100)) : 0;
        
        const balanceClass = balance > 0 ? 'status-pending' : (balance <= 0 ? 'status-complete' : '');

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${material.ItemName || 'N/A'}</td>
            <td>${required} ${material.Unit || ''}</td>
            <td>${dispatched} ${material.Unit || ''}</td>
            <td class="${balanceClass}">${balance} ${material.Unit || ''}</td>
            <td>
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${percentage}%;"></div>
                    <span class="progress-text">${percentage}%</span>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function populateMaterialSelector(materials) {
    const selector = document.getElementById('materialItemId');
    selector.innerHTML = '<option value="">-- Select Existing Material --</option>';

    if (materials.length === 0) return;

    materials.forEach(material => {
        const option = document.createElement('option');
        option.value = material.ItemName; 
        option.textContent = `${material.ItemName} (Req: ${material.RequiredQty} ${material.Unit})`;
        selector.appendChild(option);
    });
}


function renderKPIs(project, tasks, expenses, materials) {
    const startDate = project.StartDate ? new Date(project.StartDate) : null;
    const deadline = project.Deadline ? new Date(project.Deadline) : null;
    const today = new Date();
    
    const calculateDays = (date1, date2) => {
        if (!date1 || !date2) return 'N/A';
        const diffTime = Math.abs(date2 - date1);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const formatAmount = (amount) => {
        if (isNaN(Number(amount)) || Number(amount) === 0) return '₹ 0';
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(Number(amount));
    };

    const daysSpent = startDate ? calculateDays(startDate, today) : 'N/A';
    let daysLeft = deadline ? Math.max(0, Math.ceil((deadline - today) / (1000 * 60 * 60 * 24))) : 'N/A';
    document.getElementById('kpi-days-spent').textContent = daysSpent !== 'N/A' ? `${daysSpent} days` : 'N/A';
    document.getElementById('kpi-days-left').textContent = daysLeft !== 'N/A' ? `${daysLeft} days` : 'N/A';

    let overallProgress = 0;
    const tasksWithProgress = tasks.filter(task => Number(task.Progress) >= 0);

    if (tasksWithProgress.length > 0) {
        const totalProgress = tasksWithProgress.reduce((sum, task) => sum + (Number(task.Progress) || 0), 0);
        overallProgress = Math.round(totalProgress / tasksWithProgress.length);
    }
    document.getElementById('kpi-progress').textContent = `${overallProgress}%`;

    const workOrderAmount = Number(project.Amount) || 0;
    const totalExpenses = expenses.reduce((sum, expense) => sum + (Number(expense.Amount) || 0), 0);
    document.getElementById('kpi-work-order').textContent = formatAmount(workOrderAmount);
    document.getElementById('kpi-total-expenses').textContent = formatAmount(totalExpenses);
    
    let overallMaterialProgress = 0;
    if (materials.length > 0) {
        const totalRequired = materials.reduce((sum, m) => sum + (Number(m.RequiredQty) || 0), 0);
        const totalDispatched = materials.reduce((sum, m) => sum + (Number(m.DispatchedQty) || 0), 0);
        
        if (totalRequired > 0) {
            overallMaterialProgress = Math.min(100, Math.round((totalDispatched / totalRequired) * 100));
        }
    }
    document.getElementById('kpi-material-progress').textContent = `${overallMaterialProgress}% Dispatched`;
}

function populateTaskUpdateSelector(tasks) {
    const taskSelector = document.getElementById('taskId');
    taskSelector.innerHTML = '<option value="">-- Select a Task --</option>';    

    if (tasks.length === 0) return;

    let isPreviousTaskComplete = true; 

    tasks.forEach((task, index) => {
        const option = document.createElement('option');
        option.value = String(task.Name).trim(); 
        option.textContent = `${task.Name} (${task.Progress || 0}%) - ${task.Responsible}`;

        // Dependency Logic (lock current if previous is incomplete)
        if (index > 0) {
            const previousTask = tasks[index - 1];
            if (Number(previousTask.Progress) < 100) {
                isPreviousTaskComplete = false;
            }
        }
        
        if (!isPreviousTaskComplete && Number(task.Progress) < 100) {
             option.disabled = true;
             option.textContent += ' (LOCKED)';
        }

        taskSelector.appendChild(option);

        // Reset the flag if the current task is still incomplete
        if (Number(task.Progress) < 100) {
            isPreviousTaskComplete = false;
        }
    });

    taskSelector.onchange = function handler(e) {
    const selectedTask = tasks.find(t => String(t.Name).trim() === String(e.target.value).trim());
    if (selectedTask) {
        document.getElementById('taskProgress').value = String(selectedTask.Progress || 0); 
        document.getElementById('taskDue').value = selectedTask.DueDate ? selectedTask.DueDate.split('T')[0] : '';
    }
};
}

function renderTaskTable(tasks) {
    const tableBody = document.getElementById('taskTableBody');
    tableBody.innerHTML = '';

    if (tasks.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">No tasks defined for this project.</td></tr>';
        return;
    }
    
    tasks.forEach((task, index) => {
        const progressPercent = Number(task.Progress) || 0;
        const statusClass = progressPercent === 100 ? 'status-complete' : (progressPercent > 0 ? 'status-in-progress' : 'status-pending');
        const dueDateString = task.DueDate ? new Date(task.DueDate).toLocaleDateString() : 'N/A';

        const row = document.createElement('tr');
        row.setAttribute('data-progress', progressPercent); 
        
        row.innerHTML = `
            <td>${task.Name || 'N/A'}</td>
            <td>${task.Responsible || 'N/A'}</td>
            <td>
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${progressPercent}%;"></div>
                    <span class="progress-text">${progressPercent}%</span>
                </div>
            </td>
            <td>${dueDateString}</td>
            <td class="${statusClass} status-cell">${progressPercent === 100 ? 'Complete' : (progressPercent > 0 ? 'In Progress' : 'Pending')}</td>
        `;
        tableBody.appendChild(row);
    });
}


// ==============================================================================
// 4. EVENT LISTENERS (Send Data to Sheet)
// ==============================================================================

document.getElementById('editProjectDetailsBtn').addEventListener('click', () => {
    document.getElementById('projectDetailsDisplay').style.display = 'none';
    document.getElementById('projectDetailsEdit').style.display = 'block';
    document.getElementById('editProjectDetailsBtn').style.display = 'none';
    document.getElementById('saveProjectDetailsBtn').style.display = 'block';
});

document.getElementById('saveProjectDetailsBtn').addEventListener('click', async () => {
    if (!currentProjectID) return alert('No project is selected.');

    const data = {
        ProjectID: currentProjectID, 
        Name: document.getElementById('input-name').value,
        StartDate: document.getElementById('input-start-date').value,
        Deadline: document.getElementById('input-deadline').value,
        Location: document.getElementById('input-location').value,
        Amount: document.getElementById('input-amount').value,
        Contractor: document.getElementById('input-contractor').value,
        Engineers: document.getElementById('input-engineers').value,
        Contact1: document.getElementById('input-contact1').value,
        Contact2: document.getElementById('input-contact2').value,
    };
    
    const payload = { action: 'updateProject', projectID: currentProjectID, data: JSON.stringify(data) };
    
    // NOTE: The data property must be stringified for form submission, fixed in the payload creation here.
    const result = await postDataToSheet(payload); 

    if (result.status === 'success') {
        alert('Project details saved online successfully!');
        document.getElementById('projectDetailsDisplay').style.display = 'block';
        document.getElementById('projectDetailsEdit').style.display = 'none';
        document.getElementById('editProjectDetailsBtn').style.display = 'block';
        document.getElementById('saveProjectDetailsBtn').style.display = 'none';
        await loadProjects(); 
    } else {
        alert(`Failed to save project details: ${result.message}`);
    }
});

document.getElementById('projectSelector').addEventListener('change', (e) => {
    handleProjectSelectionChange(e.target.value);
});

document.getElementById('expenseEntryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentProjectID) return alert('Please select a project first.');

    const form = e.target;
    const payload = {
        action: 'addExpense',
        projectID: currentProjectID,
        date: form.expenseDate.value,
        description: form.expenseDescription.value,
        amount: Number(form.expenseAmount.value),
        category: form.expenseCategory.value,
    };

    const result = await postDataToSheet(payload);
    
    if (result.status === 'success') {
        alert('Expense recorded successfully!');
        form.reset(); 
        renderDashboard(); 
    } else {
        alert(`Failed to record expense: ${result.message}`);
    }
});


document.getElementById('updateTaskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentProjectID) return alert('Please select a project first.');

    const form = e.target;
    const taskName = form.taskId.value;
    
    if (!taskName) return alert('Please select a task to update.');

    const payload = {
        action: 'updateTask',
        projectID: currentProjectID,
        taskName: taskName,
        progress: Number(form.taskProgress.value),
        dueDate: form.taskDue.value,
    };

    const result = await postDataToSheet(payload);
    
    if (result.status === 'success') {
        alert('Task updated successfully!');
        form.reset(); 
        renderDashboard(); 
    } else {
        alert(`Failed to update task: ${result.message}`);
    }
});

document.getElementById('recordDispatchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentProjectID) return alert('Please select a project first.');

    const form = e.target;
    
    const selectedItemName = document.getElementById('materialItemId')?.value || ''; 
    const newMaterialName = (document.getElementById('newMaterialName')?.value || '').trim();
    const dispatchQuantity = Number(form.dispatchQuantity.value);
    
    let itemName = '';
    let isNewMaterial = false;

    if (selectedItemName !== '') {
        itemName = selectedItemName;
    } else if (newMaterialName !== '') { 
        itemName = newMaterialName;
        isNewMaterial = true;
    } else {
        return alert('Please select an existing material OR enter a new material name.');
    }
    
    // Validation: Only allow dispatchQuantity of 0 when adding a NEW material
    if (!isNewMaterial && (dispatchQuantity <= 0 || isNaN(dispatchQuantity))) {
        return alert('When updating an existing material, Dispatch Quantity must be 1 or greater.');
    }
    if (isNewMaterial && (dispatchQuantity < 0 || isNaN(dispatchQuantity))) {
        return alert('Dispatch Quantity cannot be negative.');
    }

    if (!form.materialUnit.value.trim()) {
        return alert('Please enter a Unit (e.g., Unit, Ton).');
    }
    
    if (isNewMaterial) {
        if (!form.requiredQuantity.value || Number(form.requiredQuantity.value) <= 0) {
            return alert('Please enter a valid Required Quantity when adding a new material.');
        }
    }

    const payload = {
        action: 'recordDispatch',
        projectID: currentProjectID,
        itemName: itemName,
        dispatchQuantity: dispatchQuantity,
        unit: form.materialUnit.value,
        requiredQuantity: isNewMaterial ? Number(form.requiredQuantity.value) : undefined, 
        dispatchDate: new Date().toISOString().split('T')[0]
    };

    const result = await postDataToSheet(payload);

    if (result.status === 'success') {
        alert(`Material dispatch recorded for ${itemName} successfully!`);
        form.reset(); 
        renderDashboard(); 
    } else {
        alert(`Failed to record dispatch: ${result.message}`);
    }
});


document.getElementById('addProjectBtn').addEventListener('click', async () => {
    const newName = prompt("Enter the Name for the New Project:");
    if (!newName) return;
    
    // Create a new unique ID
    const newID = 'P' + Date.now().toString().slice(-4); 
    
    const projectData = {
        Name: newName, 
        ProjectID: newID, 
        StartDate: new Date().toISOString().split('T')[0], 
        Deadline: new Date().toISOString().split('T')[0], 
        Location: 'New Site', 
        Amount: 0,
        Contractor: 'TBD', 
        Engineers: 'TBD', 
        Contact1: '', 
        Contact2: ''
    };

    const payload = {
        action: 'addProjectWithTasks', 
        projectID: newID,
        // CRITICAL: Must JSON.stringify non-simple form data for the backend to parse
        projectData: JSON.stringify(projectData), 
        defaultTasks: JSON.stringify(HI_TEK_TASKS_MAP) 
    };
    
    const result = await postDataToSheet(payload);
    
    if (result.status === 'success') {
        alert(`Project "${newName}" added successfully with ID ${newID}. All 23 official tasks are now loaded to the sheet.`);
    } else {
        alert(`Failed to add project. Please check the console.`);
    }
    
    await loadProjects();
});

document.getElementById('deleteProjectBtn').addEventListener('click', () => {
    if (!currentProjectID) return alert('No project is selected.');
    const currentProject = allProjects.find(p => String(p.ProjectID).trim() === String(currentProjectID).trim());
    
    // NOTE: Manual deletion is advised for comprehensive cleanup across multiple sheets.
    const confirmDelete = confirm(`WARNING: Deleting Project "${currentProject.Name}" requires manual removal of all associated data rows (Tasks, Expenses, Materials) from all four tabs in the Google Sheet. Proceed to the Google Sheet?`);
    
    if (confirmDelete) {
        window.open('https://docs.google.com/spreadsheets/', '_blank');
        alert("Please manually delete the project data row from ALL 4 tabs in your Google Sheet.");
    }
});


// ==============================================================================
// 5. INITIALIZATION
// ==============================================================================


document.addEventListener('DOMContentLoaded', loadProjects);
