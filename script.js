// ==============================================================================
// script.js: ONLINE VERSION (Google Sheet API Integration)
// Data is fetched from and sent to the live Google Sheet via a Web App.
// ==============================================================================

// 🎯 CRITICAL: This is the local proxy path handled by Netlify's _redirects file.
// The Netlify configuration will secretly forward this request to the long Google URL.
const SHEET_API_URL = "/api/exec"; 

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
    { Name: '12. Project Launch', Responsible: 'Project Manager' },
    { Name: '13. Site Preparation', Responsible: 'Site Engineer' },
    { Name: '14. Installation Planning', Responsible: 'Installation Manager' },
    { Name: '15. Material Delivery', Responsible: 'Logistics/Warehouse Supervisor' },
    { Name: '16. Start Installation', Responsible: 'Installation Team' },
    { Name: '17. Quality Check 1 (Mid-point)', Responsible: 'Quality Inspector' },
    { Name: '18. Installation Completion', Responsible: 'Installation Team' },
    { Name: '19. Final Quality Check', Responsible: 'Quality Inspector' },
    { Name: '20. Client Handover', Responsible: 'Project Manager' },
    { Name: '21. Final Documentation', Responsible: 'Project Coordinator/Accounts' },
    { Name: '22. Invoice Submission', Responsible: 'Accounts Manager' },
    { Name: '23. Payment Follow-up', Responsible: 'Accounts Manager' }
];

// --- 2. API INTERACTION UTILITIES ---

/**
 * Custom error class for API failures.
 */
class ApiError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = "ApiError";
        this.details = details;
    }
}

/**
 * General utility to send data to the Google Apps Script Web App.
 * @param {object} data The payload to send.
 * @returns {Promise<object>} The JSON response from the Apps Script.
 */
async function postDataToSheet(data) {
    try {
        // Use the relative path (e.g., /api/exec) which will be proxied by Netlify
        const response = await fetch(SHEET_API_URL, {
            method: 'POST',
            // mode: 'cors' is removed as it's often unnecessary/problematic when using a proxy
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        // Check if the HTTP response itself was successful (status 200-299)
        if (!response.ok) {
            console.error(`[Hi Tek API Error] HTTP Error Status: ${response.status} ${response.statusText}. Check if the Apps Script URL in _redirects is correct.`);
            throw new ApiError(`HTTP Error: ${response.status} ${response.statusText}`, { status: response.status });
        }

        // Try to parse the JSON response
        const result = await response.json();
        
        // Check for an error status returned by the Apps Script's apiWrapper
        if (result.status === 'error') {
            // Log the detailed server error from Code.gs
            console.error('[Hi Tek API Error] Server-side error received:', result.errorDetail || result.message);
            throw new ApiError(result.message, { detail: result.errorDetail });
        }

        return result;

    } catch (error) {
        if (error instanceof ApiError) {
            throw error; // Re-throw custom errors
        }
        
        // Catch general network or JSON parsing errors
        console.error('[Hi Tek API Error] Network or Parsing Failure:', error.message);
        console.warn('Common Fixes: 1. Ensure Netlify/Vercel proxy is configured via _redirects. 2. Verify the Apps Script is deployed as "Anyone".');
        throw new ApiError("Could not connect to the Google Sheet.", { originalError: error.message });
    }
}

/**
 * Shows an alert/message box for errors or success.
 * @param {string} message The message to display.
 * @param {string} type 'error' or 'success'. Defaults to 'error'.
 */
function displayStatusMessage(message, type = 'error') {
    console.log(`[APP MESSAGE (${type.toUpperCase()})] ${message}`);
    const msgElement = document.getElementById('statusMessage');
    
    if (msgElement) {
        msgElement.textContent = message;
        msgElement.className = ''; // Reset classes
        msgElement.classList.add('status-message', type);
        
        // Set a timeout to clear the message after 8 seconds
        setTimeout(() => {
            msgElement.textContent = '';
            msgElement.classList.remove('error', 'success');
        }, 8000);
    } else {
        // Log to console if the element is missing (for environments without the UI)
        console.warn(`[UI Warning] Could not find statusMessage element.`);
    }
}

// --- 3. DATA FETCHING AND RENDERING ---

/**
 * Loads the list of projects for the selector.
 */
async function loadProjects() {
    const selector = document.getElementById('projectSelector');
    // Ensure we start with a clean message and loading indicator
    selector.innerHTML = '<option value="">Loading Projects...</option>'; 

    try {
        // Send a request to fetch all project data (no projectID means all projects)
        const data = await postDataToSheet({ action: 'fetchData' });
        
        allProjects = data.projects || [];
        
        // If there are no projects, prompt the user to add one
        if (allProjects.length === 0) {
            selector.innerHTML = '<option value="">No Projects Found</option>';
            document.getElementById('currentProjectName').textContent = 'Add a New Project';
            // Clear the dashboard view
            clearDashboardData();
            return;
        }

        // Populate the selector
        selector.innerHTML = '';
        allProjects.forEach(p => {
            const option = document.createElement('option');
            // Ensure ID is treated as a string for comparison consistency
            option.value = String(p.ProjectID).trim();
            option.textContent = `${option.value} - ${p.Name}`;
            selector.appendChild(option);
        });

        // Set the currently selected project (either the first one or the previously selected one)
        const initialProjectID = selector.options[0].value;
        selector.value = currentProjectID || initialProjectID;
        currentProjectID = selector.value;
        
        // Load the details for the selected project
        await loadProjectDetails(currentProjectID);

    } catch (e) {
        // Use the non-blocking status message function
        displayStatusMessage(e.message);
        selector.innerHTML = '<option value="">Connection Error</option>';
        document.getElementById('currentProjectName').textContent = 'Connection Error';
    }
}

/**
 * Clears the content panels when no project is selected or on error.
 */
function clearDashboardData() {
    document.getElementById('kpi-days-spent').textContent = 'N/A';
    document.getElementById('kpi-days-left').textContent = 'N/A';
    document.getElementById('kpi-budget-spent').textContent = 'N/A';
    document.getElementById('kpi-budget-remaining').textContent = 'N/A';
    document.getElementById('kpi-task-progress').textContent = 'N/A';
    document.getElementById('tasksList').innerHTML = '<li class="placeholder">Select a project to view tasks.</li>';
    document.getElementById('recentExpensesList').innerHTML = '<li class="placeholder">No expenses loaded...</li>';
    document.getElementById('materialsList').innerHTML = '<li class="placeholder">No materials loaded...</li>';
}


/**
 * Loads all detailed data (Tasks, Expenses) for the selected project.
 * @param {string} projectID The ID of the project to load.
 */
async function loadProjectDetails(projectID) {
    if (!projectID) return;
    currentProjectID = projectID;
    
    const currentProject = allProjects.find(p => String(p.ProjectID).trim() === String(currentProjectID).trim());
    if (!currentProject) {
        document.getElementById('currentProjectName').textContent = 'Project Not Found';
        clearDashboardData();
        return;
    }
    document.getElementById('currentProjectName').textContent = currentProject.Name;

    try {
        const data = await postDataToSheet({ 
            action: 'fetchData', 
            projectID: projectID 
        });

        const tasks = data.projectData.tasks || [];
        const expenses = data.projectData.expenses || [];
        
        // Now render all parts of the dashboard
        renderKPIs(currentProject, tasks, expenses);
        renderTasks(tasks);
        renderExpenses(expenses);
        
        // Fetch and render materials separately as materials sheet can be large
        await loadMaterials(projectID);

    } catch (e) {
        displayStatusMessage(e.message);
        clearDashboardData();
    }
}

/**
 * Renders the KPIs section of the dashboard.
 * @param {object} project The current project object.
 * @param {Array<object>} tasks List of tasks.
 * @param {Array<object>} expenses List of expenses.
 */
function renderKPIs(project, tasks, expenses) {
    // --- Date KPIs ---
    const startDate = new Date(project.StartDate);
    const deadlineDate = new Date(project.Deadline);
    const today = new Date();
    
    // Calculate days spent
    const timeSpentMs = today.getTime() - startDate.getTime();
    const daysSpent = Math.max(0, Math.floor(timeSpentMs / (1000 * 60 * 60 * 24)));
    
    // Calculate days remaining
    const timeRemainingMs = deadlineDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(timeRemainingMs / (1000 * 60 * 60 * 24));

    document.getElementById('kpi-days-spent').textContent = `${daysSpent} days`;
    document.getElementById('kpi-days-left').textContent = `${daysLeft > 0 ? daysLeft : 0} days`;

    // --- Financial KPIs ---
    const budget = parseFloat(String(project.Budget).replace(/[^0-9.]/g, '')) || 0;
    const totalSpent = expenses.reduce((sum, exp) => sum + (parseFloat(exp.Amount) || 0), 0);
    const remainingBudget = budget - totalSpent;
    
    document.getElementById('kpi-budget-spent').textContent = `₹${totalSpent.toFixed(2)}`;
    document.getElementById('kpi-budget-remaining').textContent = `₹${remainingBudget.toFixed(2)}`;
    
    const budgetStatusElement = document.getElementById('kpi-budget-remaining').closest('.kpi-box');
    budgetStatusElement.classList.toggle('kpi-warning', remainingBudget < budget * 0.1 && remainingBudget >= 0);
    budgetStatusElement.classList.toggle('kpi-danger', remainingBudget < 0);

    // --- Task Progress KPI ---
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.Status === 'Completed').length;
    
    let progressPercent = 0;
    if (totalTasks > 0) {
        progressPercent = Math.round((completedTasks / totalTasks) * 100);
    }
    
    document.getElementById('kpi-task-progress').textContent = `${progressPercent}% Complete`;
    document.getElementById('kpi-task-progress').closest('.kpi-box').style.background = 
        `linear-gradient(to right, #28a745 0%, #28a745 ${progressPercent}%, #e9ecef ${progressPercent}%, #e9ecef 100%)`;
}

/**
 * Renders the task list.
 * @param {Array<object>} tasks List of tasks for the current project.
 */
function renderTasks(tasks) {
    const list = document.getElementById('tasksList');
    list.innerHTML = '';

    if (tasks.length === 0) {
        list.innerHTML = '<li class="placeholder">No tasks found for this project.</li>';
        return;
    }

    tasks.sort((a, b) => {
        // Sort by Pending, then In Progress, then Completed
        const statusOrder = { 'Pending': 1, 'In Progress': 2, 'Completed': 3 };
        return statusOrder[a.Status] - statusOrder[b.Status];
    });

    tasks.forEach(task => {
        const item = document.createElement('li');
        item.className = 'task-item';
        item.classList.add(`status-${task.Status.toLowerCase().replace(/\s/g, '-')}`); // e.g., status-in-progress

        const completionDate = task.CompletionDate ? new Date(task.CompletionDate).toLocaleDateString() : 'N/A';

        item.innerHTML = `
            <div class="task-info">
                <span class="task-name">${task.TaskName}</span>
                <span class="task-responsible">(${task.Responsible})</span>
            </div>
            <div class="task-status">
                <select data-task-name="${task.TaskName}" class="status-selector">
                    <option value="Pending" ${task.Status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="In Progress" ${task.Status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Completed" ${task.Status === 'Completed' ? 'selected' : ''}>Completed</option>
                </select>
                <span class="completion-date">Completed: ${completionDate}</span>
            </div>
        `;
        list.appendChild(item);
    });
    
    // Add event listeners to all new status selectors
    document.querySelectorAll('.status-selector').forEach(select => {
        select.addEventListener('change', handleStatusChange);
    });
}

/**
 * Renders the expense history list.
 * @param {Array<object>} expenses List of expenses for the current project.
 */
function renderExpenses(expenses) {
    const list = document.getElementById('recentExpensesList');
    list.innerHTML = '';

    if (expenses.length === 0) {
        list.innerHTML = '<li class="placeholder">No expenses recorded for this project.</li>';
        return;
    }
    
    // Sort by date (newest first) and limit to 10
    expenses.sort((a, b) => new Date(b.Date) - new Date(a.Date));
    const recentExpenses = expenses.slice(0, 10);

    recentExpenses.forEach(exp => {
        const item = document.createElement('li');
        const amount = (parseFloat(exp.Amount) || 0).toFixed(2);
        const date = new Date(exp.Date).toLocaleDateString();

        item.innerHTML = `
            <div class="expense-details">
                <span class="expense-description">${exp.Description}</span>
                <span class="expense-category">(${exp.Category})</span>
            </div>
            <span class="expense-amount">₹${amount}</span>
            <span class="expense-date">${date}</span>
        `;
        list.appendChild(item);
    });
}

/**
 * Loads and renders the materials list.
 * @param {string} projectID The ID of the project to load.
 */
async function loadMaterials(projectID) {
    const list = document.getElementById('materialsList');
    list.innerHTML = '<li class="placeholder">Loading materials...</li>';
    try {
        const data = await postDataToSheet({ 
            action: 'fetchMaterials', 
            projectID: projectID 
        });
        const materials = data.materials || [];

        list.innerHTML = '';
        if (materials.length === 0) {
            list.innerHTML = '<li class="placeholder">No materials records found.</li>';
            return;
        }

        materials.forEach(mat => {
            const item = document.createElement('li');
            const date = mat.OrderDate ? new Date(mat.OrderDate).toLocaleDateString() : 'N/A';
            item.innerHTML = `
                <div class="material-info">
                    <span class="material-name">${mat.MaterialName}</span>
                    <span class="material-supplier">(${mat.Supplier || 'Unknown Supplier'})</span>
                </div>
                <span class="material-quantity">${mat.Quantity} ${mat.Unit}</span>
                <span class="material-date">${date}</span>
            `;
            list.appendChild(item);
        });

    } catch (e) {
        list.innerHTML = `<li class="placeholder error">Failed to load materials: ${e.message}</li>`;
        console.error("Material load error:", e);
    }
}


// --- 4. EVENT HANDLERS ---

document.getElementById('projectSelector').addEventListener('change', (e) => {
    loadProjectDetails(e.target.value);
});


/**
 * Handles the change event for a task status selector.
 * @param {Event} e The change event.
 */
async function handleStatusChange(e) {
    const selector = e.target;
    const taskName = selector.dataset.taskName;
    const newStatus = selector.value;
    // For optimistic update reversion, we need the original status before the change.
    // Finding the original status can be complex due to DOM manipulation; 
    // we'll rely on the loadProjectDetails to fix any visual errors quickly.
    const originalStatus = selector.options.find(opt => opt.defaultSelected)?.value || 'Pending';
    
    if (!currentProjectID || !taskName) return;

    try {
        // Optimistic UI update for immediate feedback
        const taskItem = selector.closest('.task-item');
        // Simple class removal/addition based on the new status
        taskItem.classList.forEach(className => {
             if (className.startsWith('status-')) taskItem.classList.remove(className);
        });
        taskItem.classList.add(`status-${newStatus.toLowerCase().replace(/\s/g, '-')}`);
        
        const payload = {
            action: 'updateTaskStatus',
            projectID: currentProjectID,
            taskName: taskName,
            newStatus: newStatus
        };
        
        await postDataToSheet(payload);
        
        // Reload details to update KPIs and completion dates
        await loadProjectDetails(currentProjectID);

    } catch (e) {
        displayStatusMessage(`Failed to update task status: ${e.message}`);
        // Revert UI on failure (needs a better method, but this is the simplest revert)
        selector.value = originalStatus;
        selector.closest('.task-item').classList.add(`status-${originalStatus.toLowerCase().replace(/\s/g, '-')}`);
    }
}

document.getElementById('expenseEntryForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentProjectID) {
        displayStatusMessage('Please select a project before recording an expense.');
        return;
    }

    const form = e.target;
    const expenseData = {
        action: 'recordExpense',
        projectID: currentProjectID,
        date: form.expenseDate.value,
        description: form.expenseDescription.value,
        amount: parseFloat(form.expenseAmount.value),
        category: form.expenseCategory.value
    };

    try {
        await postDataToSheet(expenseData);
        
        // Replace alert() with non-blocking message
        displayStatusMessage('Expense recorded successfully!', 'success');
        form.reset();
        
        // Reload details to update KPIs and expense list
        await loadProjectDetails(currentProjectID);
        
    } catch (e) {
        displayStatusMessage(`Failed to record expense: ${e.message}`);
    }
});


document.getElementById('addProjectBtn').addEventListener('click', async () => {
    // NOTE: In a production app, the prompt() calls below would be replaced by a proper HTML modal form.
    const newName = prompt("Enter the New Project Name:");
    if (!newName) return;

    const newID = prompt(`Enter a unique Project ID (e.g., HT-003):`);
    if (!newID) return;
    
    if (allProjects.some(p => String(p.ProjectID).trim() === String(newID).trim())) {
        // Replace alert() with non-blocking message
        return displayStatusMessage('Project ID must be unique. This ID already exists.');
    }

    const startDate = prompt("Enter Start Date (YYYY-MM-DD):");
    if (!startDate) return;

    const deadline = prompt("Enter Deadline (YYYY-MM-DD):");
    if (!deadline) return;

    const budget = prompt("Enter Project Budget (e.g., 500000):");
    if (!budget || isNaN(parseFloat(budget))) return displayStatusMessage('Invalid budget entered.');
    
    const payload = {
        action: 'addNewProject',
        projectID: newID,
        name: newName,
        startDate: startDate,
        deadline: deadline,
        budget: parseFloat(budget),
        // Add minimal mock data for other fields if needed, but Code.gs handles these
        metadata: {
            creationDate: new Date().toISOString(),
            status: 'Active',
            notes: ''
        },
        defaultTasks: HI_TEK_TASKS_MAP 
    };
    
    try {
        await postDataToSheet(payload);
        // Replace alert() with non-blocking message
        displayStatusMessage(`Project "${newName}" added successfully with ID ${newID}. All 23 official tasks are now loaded to the sheet.`, 'success');
    } catch (e) {
        displayStatusMessage(`Failed to add project: ${e.message}`);
    }
    
    await loadProjects();
});

document.getElementById('deleteProjectBtn').addEventListener('click', () => {
    if (!currentProjectID) return displayStatusMessage('No project is selected.');
    const currentProject = allProjects.find(p => String(p.ProjectID).trim() === String(currentProjectID).trim());
    
    // NOTE: Replaced confirm() and alert() with non-blocking UI/console message.
    const deleteWarning = `WARNING: Deleting Project "${currentProject.Name}" requires manual removal of all associated data rows (Tasks, Expenses, Materials) from all four tabs in the Google Sheet.`;
    
    displayStatusMessage(deleteWarning + " Please proceed to the Google Sheet to manually delete the rows.", 'error');
    
    // Provide a simple one-click to the sheet for convenience
    window.open('https://docs.google.com/spreadsheets/', '_blank');
});


// ==============================================================================
// 5. INITIALIZATION
// ==============================================================================


document.addEventListener('DOMContentLoaded', loadProjects);
