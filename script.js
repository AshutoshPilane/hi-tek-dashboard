// ==============================================================================
// script.js: FINAL VERSION (SheetDB API Integration with Cache Fix)
// ==============================================================================

// 🎯 CRITICAL: PASTE YOUR WORKING SHEETDB API URL HERE!
const SHEET_API_URL = "https://sheetdb.io/api/v1/3uaqqfnplzz5m"; 

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
    { Name: '12. Prepare Invoices', Responsible: 'Accounts Manager' },
    { Name: '13. Dispatch', Responsible: 'Logistics Manager' },
    { Name: '14. Payment Follow-Up - 1st Call', Responsible: 'Accounts Manager' },
    { Name: '15. Installation', Responsible: 'Installation Team Lead/Site Engineer' },
    { Name: '16. Inspection', Responsible: 'Quality Inspector' },
    { Name: '17. Payment Follow-Up - 2nd Call', Responsible: 'Accounts Manager' },
    { Name: '18. Final Handover', Responsible: 'Project Manager/Site Engineer' },
    { Name: '19. Final Payment Follow-Up', Responsible: 'Accounts Manager' },
    { Name: '20. Closing The Deal', Responsible: 'Sales/Business Development Team' },
    { Name: '21. System Clean Up', Responsible: 'Project Manager' },
    { Name: '22. Documentation & Filing', Responsible: 'Admin/Project Coordinator' },
    { Name: '23. Feedback Collection', Responsible: 'Project Manager' }
];

// --- 2. API UTILITY FUNCTIONS (SheetDB Format) ---

/**
 * Fetches data from a specified sheet (GET request).
 * @param {string} sheetName The name of the Google Sheet tab (e.g., 'Projects').
 * @returns {Promise<Array<Object>>} The data rows from the sheet.
 */
const fetchDataFromSheet = async (sheetName) => {
    // 💡 FIX APPLIED HERE: Add a unique timestamp to the URL to prevent caching.
    const cacheBuster = new Date().getTime();
    const url = `${SHEET_API_URL}?sheet=${sheetName}&cache=${cacheBuster}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        // SheetDB returns a simple array of objects
        return data; 
    } catch (error) {
        console.error(`Fetch Error on ${sheetName}:`, error);
        // Display a user-friendly error message on the dashboard
        document.getElementById('currentProjectName').textContent = 'API Error! Check Console.';
        return [];
    }
};

/**
 * Sends data to a specified sheet (POST/PUT/DELETE request) using SheetDB structure.
 * @param {string} sheetName The name of the Google Sheet tab.
 * @param {string} method The HTTP method ('POST', 'PUT', 'DELETE').
 * @param {Object|Array<Object>} payload The data object(s) to send.
 * @returns {Promise<Object>} The server response.
 */
const sendDataToSheet = async (sheetName, method, payload) => {
    const url = `${SHEET_API_URL}?sheet=${sheetName}`;
    
    // SheetDB POST/PUT expects an object wrapper
    const wrappedPayload = method === 'POST' || method === 'PUT' ? { sheet: sheetName, data: payload } : null;

    try {
        const response = await fetch(url, {
            method: method,
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: wrappedPayload ? JSON.stringify(wrappedPayload) : null
        });

        const result = await response.json();
        
        if (!response.ok) {
            console.error('API Response Error:', result);
            throw new Error(`API Request Failed (${response.status}): ${result.message || 'Unknown error'}`);
        }

        return { status: 'success', message: result };

    } catch (error) {
        console.error(`${method} Error:`, error);
        return { status: 'error', message: error.message };
    }
};


// --- 3. PROJECT SELECTION AND DISPLAY ---

const projectSelector = document.getElementById('projectSelector');
const currentProjectNameElement = document.getElementById('currentProjectName');

/**
 * Loads all projects from the 'Projects' sheet and populates the selector.
 */
const loadProjects = async () => {
    // Clear the current list and reset the current project state
    projectSelector.innerHTML = '<option value="">-- Select Project --</option>';
    currentProjectID = null;
    allProjects = [];
    
    clearDashboard();
    currentProjectNameElement.textContent = 'Select a Project';

    try {
        const projectsData = await fetchDataFromSheet('Projects');
        if (projectsData && projectsData.length > 0) {
            allProjects = projectsData.filter(p => p.ProjectID); // Filter out rows without ID

            allProjects.forEach(project => {
                const option = document.createElement('option');
                // Ensure ProjectID is trimmed and used as the value
                option.value = String(project.ProjectID).trim(); 
                option.textContent = `${project.Name} (${project.ProjectID})`;
                projectSelector.appendChild(option);
            });

            // Auto-select the first project if one exists
            if (allProjects.length > 0) {
                const firstProjectId = String(allProjects[0].ProjectID).trim();
                projectSelector.value = firstProjectId;
                handleProjectSelection(firstProjectId);
            }
        } else {
            currentProjectNameElement.textContent = 'No Projects Found';
        }
    } catch (error) {
        console.error("Error loading projects:", error);
        currentProjectNameElement.textContent = 'Error Loading Projects';
    }
};

/**
 * Clears the content of all dynamic dashboard elements (reconciled with index.html).
 */
const clearDashboard = () => {
    const idsToClear = [
        'kpi-days-spent', 'kpi-days-left', 'kpi-progress', 'kpi-material-progress', 
        'kpi-work-order', 'kpi-total-expenses',
        'display-name', 'display-start-date', 'display-deadline', 
        'display-location', 'display-amount', 'display-contractor', 
        'display-engineers', 'display-contact1', 'display-contact2'
    ];

    idsToClear.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = (id.includes('kpi-work-order') || id.includes('kpi-total-expenses') || id.includes('display-amount')) ? '₹ 0' : 'N/A';
            if (id.includes('kpi-progress') || id.includes('kpi-material-progress')) {
                 element.textContent = '0%';
            }
        }
    });
    
    // Clear task and expense tables/lists
    document.getElementById('taskTableBody').innerHTML = '<tr><td colspan="5">Select a project to view tasks...</td></tr>';
    document.getElementById('materialTableBody').innerHTML = '<tr><td colspan="5">Select a project to view materials...</td></tr>';
    document.getElementById('recentExpensesList').innerHTML = '<li class="placeholder">Select a project to view expenses...</li>';
};

const handleProjectSelection = (projectID) => {
    currentProjectID = projectID;
    
    if (!projectID) {
        clearDashboard();
        currentProjectNameElement.textContent = 'Select a Project';
        return;
    }

    const selectedProject = allProjects.find(p => String(p.ProjectID).trim() === String(projectID).trim());

    if (selectedProject) {
        currentProjectNameElement.textContent = selectedProject.Name;
        updateDashboard(selectedProject);
        loadTasks(projectID);
        loadExpenses(projectID);
        // loadMaterials(projectID); // Load Materials logic would go here
    } else {
        clearDashboard();
        currentProjectNameElement.textContent = 'Project Not Found';
    }
};

projectSelector.addEventListener('change', (e) => {
    handleProjectSelection(e.target.value);
});


// --- 4. DASHBOARD UPDATES AND CALCULATION ---

const updateDashboard = (project) => {
    // 1. Update Project Details
    document.getElementById('display-name').textContent = project.Name || 'N/A';
    document.getElementById('display-start-date').textContent = project.StartDate || 'N/A';
    document.getElementById('display-deadline').textContent = project.Deadline || 'N/A';
    document.getElementById('display-location').textContent = project.Location || 'N/A';
    document.getElementById('display-amount').textContent = `₹${(parseFloat(project.Amount) || 0).toLocaleString('en-IN')}`;
    document.getElementById('display-contractor').textContent = project.Contractor || 'N/A';
    document.getElementById('display-engineers').textContent = project.Engineers || 'N/A';
    document.getElementById('display-contact1').textContent = project.Contact1 || 'N/A';
    document.getElementById('display-contact2').textContent = project.Contact2 || 'N/A';
    
    // 2. Work Order KPI (Project Amount)
    document.getElementById('kpi-work-order').textContent = `₹${(parseFloat(project.Amount) || 0).toLocaleString('en-IN')}`;

    // 3. Time Calculations
    const startDate = project.StartDate ? new Date(project.StartDate) : null;
    const deadline = project.Deadline ? new Date(project.Deadline) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffInDays = (date1, date2) => {
        if (!date1 || !date2) return NaN;
        const diffTime = Math.abs(date2 - date1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Days Spent
    const kpiDaysSpentElement = document.getElementById('kpi-days-spent');
    if (startDate && kpiDaysSpentElement) {
        const daysSpent = diffInDays(startDate, today) - 1; 
        kpiDaysSpentElement.textContent = `${daysSpent > 0 ? daysSpent : 0} days`;
    } else if (kpiDaysSpentElement) {
         kpiDaysSpentElement.textContent = 'N/A';
    }

    // Days Left
    const kpiDaysLeftElement = document.getElementById('kpi-days-left');
    if (deadline && kpiDaysLeftElement) {
        const daysToDeadline = diffInDays(today, deadline) - 1; 
        if (today <= deadline) {
            kpiDaysLeftElement.textContent = `${daysToDeadline > 0 ? daysToDeadline : 0} days`;
        } else {
            const daysOverdue = diffInDays(deadline, today); 
            kpiDaysLeftElement.textContent = `${daysOverdue} days (OVERDUE)`;
        }
    } else if (kpiDaysLeftElement) {
         kpiDaysLeftElement.textContent = 'No Deadline';
    }
};

// --- 5. TASK MANAGEMENT ---

const loadTasks = async (projectID) => {
    const taskTableBody = document.getElementById('taskTableBody');
    taskTableBody.innerHTML = '<tr><td colspan="5">Loading tasks...</td></tr>';
    
    try {
        const allTasks = await fetchDataFromSheet('Tasks');
        const projectTasks = allTasks.filter(t => String(t.ProjectID).trim() === String(projectID).trim());
        
        taskTableBody.innerHTML = ''; // Clear loading message

        if (projectTasks.length === 0) {
            taskTableBody.innerHTML = '<tr><td colspan="5">No tasks found for this project.</td></tr>';
            document.getElementById('kpi-progress').textContent = '0%';
            return;
        }

        let completedTasks = 0;
        let totalProgress = 0;

        projectTasks.forEach(task => {
            const status = String(task.Status || 'Pending').trim().toLowerCase();
            const progress = parseInt(task.Progress || 0, 10);
            const isCompleted = progress === 100 || status === 'completed' || status === 'done';
            
            if (isCompleted) {
                completedTasks++;
            }
            totalProgress += progress;

            const row = taskTableBody.insertRow();
            row.innerHTML = `
                <td>${task.TaskName || 'N/A'}</td>
                <td>${task.Responsible || 'N/A'}</td>
                <td>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${progress}%; background-color: ${progress === 100 ? '#28a745' : '#007bff'}"></div>
                        <span class="progress-text">${progress}%</span>
                    </div>
                </td>
                <td>${task.Due_Date || 'N/A'}</td>
                <td class="status-cell status-${status.replace(' ', '-')}">${task.Status || 'Pending'}</td>
            `;
        });

        // Update Project Progress KPI
        const totalTasks = projectTasks.length;
        const totalProgressPercentage = totalTasks > 0 ? Math.round(totalProgress / totalTasks) : 0;
        const kpiProgressElement = document.getElementById('kpi-progress');

        if (kpiProgressElement) {
            kpiProgressElement.textContent = `${totalProgressPercentage}%`;
        }

    } catch (error) {
        console.error("Error loading tasks:", error);
        taskTableBody.innerHTML = '<tr><td colspan="5">Failed to load tasks.</td></tr>';
        document.getElementById('kpi-progress').textContent = 'Error';
    }
};

// --- 6. EXPENSE MANAGEMENT ---

let totalSpent = 0;

const loadExpenses = async (projectID) => {
    const expensesList = document.getElementById('recentExpensesList');
    expensesList.innerHTML = '<li class="placeholder">Loading expenses...</li>';
    totalSpent = 0;
    
    try {
        const allExpenses = await fetchDataFromSheet('Expenses');
        const projectExpenses = allExpenses.filter(e => String(e.ProjectID).trim() === String(projectID).trim());
        
        expensesList.innerHTML = ''; 

        if (projectExpenses.length === 0) {
            expensesList.innerHTML = '<li class="placeholder">No expenses recorded for this project.</li>';
        }

        // Sort by Date descending (most recent first)
        const sortedExpenses = projectExpenses.sort((a, b) => new Date(b.Date) - new Date(a.Date));

        // Calculate total spent & populate list
        sortedExpenses.slice(0, 10).forEach(expense => { // Show max 10 recent expenses
            const amount = parseFloat(expense.Amount) || 0;
            totalSpent += amount;
            
            const expenseItem = document.createElement('li');
            expenseItem.className = 'expense-item';
            expenseItem.innerHTML = `
                <span class="expense-date">${expense.Date || 'N/A'}</span>
                <span class="expense-desc">${expense.Description || 'N/A'} (${expense.Category || 'Other'})</span>
                <span class="expense-amount">₹${amount.toLocaleString('en-IN')}</span>
            `;
            expensesList.appendChild(expenseItem);
        });

        // Update Financial KPI
        document.getElementById('kpi-total-expenses').textContent = `₹${totalSpent.toLocaleString('en-IN')}`;

    } catch (error) {
        console.error("Error loading expenses:", error);
        expensesList.innerHTML = '<li class="placeholder-error">Failed to load expenses.</li>';
        document.getElementById('kpi-total-expenses').textContent = '₹ Error';
    }
};

document.getElementById('expenseEntryForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentProjectID) {
        alert('Please select a project before recording an expense.');
        return;
    }

    const form = e.target;
    const expenseDate = form.elements['expenseDate'].value;
    const expenseDescription = form.elements['expenseDescription'].value;
    const expenseAmount = form.elements['expenseAmount'].value;
    const expenseCategory = form.elements['expenseCategory'].value;
    
    const payload = {
        ProjectID: String(currentProjectID).trim(),
        Date: expenseDate,
        Description: expenseDescription,
        Amount: parseFloat(expenseAmount),
        Category: expenseCategory,
        RecordedBy: 'User Admin' 
    };
    
    const result = await sendDataToSheet('Expenses', 'POST', [payload]);

    if (result.status === 'success') {
        alert('Expense recorded successfully!');
        form.reset();
        await loadExpenses(currentProjectID); // Reload
    } else {
        alert(`Failed to record expense. Error: ${result.message}`);
    }
});

// --- 7. PROJECT ADD/DELETE ---

const generateNewID = () => {
    const existingIDs = allProjects.map(p => {
        const id = String(p.ProjectID).trim();
        const match = id.match(/^HT-(\d+)$/i); 
        return match ? parseInt(match[1], 10) : 0;
    });

    const maxID = Math.max(...existingIDs, 0);
    const newNum = maxID + 1;
    return `HT-${String(newNum).padStart(2, '0')}`; 
};


document.getElementById('addProjectBtn').addEventListener('click', async () => {
    const newName = prompt('Enter the name for the new project:');
    if (!newName || newName.trim() === '') return;

    const newID = generateNewID();
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Project data for the 'Projects' sheet
    const projectPayload = {
        ProjectID: newID,
        Name: newName.trim(),
        StartDate: today,
        Deadline: '', 
        Amount: 0, // Using 'Amount' to match 'Work Order Amount' KPI
        CreationDate: today
        // other fields left blank to be filled via edit
    };

    // 2. Prepare the 23-task template for the 'Tasks' sheet
    const tasksPayload = HI_TEK_TASKS_MAP.map(task => ({
        ProjectID: newID,
        TaskName: task.Name,
        Responsible: task.Responsible,
        Status: 'Pending',
        Progress: 0,
        Due_Date: ''
    }));

    // Perform posts simultaneously
    const [projectResult, taskResult] = await Promise.all([
        sendDataToSheet('Projects', 'POST', [projectPayload]),
        sendDataToSheet('Tasks', 'POST', tasksPayload)
    ]);
    
    if (projectResult.status === 'success' && taskResult.status === 'success') {
        alert(`Project "${newName}" added successfully with ID ${newID}. All 23 official tasks were loaded.`);
    } else {
        alert(`Failed to add project. Project Status: ${projectResult.status}. Task Status: ${taskResult.status}. Check the console for details.`);
    }
    
    // loadProjects() is called here to reload the selector immediately
    await loadProjects();
});

document.getElementById('deleteProjectBtn').addEventListener('click', async () => {
    if (!currentProjectID) return alert('No project is selected.');
    const currentProject = allProjects.find(p => String(p.ProjectID).trim() === String(currentProjectID).trim());
    
    if (!confirm(`WARNING: Are you sure you want to delete Project "${currentProject.Name}" (${currentProjectID})? This action will DELETE the project record and all associated data (Tasks, Expenses) from the Google Sheet.`)) {
        return; 
    }
    
    // SheetDB DELETE API: Delete rows where 'ProjectID' column equals currentProjectID
    const deleteUrls = [
        `${SHEET_API_URL}/ProjectID/${currentProjectID}?sheet=Projects`,
        `${SHEET_API_URL}/ProjectID/${currentProjectID}?sheet=Tasks`,
        `${SHEET_API_URL}/ProjectID/${currentProjectID}?sheet=Expenses`,
        `${SHEET_API_URL}/ProjectID/${currentProjectID}?sheet=Materials`
    ];

    const results = await Promise.all(deleteUrls.map(url => fetch(url, { method: 'DELETE' })));
    const jsonResults = await Promise.all(results.map(res => res.json()));

    // Check if the primary delete (Projects) was successful
    const primaryDeleteSuccess = jsonResults[0].deleted; 

    if (primaryDeleteSuccess) {
        alert(`Project ${currentProjectID} deleted successfully, including all associated Tasks, Expenses, and Materials!`);
        await loadProjects(); // Reload the dashboard
    } else {
        console.error('Delete results:', jsonResults);
        alert(`Failed to delete project. Please check the SheetDB console. Error: ${jsonResults[0].error || 'Unknown error'}`);
    }
});


// --- 8. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', loadProjects);
