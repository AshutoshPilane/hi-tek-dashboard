// ==============================================================================
// script.js: ONLINE VERSION (SheetDB API Integration)
// Data is fetched from and sent to the live Google Sheet via SheetDB.
// ==============================================================================

// 🎯 CRITICAL: PASTE YOUR SHEETDB API URL HERE!
// Note: This URL does not use the /api/ path or Netlify redirect, as SheetDB handles CORS.
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

// --- 2. API UTILITY FUNCTIONS (UPDATED FOR SHEETDB) ---

/**
 * Fetches data from a specified sheet (GET request).
 * @param {string} sheetName The name of the Google Sheet tab (e.g., 'Projects').
 * @returns {Promise<Array<Object>>} The data rows from the sheet.
 */
const fetchDataFromSheet = async (sheetName) => {
    // SheetDB URL for GET requests to a specific sheet:
    // https://sheetdb.io/api/v1/YOUR_API_ID?sheet=SheetName
    const url = `${SHEET_API_URL}?sheet=${sheetName}`;
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // SheetDB returns a simple array of objects for a successful GET.
        return data;
    } catch (error) {
        console.error(`Fetch Error: ${error.message} on ${sheetName}`, error);
        const listElement = document.getElementById('recentExpensesList') || document.getElementById('taskList');
        if (listElement) {
            listElement.innerHTML = `<li class="placeholder-error">Critical API Connection Error to SheetDB: ${error.message} on ${sheetName}. Please check your SheetDB setup and API URL.</li>`;
        }
        return [];
    }
};

/**
 * Sends data to a specified sheet (POST request).
 * @param {string} sheetName The name of the Google Sheet tab.
 * @param {Array<Object>} payload The data array to send. SheetDB expects the data to be wrapped in a 'data' object.
 * @returns {Promise<Object>} The server response.
 */
const postDataToSheet = async (sheetName, payload) => {
    // SheetDB URL for POST requests to a specific sheet:
    // https://sheetdb.io/api/v1/YOUR_API_ID?sheet=SheetName
    const url = `${SHEET_API_URL}?sheet=${sheetName}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            // SheetDB typically handles CORS automatically
            headers: {
                'Content-Type': 'application/json',
            },
            // SheetDB POST data must be wrapped in a 'data' object
            body: JSON.stringify({ data: payload })
        });

        const result = await response.json();
        
        // Check for specific SheetDB error messages in the response body
        if (!response.ok || result.error) {
             // Use the returned JSON or HTTP status for error message
            const errorMessage = result.error ? result.error : `HTTP Status: ${response.status}`;
            throw new Error(`SheetDB POST Failed: ${errorMessage}`);
        }

        // SheetDB usually returns { "created": <number> } on success
        return { status: 'success', message: `Rows created: ${result.created || '1'}` };

    } catch (error) {
        console.error('Post Error:', error);
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
    
    // Clear dashboard display areas AND reset the project name display
    clearDashboard();
    currentProjectNameElement.textContent = 'Select a Project';

    try {
        const projectsData = await fetchDataFromSheet('Projects');
        if (projectsData && projectsData.length > 0) {
            // SheetDB returns all columns, assuming 'ProjectID' is one of them.
            allProjects = projectsData.filter(p => p.ProjectID); 

            allProjects.forEach(project => {
                const option = document.createElement('option');
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
 * Clears the content of all dynamic dashboard elements.
 */
const clearDashboard = () => {
    const idsToClear = [
        'kpi-days-spent', 'kpi-days-left', 'kpi-cost-vs-budget', 'kpi-status', 
        'kpi-budget', 'kpi-spent', 'kpi-remaining', 
        'project-start-date', 'project-deadline', 'project-contractor', 
        'project-engineers', 'project-contact1', 'project-contact2'
    ];

    idsToClear.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (id === 'kpi-cost-vs-budget') {
                 element.innerHTML = `
                    <div class="progress-bar-container"><div class="progress-bar" style="width: 0%;"></div></div>
                    N/A
                `;
            } else {
                element.textContent = 'N/A';
            }
        } else {
            console.warn(`Missing required dashboard element: #${id}. Check index.html consistency.`);
        }
    });
    
    const kpiStatusBox = document.getElementById('kpi-status')?.parentElement;
    if (kpiStatusBox) kpiStatusBox.style.backgroundColor = 'var(--color-accent)';
    
    const kpiDaysLeftBox = document.getElementById('kpi-days-left')?.parentElement;
    if (kpiDaysLeftBox) kpiDaysLeftBox.style.backgroundColor = 'var(--color-primary)';


    document.getElementById('taskList').innerHTML = '<li class="placeholder">Select a project to view tasks...</li>';
    document.getElementById('recentExpensesList').innerHTML = '<li class="placeholder">Select a project to view expenses...</li>';
    document.getElementById('materialsList').innerHTML = '<li class="placeholder">Select a project to view materials...</li>';
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
        // Load data specific to this project
        // Note: SheetDB filtering is done client-side here for simplicity,
        // but SheetDB supports search query parameters for server-side filtering.
        loadTasks(projectID);
        loadExpenses(projectID);
        loadMaterials(projectID);
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
    document.getElementById('project-start-date').textContent = project.StartDate || 'N/A';
    document.getElementById('project-deadline').textContent = project.Deadline || 'N/A';
    document.getElementById('project-contractor').textContent = project.Contractor || 'N/A';
    document.getElementById('project-engineers').textContent = project.Engineers || 'N/A';
    document.getElementById('project-contact1').textContent = project.Contact1 || 'N/A';
    document.getElementById('project-contact2').textContent = project.Contact2 || 'N/A';
    
    // 2. Initial Budget/Spent KPIs
    const budget = parseFloat(project.Budget) || 0;
    document.getElementById('kpi-budget').textContent = `₹${budget.toLocaleString('en-IN')}`;
    
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

    let daysSpent = 'N/A';
    
    const kpiDaysSpentElement = document.getElementById('kpi-days-spent');
    if (startDate && kpiDaysSpentElement) {
        daysSpent = diffInDays(startDate, today) - 1; 
        kpiDaysSpentElement.textContent = `${daysSpent > 0 ? daysSpent : 0} days`;
    }

    const kpiDaysLeftElement = document.getElementById('kpi-days-left');
    const kpiDaysLeftBox = kpiDaysLeftElement ? kpiDaysLeftElement.parentElement : null;

    if (deadline && kpiDaysLeftElement && kpiDaysLeftBox) {
        const daysToDeadline = diffInDays(today, deadline) - 1; 
        if (today <= deadline) {
            daysLeft = daysToDeadline > 0 ? daysToDeadline : 0;
            kpiDaysLeftElement.textContent = `${daysLeft} days`;
            kpiDaysLeftBox.style.backgroundColor = 'var(--color-primary)';
        } else {
            daysLeft = diffInDays(deadline, today); 
            kpiDaysLeftElement.textContent = `${daysLeft} days (OVERDUE)`;
            kpiDaysLeftBox.style.backgroundColor = 'var(--color-critical)';
        }
    } else if (kpiDaysLeftElement) {
         kpiDaysLeftElement.textContent = 'No Deadline';
    }

    // The remaining financial KPIs are updated after expenses are loaded in loadExpenses
};

// --- 5. TASK MANAGEMENT ---

const loadTasks = async (projectID) => {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '<li class="placeholder">Loading tasks...</li>';
    
    try {
        // Use SheetDB search feature for server-side filtering (more efficient)
        const url = `${SHEET_API_URL}/search?ProjectID=${projectID}&sheet=Tasks`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const projectTasks = await response.json();
        
        // Ensure data is an array
        if (!Array.isArray(projectTasks)) {
            taskList.innerHTML = '<li class="placeholder-error">Failed to parse task data from SheetDB.</li>';
            return;
        }

        taskList.innerHTML = ''; // Clear loading message

        if (projectTasks.length === 0) {
            taskList.innerHTML = '<li class="placeholder">No tasks found for this project.</li>';
            document.getElementById('kpi-status').textContent = 'No Tasks';
            return;
        }

        let completedTasks = 0;

        projectTasks.forEach(task => {
            const taskItem = document.createElement('li');
            const status = String(task.Status).trim().toLowerCase();
            const isCompleted = status === 'completed' || status === 'done';
            
            if (isCompleted) {
                completedTasks++;
            }

            taskItem.className = `task-item task-status-${status}`;
            taskItem.innerHTML = `
                <span class="task-name">${task.TaskName || 'N/A'}</span>
                <span class="task-responsible">Responsible: ${task.Responsible || 'N/A'}</span>
                <span class="task-status">${task.Status || 'Pending'}</span>
                <span class="task-date">${task.CompletionDate ? `Completed: ${task.CompletionDate}` : ''}</span>
            `;
            taskList.appendChild(taskItem);
        });

        // Update Project Status KPI
        const totalTasks = projectTasks.length;
        const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const kpiStatusElement = document.getElementById('kpi-status');
        if (kpiStatusElement) {
            kpiStatusElement.textContent = `${completionPercentage}% Completed (${completedTasks}/${totalTasks})`;

            const kpiStatusBox = kpiStatusElement.parentElement;
            if (kpiStatusBox) {
                kpiStatusBox.style.backgroundColor = 
                    completionPercentage === 100 ? 'var(--color-success)' :
                    completionPercentage > 50 ? 'var(--color-warning)' :
                    'var(--color-accent)';
            }
        }


    } catch (error) {
        console.error("Error loading tasks:", error);
        taskList.innerHTML = `<li class="placeholder-error">Failed to load tasks: ${error.message}</li>`;
        document.getElementById('kpi-status').textContent = 'Error';
    }
};

// --- 6. EXPENSE MANAGEMENT ---

let totalSpent = 0;

const loadExpenses = async (projectID) => {
    const expensesList = document.getElementById('recentExpensesList');
    expensesList.innerHTML = '<li class="placeholder">Loading expenses...</li>';
    totalSpent = 0;
    
    try {
        // Use SheetDB search feature for server-side filtering (more efficient)
        const url = `${SHEET_API_URL}/search?ProjectID=${projectID}&sheet=Expenses`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const projectExpenses = await response.json();
        
        if (!Array.isArray(projectExpenses)) {
            expensesList.innerHTML = '<li class="placeholder-error">Failed to parse expense data from SheetDB.</li>';
            return;
        }

        expensesList.innerHTML = ''; // Clear loading message

        if (projectExpenses.length === 0) {
            expensesList.innerHTML = '<li class="placeholder">No expenses recorded for this project.</li>';
        }

        // Calculate total spent
        projectExpenses.forEach(expense => {
            const amount = parseFloat(expense.Amount) || 0;
            totalSpent += amount;
            
            const expenseItem = document.createElement('li');
            expenseItem.className = 'expense-item';
            expenseItem.innerHTML = `
                <span class="expense-date">${expense.Date || 'N/A'}</span>
                <span class="expense-description">${expense.Description || 'N/A'}</span>
                <span class="expense-category expense-category-${(expense.Category || 'Other').toLowerCase()}">${expense.Category || 'N/A'}</span>
                <span class="expense-amount">₹${amount.toLocaleString('en-IN')}</span>
            `;
            expensesList.appendChild(expenseItem);
        });

        // Update Financial KPIs
        const currentProject = allProjects.find(p => String(p.ProjectID).trim() === String(projectID).trim());
        const budget = parseFloat(currentProject.Budget) || 0;
        const remaining = budget - totalSpent;

        document.getElementById('kpi-spent').textContent = `₹${totalSpent.toLocaleString('en-IN')}`;
        document.getElementById('kpi-remaining').textContent = `₹${remaining.toLocaleString('en-IN')}`;

        // Update Cost vs. Budget KPI (Full Width)
        const costVsBudgetElement = document.getElementById('kpi-cost-vs-budget');
        const spentPercentage = budget > 0 ? Math.round((totalSpent / budget) * 100) : (totalSpent > 0 ? 1000 : 0);
        
        if (costVsBudgetElement) {
            costVsBudgetElement.innerHTML = `
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${Math.min(spentPercentage, 100)}%; background-color: ${spentPercentage > 100 ? 'var(--color-critical)' : 'var(--color-success)'}"></div>
                </div>
                ${spentPercentage}% of Budget Spent
            `;
            costVsBudgetElement.style.color = spentPercentage > 100 ? 'var(--color-critical)' : 'var(--color-text)';
        }


    } catch (error) {
        console.error("Error loading expenses:", error);
        expensesList.innerHTML = `<li class="placeholder-error">Failed to load expenses: ${error.message}</li>`;
    }
};

document.getElementById('expenseEntryForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentProjectID) {
        console.warn('Cannot record expense: No project is selected.');
        alert('Please select a project before recording an expense.');
        return;
    }

    const form = e.target;
    const expenseDate = form.elements['expenseDate'].value;
    const expenseDescription = form.elements['expenseDescription'].value;
    const expenseAmount = form.elements['expenseAmount'].value;
    const expenseCategory = form.elements['expenseCategory'].value;
    
    const recordedBy = 'User Admin'; 

    const payload = {
        ProjectID: String(currentProjectID).trim(),
        Date: expenseDate,
        Description: expenseDescription,
        Amount: parseFloat(expenseAmount),
        Category: expenseCategory,
        RecordedBy: recordedBy
    };
    
    // SheetDB POST requires an array of objects to be sent
    const result = await postDataToSheet('Expenses', [payload]);

    if (result.status === 'success') {
        alert('Expense recorded successfully!');
        form.reset();
    } else {
        alert(`Failed to record expense. Check console for details. Error: ${result.message}`);
    }

    // Reload expenses to update the dashboard and list
    await loadExpenses(currentProjectID);
});

// --- 7. MATERIAL MANAGEMENT (Basic Stub) ---

const loadMaterials = async (projectID) => {
    const materialsList = document.getElementById('materialsList');
    materialsList.innerHTML = '<li class="placeholder">Loading materials...</li>';
    
    try {
        // Use SheetDB search feature for server-side filtering (more efficient)
        const url = `${SHEET_API_URL}/search?ProjectID=${projectID}&sheet=Materials`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const projectMaterials = await response.json();
        
        if (!Array.isArray(projectMaterials)) {
            materialsList.innerHTML = '<li class="placeholder-error">Failed to parse material data from SheetDB.</li>';
            return;
        }
        
        materialsList.innerHTML = ''; // Clear loading message

        if (projectMaterials.length === 0) {
            materialsList.innerHTML = '<li class="placeholder">No materials ordered for this project.</li>';
            return;
        }

        projectMaterials.forEach(material => {
            const materialItem = document.createElement('li');
            materialItem.className = 'material-item';
            materialItem.innerHTML = `
                <span class="material-name">${material.MaterialName || 'N/A'}</span>
                <span class="material-qty">${material.Quantity || 0} ${material.Unit || ''}</span>
                <span class="material-supplier">Supplier: ${material.Supplier || 'N/A'}</span>
                <span class="material-date">Ordered: ${material.OrderDate || 'N/A'}</span>
            `;
            materialsList.appendChild(materialItem);
        });

    } catch (error) {
        console.error("Error loading materials:", error);
        materialsList.innerHTML = `<li class="placeholder-error">Failed to load materials: ${error.message}</li>`;
    }
};

// --- 8. PROJECT ADD/DELETE ---

const generateNewID = () => {
    // Finds the highest existing numerical ID and increments it
    const existingIDs = allProjects.map(p => {
        const id = String(p.ProjectID).trim();
        // Check if ID matches pattern HT-XX
        const match = id.match(/^HT-(\d+)$/i); 
        return match ? parseInt(match[1], 10) : 0;
    });

    const maxID = Math.max(...existingIDs, 0);
    const newNum = maxID + 1;
    // Pad with zero if needed, e.g., HT-01, HT-10
    return `HT-${String(newNum).padStart(2, '0')}`; 
};


document.getElementById('addProjectBtn').addEventListener('click', async () => {
    const newName = prompt('Enter the name for the new project:');
    if (!newName || newName.trim() === '') return;

    const newID = generateNewID();
    const today = new Date().toISOString().split('T')[0];
    
    const payload = {
        // Project data for the 'Projects' sheet
        ProjectID: newID,
        Name: newName.trim(),
        StartDate: today,
        Deadline: '', 
        Budget: 0, 
        CreationDate: today,
        Contractor: '',
        Engineers: '',
        Contact1: '',
        Contact2: ''
    };

    // SheetDB POST requires an array of objects to be sent
    const projectResult = await postDataToSheet('Projects', [payload]);
    
    // Now prepare the 23-task template for the 'Tasks' sheet
    // SheetDB POST requires an array of objects to be sent
    const tasksPayload = HI_TEK_TASKS_MAP.map(task => ({
        ProjectID: newID,
        TaskName: task.Name,
        Responsible: task.Responsible,
        Status: 'Pending',
        CompletionDate: ''
    }));

    // Post the tasks to the 'Tasks' sheet
    const taskResult = await postDataToSheet('Tasks', tasksPayload);
    
    if (projectResult.status === 'success' && taskResult.status === 'success') {
        alert(`Project "${newName}" added successfully with ID ${newID}. All 23 official tasks were loaded.`);
    } else {
        alert(`Failed to add project. Project Status: ${projectResult.status}. Task Status: ${taskResult.status}. Check the console for details.`);
    }
    
    await loadProjects();
});

document.getElementById('deleteProjectBtn').addEventListener('click', () => {
    if (!currentProjectID) return alert('No project is selected.');
    const currentProject = allProjects.find(p => String(p.ProjectID).trim() === String(currentProjectID).trim());
    
    // SheetDB supports DELETE requests (DELETE https://sheetdb.io/api/v1/YOUR_API_ID/ProjectID/HT-01)
    // For safety, retaining the manual deletion prompt as this is a dashboard context.
    const confirmDelete = confirm(`WARNING: Deleting Project "${currentProject.Name}" requires manual removal of all associated data rows (Tasks, Expenses, Materials) from all four tabs in the Google Sheet. Proceed to the Google Sheet?`);
    
    if (confirmDelete) {
        // You would typically use a DELETE request for full automation:
        // fetch(`${SHEET_API_URL}/ProjectID/${currentProjectID}?sheet=Projects`, { method: 'DELETE' });
        
        window.open('https://docs.google.com/spreadsheets/', '_blank');
        alert("Please manually delete the project data row from ALL 4 tabs in your Google Sheet (or implement the SheetDB DELETE request).");
    }
});


// ==============================================================================
// 9. INITIALIZATION
// ==============================================================================

document.addEventListener('DOMContentLoaded', loadProjects);
