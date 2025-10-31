// ==============================================================================
// script.js: ONLINE VERSION (SheetDB API Integration)
// Data is fetched from and sent to the live Google Sheet via SheetDB.
// SheetDB eliminates Google Apps Script deployment issues (like the 404 error).
// ==============================================================================

// 🎯 CRITICAL: PASTE YOUR NEW VERIFIED SheetDB API URL HERE!
// Example: https://sheetdb.io/api/v1/a1b2c3d4e5f6g7h8i9j0
// !!! UPDATED WITH USER-PROVIDED URL !!!
const SHEET_API_URL = "https://sheetdb.io/api/v1/3uaqqfnplzz5m"; 

let currentProjectID = null; 
let allProjects = [];

// --- 1. THE HI TEK 23-STEP WORKFLOW LIST ---
// (This is only used for initializing new projects)
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
    { Name: '12. Prepare Master Program', Responsible: 'Planning/Project Manager' },
    { Name: '13. Dispatch Materials', Responsible: 'Warehouse Supervisor/Logistics' },
    { Name: '14. Production Starts', Responsible: 'Production Team' },
    { Name: '15. Quality Control (QC)', Responsible: 'Quality Inspector' },
    { Name: '16. Material Arrival at Site', Responsible: 'Logistics/Site Engineer' },
    { Name: '17. Site Preparation', Responsible: 'Site Engineer/Foreman' },
    { Name: '18. Installation Starts', Responsible: 'Site Engineer/Installation Team' },
    { Name: '19. Final Quality Check (FQC)', Responsible: 'Quality Inspector' },
    { Name: '20. Handover to Client', Responsible: 'Project Manager' },
    { Name: '21. Project Closure Report', Responsible: 'Project Manager' },
    { Name: '22. Payment Follow Up', Responsible: 'Accounts Manager' },
    { Name: '23. Final Settlement', Responsible: 'Accounts Manager' }
];

// ==============================================================================
// 2. SHEETDB API COMMUNICATION FUNCTIONS
// (Now using standard SheetDB REST endpoints)
// ==============================================================================

/**
 * Fetches data from a specific sheet.
 * @param {string} sheetName - The name of the sheet (e.g., 'Projects', 'Tasks').
 * @param {string|null} filterQuery - Optional filter to append (e.g., '?search={"ProjectID":"HT-01"}').
 * @returns {Promise<Array<Object>>} The sheet data.
 */
async function fetchDataFromSheet(sheetName, filterQuery = '') {
    const url = `${SHEET_API_URL}/${sheetName}${filterQuery}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`SheetDB API error on ${sheetName}: ${response.statusText}`);
        }
        const data = await response.json();
        // SheetDB returns an array of objects directly
        return Array.isArray(data) ? data : []; 
    } catch (error) {
        console.error("Fetch Error:", error);
        // Show an error message to the user for critical errors
        document.getElementById('currentProjectName').textContent = 'API ERROR!';
        alert(`Critical API Connection Error to SheetDB: ${error.message}. Please check your SHEET_API_URL and sheet sharing settings.`);
        return [];
    }
}

/**
 * Posts data to a specific sheet.
 * @param {string} sheetName - The name of the sheet.
 * @param {Object} data - The payload to send.
 * @param {string} method - HTTP method ('POST', 'PUT', 'DELETE').
 * @param {string|null} filterQuery - Optional filter for PUT/DELETE (e.g., '/TaskName/Measurement').
 * @returns {Promise<Object>} The API response.
 */
async function postDataToSheet(sheetName, data, method = 'POST', filterQuery = '') {
    const url = `${SHEET_API_URL}/${sheetName}${filterQuery}`;
    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            // SheetDB requires the data wrapped in a 'data' object for POST/PUT
            body: JSON.stringify({ data: data }) 
        });

        if (response.status === 200 || response.status === 201) {
            return await response.json();
        } else {
            const errorText = await response.text();
            throw new Error(`API Request Failed (${response.status} ${response.statusText}): ${errorText}`);
        }
    } catch (error) {
        console.error("Post Error:", error);
        return { status: 'error', message: error.message };
    }
}

// ==============================================================================
// 3. MAIN DASHBOARD LOGIC
// ==============================================================================

/**
 * Loads the list of projects into the selector.
 */
async function loadProjects() {
    allProjects = await fetchDataFromSheet('Projects');
    const selector = document.getElementById('projectSelector');
    selector.innerHTML = ''; // Clear existing options
    
    // Add a default prompt option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '--- Select Project ---';
    selector.appendChild(defaultOption);

    if (allProjects.length === 0) {
        document.getElementById('currentProjectName').textContent = 'No Projects Found';
        return;
    }

    allProjects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.ProjectID;
        option.textContent = `${project.ProjectID} - ${project.Name}`;
        selector.appendChild(option);
    });

    // Attempt to select the previously selected project or the first one
    const projectToSelect = currentProjectID || allProjects[0].ProjectID;
    if (projectToSelect) {
        selector.value = projectToSelect;
        currentProjectID = projectToSelect;
        await loadProjectDetails(currentProjectID);
    }
}

/**
 * Loads all data and updates the dashboard for the selected project.
 * @param {string} projectID The ID of the project.
 */
async function loadProjectDetails(projectID) {
    if (!projectID) return;

    currentProjectID = projectID;
    const project = allProjects.find(p => String(p.ProjectID).trim() === String(projectID).trim());

    if (!project) {
        document.getElementById('currentProjectName').textContent = 'Project Not Found';
        return;
    }

    document.getElementById('currentProjectName').textContent = project.Name;
    document.querySelector('.dashboard-grid').classList.remove('hidden');

    // SheetDB Filter Query: ?search={"ProjectID":"HT-01"}
    const filterQuery = `?search={"ProjectID":"${projectID}"}`;
    
    // Fetch all related data concurrently
    const [tasks, expenses, materials] = await Promise.all([
        fetchDataFromSheet('Tasks', filterQuery),
        fetchDataFromSheet('Expenses', filterQuery),
        fetchDataFromSheet('Materials', filterQuery)
    ]);

    renderKPIs(project, tasks, expenses);
    renderTasks(tasks);
    renderExpenses(expenses);
    renderMaterials(materials);
}


// ==============================================================================
// 4. RENDERING FUNCTIONS
// ==============================================================================

function renderKPIs(project, tasks, expenses) {
    // 1. Calculate Time KPIs
    const startDate = new Date(project.StartDate);
    const deadline = new Date(project.Deadline);
    const today = new Date();

    const diffTime = (date1, date2) => Math.ceil(Math.abs(date2 - date1) / (1000 * 60 * 60 * 24));

    const daysSpent = diffTime(startDate, today);
    const daysLeft = diffTime(today, deadline);
    const totalDuration = diffTime(startDate, deadline);

    document.getElementById('kpi-days-spent').textContent = `${daysSpent} days`;
    document.getElementById('kpi-days-left').textContent = `${daysLeft} days`;

    // 2. Calculate Budget/Expense KPIs
    const budget = parseFloat(project.Budget) || 0;
    const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.Amount) || 0), 0);
    const remainingBudget = budget - totalExpenses;
    const expensePercentage = budget > 0 ? ((totalExpenses / budget) * 100).toFixed(1) : '0.0';

    document.getElementById('kpi-budget').textContent = `₹${budget.toLocaleString('en-IN')}`;
    document.getElementById('kpi-expenses').textContent = `₹${totalExpenses.toLocaleString('en-IN')}`;
    document.getElementById('kpi-remaining-budget').textContent = `₹${remainingBudget.toLocaleString('en-IN')}`;
    
    // Set color based on remaining budget
    const budgetBox = document.getElementById('kpi-remaining-budget').closest('.kpi-box');
    if (remainingBudget < budget * 0.1) {
        budgetBox.style.backgroundColor = '#ffe0e0'; // Redish warning
    } else if (remainingBudget < budget * 0.3) {
        budgetBox.style.backgroundColor = '#fff7e0'; // Yellowish warning
    } else {
        budgetBox.style.backgroundColor = '#e0fff0'; // Greenish good
    }

    // 3. Task Completion KPI
    const completedTasks = tasks.filter(t => t.Status.toLowerCase() === 'completed').length;
    const totalTasks = tasks.length;
    const completionPercentage = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : '0.0';

    document.getElementById('kpi-completion').textContent = `${completionPercentage}%`;

    // 4. Progress Bar
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = `${completionPercentage}%`;
    progressBar.setAttribute('aria-valuenow', completionPercentage);
}

function renderTasks(tasks) {
    const list = document.getElementById('taskList');
    list.innerHTML = '';
    
    if (tasks.length === 0) {
        list.innerHTML = '<li class="placeholder">No tasks loaded for this project.</li>';
        return;
    }

    // Sort tasks by task name (e.g., "1. Task" comes before "2. Task")
    tasks.sort((a, b) => a.TaskName.localeCompare(b.TaskName));

    tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item task-${task.Status.toLowerCase().replace(/\s/g, '-')}`;
        
        // SheetDB does not return a row index directly, so we use the unique TaskName 
        // and ProjectID to identify the row for updating.
        const taskIdentifier = `{"ProjectID":"${task.ProjectID}", "TaskName":"${task.TaskName}"}`;

        li.innerHTML = `
            <div class="task-info">
                <strong>${task.TaskName}</strong>
                <span class="responsible">Responsible: ${task.Responsible}</span>
            </div>
            <div class="task-actions">
                <select class="task-status-selector" data-task-id='${taskIdentifier}' data-original-status="${task.Status}">
                    <option value="Pending" ${task.Status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="In Progress" ${task.Status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Completed" ${task.Status === 'Completed' ? 'selected' : ''}>Completed</option>
                </select>
            </div>
        `;
        list.appendChild(li);
    });
    
    // Attach event listeners to the new selectors
    document.querySelectorAll('.task-status-selector').forEach(selector => {
        selector.addEventListener('change', handleTaskStatusUpdate);
    });
}

function renderExpenses(expenses) {
    const list = document.getElementById('recentExpensesList');
    list.innerHTML = '';

    if (expenses.length === 0) {
        list.innerHTML = '<li class="placeholder">No expenses recorded yet.</li>';
        return;
    }

    // Sort by Date descending
    expenses.sort((a, b) => new Date(b.Date) - new Date(a.Date));
    
    // Show only the last 5 expenses
    expenses.slice(0, 5).forEach(e => {
        const li = document.createElement('li');
        li.className = 'expense-item';
        li.innerHTML = `
            <span class="expense-category expense-${e.Category.toLowerCase()}">${e.Category}</span>
            <span class="expense-description">${e.Description}</span>
            <span class="expense-amount">₹${parseFloat(e.Amount).toLocaleString('en-IN')}</span>
            <span class="expense-date">(${e.Date})</span>
        `;
        list.appendChild(li);
    });
    
    if (expenses.length > 5) {
        const more = document.createElement('li');
        more.className = 'placeholder';
        more.textContent = `... and ${expenses.length - 5} more expenses.`;
        list.appendChild(more);
    }
}

function renderMaterials(materials) {
    const list = document.getElementById('materialList');
    list.innerHTML = '';

    if (materials.length === 0) {
        list.innerHTML = '<li class="placeholder">No materials ordered yet.</li>';
        return;
    }
    
    // Sort by OrderDate descending
    materials.sort((a, b) => new Date(b.OrderDate) - new Date(a.OrderDate));

    // Show only the last 5 materials
    materials.slice(0, 5).forEach(m => {
        const li = document.createElement('li');
        li.className = 'material-item';
        li.innerHTML = `
            <div class="material-info">
                <strong>${m.MaterialName}</strong>
                <span>${m.Quantity} ${m.Unit}</span>
            </div>
            <div class="material-supplier">
                <span>Supplier: ${m.Supplier}</span>
                <span class="material-date">Ordered: ${m.OrderDate}</span>
            </div>
        `;
        list.appendChild(li);
    });

    if (materials.length > 5) {
        const more = document.createElement('li');
        more.className = 'placeholder';
        more.textContent = `... and ${materials.length - 5} more materials.`;
        list.appendChild(more);
    }
}

// ==============================================================================
// 5. EVENT HANDLERS
// ==============================================================================

// --- Project Selector ---
document.getElementById('projectSelector').addEventListener('change', async (e) => {
    const projectID = e.target.value;
    if (projectID) {
        await loadProjectDetails(projectID);
    } else {
        document.getElementById('currentProjectName').textContent = 'Select a Project';
        document.querySelector('.dashboard-grid').classList.add('hidden');
    }
});

// --- Task Update Handler ---
async function handleTaskStatusUpdate(e) {
    const selector = e.target;
    const newStatus = selector.value;
    const taskIdentifier = JSON.parse(selector.getAttribute('data-task-id')); // {ProjectID, TaskName}
    const originalStatus = selector.getAttribute('data-original-status');

    if (!confirm(`Are you sure you want to change the status of task "${taskIdentifier.TaskName}" to "${newStatus}"?`)) {
        // Revert selection if user cancels
        selector.value = originalStatus;
        return;
    }
    
    const now = new Date();
    const completionDate = (newStatus === 'Completed') 
        ? now.toISOString().split('T')[0] // YYYY-MM-DD
        : ''; // Clear date if status is not completed

    const updatePayload = {
        Status: newStatus,
        CompletionDate: completionDate
    };
    
    // SheetDB allows updating based on a search query
    // The query is appended to the URL as a path: /TaskName/Task_Name_Value
    // We use the TaskName as the unique key for the update
    const filterPath = `/TaskName/${encodeURIComponent(taskIdentifier.TaskName)}`;

    const result = await postDataToSheet('Tasks', updatePayload, 'PUT', filterPath);

    if (result.updatedRows && result.updatedRows.length > 0) {
        alert(`Task status updated to ${newStatus}.`);
    } else {
        alert(`Failed to update task. Check the console and ensure the TaskName '${taskIdentifier.TaskName}' is unique for this project.`);
    }

    // Reload data to update KPIs and lists
    await loadProjectDetails(currentProjectID);
}

// --- Expense Form Handler ---
document.getElementById('expenseEntryForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentProjectID) {
        alert('Please select a project before recording an expense.');
        return;
    }

    const newExpense = {
        ProjectID: currentProjectID,
        Date: document.getElementById('expenseDate').value,
        Description: document.getElementById('expenseDescription').value,
        Amount: document.getElementById('expenseAmount').value,
        Category: document.getElementById('expenseCategory').value,
        RecordedBy: 'Client User' // Static entry for now
    };

    const result = await postDataToSheet('Expenses', newExpense, 'POST');

    if (result.created) {
        alert(`Expense for ${newExpense.Description} recorded successfully.`);
    } else {
        alert(`Failed to record expense. Please check the console.`);
    }

    // Clear form and reload details
    e.target.reset();
    await loadProjectDetails(currentProjectID);
});

// --- Material Form Handler ---
document.getElementById('materialEntryForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentProjectID) {
        alert('Please select a project before recording materials.');
        return;
    }
    
    const newMaterial = {
        ProjectID: currentProjectID,
        MaterialName: document.getElementById('materialName').value,
        Quantity: document.getElementById('materialQuantity').value,
        Unit: document.getElementById('materialUnit').value,
        Supplier: document.getElementById('materialSupplier').value,
        OrderDate: document.getElementById('materialOrderDate').value
    };

    const result = await postDataToSheet('Materials', newMaterial, 'POST');
    
    if (result.created) {
        alert(`Material order for ${newMaterial.MaterialName} recorded successfully.`);
    } else {
        alert(`Failed to record material order. Please check the console.`);
    }

    // Clear form and reload details
    e.target.reset();
    await loadProjectDetails(currentProjectID);
});

// --- Add Project Handler ---
document.getElementById('addProjectBtn').addEventListener('click', async () => {
    const newID = prompt("Enter a unique Project ID (e.g., HT-02):");
    if (!newID) return;

    const newName = prompt("Enter the Project Name:");
    if (!newName) return;
    
    const startDate = prompt("Enter the Start Date (YYYY-MM-DD):");
    if (!startDate) return;

    const deadline = prompt("Enter the Deadline (YYYY-MM-DD):");
    if (!deadline) return;

    const budget = prompt("Enter the Budget (Numeric INR):");
    if (!budget || isNaN(budget)) {
        alert('Invalid budget entered.');
        return;
    }

    const creationDate = new Date().toISOString().split('T')[0];

    // 1. Add Project to 'Projects' sheet
    const projectData = {
        ProjectID: newID,
        Name: newName,
        StartDate: startDate,
        Deadline: deadline,
        Budget: budget,
        CreationDate: creationDate,
        Contractor: '', // Left blank for manual entry later
        Engineers: '',
        Contact1: '',
        Contact2: ''
    };

    const projectResult = await postDataToSheet('Projects', projectData, 'POST');
    
    if (projectResult.created) {
        let tasksAdded = true;
        
        // 2. Add Default Tasks to 'Tasks' sheet
        for (const task of HI_TEK_TASKS_MAP) {
             const taskPayload = {
                ProjectID: newID,
                TaskName: task.Name,
                Responsible: task.Responsible,
                Status: 'Pending',
                CreationDate: creationDate,
                CompletionDate: ''
            };
            const taskResult = await postDataToSheet('Tasks', taskPayload, 'POST');
            if (!taskResult.created) {
                console.error("Failed to add task:", task.Name, taskResult);
                tasksAdded = false;
            }
        }
        
        if (tasksAdded) {
            alert(`Project "${newName}" added successfully with ID ${newID}. All 23 official tasks are now loaded to the Tasks sheet.`);
        } else {
             alert(`Project added, but some default tasks failed to load. Check the console.`);
        }

    } else {
        alert(`Failed to add project. Please check the console.`);
    }
    
    // Reload everything to show the new project
    await loadProjects();
});


// --- Delete Project Handler (Manual Cleanup Recommended) ---
document.getElementById('deleteProjectBtn').addEventListener('click', () => {
    if (!currentProjectID) return alert('No project is selected.');
    const currentProject = allProjects.find(p => String(p.ProjectID).trim() === String(currentProjectID).trim());
    
    // SheetDB allows DELETE based on a search query
    // We target the row in the 'Projects' sheet using the ProjectID
    const confirmDelete = confirm(`WARNING: Deleting Project "${currentProject.Name}" will remove the project row from the 'Projects' sheet. You MUST manually remove all associated data rows (Tasks, Expenses, Materials) from the other three tabs in the Google Sheet. Proceed to delete the project row?`);
    
    if (confirmDelete) {
        // SheetDB Filter Query for DELETE: /ProjectID/HT-01
        const filterPath = `/ProjectID/${encodeURIComponent(currentProjectID)}`;
        
        postDataToSheet('Projects', null, 'DELETE', filterPath)
            .then(result => {
                if (result.deletedRows && result.deletedRows.length > 0) {
                    alert(`Project "${currentProject.Name}" deleted successfully from the Projects sheet.`);
                    // Direct user to clean up other sheets
                    window.open('https://docs.google.com/spreadsheets/', '_blank');
                    alert("Please now manually delete all associated data rows from the Tasks, Expenses, and Materials tabs in your Google Sheet.");
                } else {
                    alert(`Failed to delete project row. Please check the console.`);
                }
                // Reset and reload the dashboard
                currentProjectID = null;
                loadProjects();
            })
            .catch(error => {
                console.error("Deletion Error:", error);
                alert("An error occurred during project deletion.");
            });
    }
});


// ==============================================================================
// 6. INITIALIZATION
// ==============================================================================

document.addEventListener('DOMContentLoaded', loadProjects);
