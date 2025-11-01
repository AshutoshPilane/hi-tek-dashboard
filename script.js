// ==============================================================================
// script.js: ONLINE VERSION (Google Sheet API Integration)
// Data is fetched from and sent to the live Google Sheet via a Web App.
// ==============================================================================

// 🎯 CRITICAL: PASTE YOUR NEW VERIFIED APPS SCRIPT URL HERE!
// !!! REPLACE THIS PLACEHOLDER AFTER PUBLISHING YOUR GOOGLE APPS SCRIPT !!!
const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbzxcMcx2Fm7ZW8lWX_1hxYemFP8n35XPbEIswQUm-V2xH4AraXGcdB2TH077BU4aIHVNA/exec"; 

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

// --- 2. API UTILITY FUNCTIONS (Corrected for Apps Script URL structure) ---

/**
 * Fetches data from a specified sheet (GET request).
 * @param {string} sheetName The name of the Google Sheet tab (e.g., 'Projects').
 * @returns {Promise<Array<Object>>} The data rows from the sheet.
 */
const fetchDataFromSheet = async (sheetName) => {
    // CORRECTED URL: Uses the single API endpoint with a 'sheet' query parameter.
    const url = `${SHEET_API_URL}?sheet=${sheetName}`;
    try {
        const response = await fetch(url);
        
        // The Apps Script web app returns a 200 even for errors, 
        // but if the response is not ok (e.g., 404, which should now be fixed), we throw.
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Apps Script may return a JSON object with an 'error' property on failure
        if (data.error) {
            throw new Error(`Apps Script Error: ${data.error}`);
        }

        return data; // Should be the array of data
    } catch (error) {
        console.error(`Fetch Error: ${error.message} on ${sheetName}`, error);
        // Display a user-friendly error message
        const listElement = document.getElementById('recentExpensesList') || document.getElementById('taskList');
        if (listElement) {
            listElement.innerHTML = `<li class="placeholder-error">Critical API Connection Error to Google Sheet Web App: ${error.message} on ${sheetName}. Please ensure your Apps Script is deployed correctly.</li>`;
        }
        return [];
    }
};

/**
 * Sends data to a specified sheet (POST request).
 * @param {string} sheetName The name of the Google Sheet tab.
 * @param {Object} payload The data object to send.
 * @returns {Promise<Object>} The server response.
 */
const postDataToSheet = async (sheetName, payload) => {
    // CORRECTED URL: Uses the single API endpoint with a 'sheet' query parameter.
    const url = `${SHEET_API_URL}?sheet=${sheetName}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            mode: 'cors', // Ensure CORS is enabled
            headers: {
                'Content-Type': 'application/json',
            },
            // The data is passed directly in the body as JSON.
            body: JSON.stringify(payload)
        });

        const textResponse = await response.text();
        
        if (!response.ok) {
            // Include response text in error for better debugging
            throw new Error(`API Request Failed (${response.status}): ${textResponse}`);
        }

        // Attempt to parse JSON; some Apps Script success responses might be plain text.
        try {
            return JSON.parse(textResponse);
        } catch (e) {
            // If it's not JSON, return a success object with the raw text
            return { status: 'success', message: textResponse };
        }

    } catch (error) {
        console.error('Post Error:', error);
        // Display a user-friendly error message to the user
        // This is important for the New Project/Add Expense buttons
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
            allProjects = projectsData.filter(p => p.ProjectID); // Filter out rows without ID

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
            // Display a message if no projects are found but the API call succeeded
            currentProjectNameElement.textContent = 'No Projects Found';
        }
    } catch (error) {
        console.error("Error loading projects:", error);
        currentProjectNameElement.textContent = 'Error Loading Projects';
    }
};

/**
 * Clears the content of all dynamic dashboard elements.
 * Includes safety checks to prevent 'Cannot set properties of null' errors.
 */
const clearDashboard = () => {
    const idsToClear = [
        'kpi-days-spent', 'kpi-days-left', 'kpi-cost-vs-budget', 'kpi-status', 
        'kpi-budget', 'kpi-spent', 'kpi-remaining', 
        'project-start-date', 'project-deadline', 'project-contractor', 
        'project-engineers', 'project-contact1', 'project-contact2'
    ];

    // Clear all text content and set to 'N/A'
    idsToClear.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            // Special handling for the progress bar container to reset its HTML
            if (id === 'kpi-cost-vs-budget') {
                 element.innerHTML = `
                    <div class="progress-bar-container"><div class="progress-bar" style="width: 0%;"></div></div>
                    N/A
                `;
            } else {
                element.textContent = 'N/A';
            }
        } else {
            // Log missing element for debugging, but prevent crash (This was the fix)
            console.warn(`Missing required dashboard element: #${id}. Check index.html consistency.`);
        }
    });
    
    // Reset status box color
    const kpiStatusBox = document.getElementById('kpi-status')?.parentElement;
    if (kpiStatusBox) kpiStatusBox.style.backgroundColor = 'var(--color-accent)';
    
    // Reset days left box color
    const kpiDaysLeftBox = document.getElementById('kpi-days-left')?.parentElement;
    if (kpiDaysLeftBox) kpiDaysLeftBox.style.backgroundColor = 'var(--color-primary)';


    // Clear task and expense lists
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

    // Find the selected project object
    const selectedProject = allProjects.find(p => String(p.ProjectID).trim() === String(projectID).trim());

    if (selectedProject) {
        currentProjectNameElement.textContent = selectedProject.Name;
        updateDashboard(selectedProject);
        // Load data specific to this project
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
    today.setHours(0, 0, 0, 0); // Normalize today's date

    const diffInDays = (date1, date2) => {
        if (!date1 || !date2) return NaN;
        const diffTime = Math.abs(date2 - date1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    let daysSpent = 'N/A';
    
    // Update Days Spent KPI
    const kpiDaysSpentElement = document.getElementById('kpi-days-spent');
    if (startDate && kpiDaysSpentElement) {
        daysSpent = diffInDays(startDate, today) - 1; // -1 to not count today as a full day spent
        kpiDaysSpentElement.textContent = `${daysSpent > 0 ? daysSpent : 0} days`;
    }

    // Update Days Left KPI
    const kpiDaysLeftElement = document.getElementById('kpi-days-left');
    const kpiDaysLeftBox = kpiDaysLeftElement ? kpiDaysLeftElement.parentElement : null;

    if (deadline && kpiDaysLeftElement && kpiDaysLeftBox) {
        const daysToDeadline = diffInDays(today, deadline) - 1; // -1 to not count today as a full day remaining
        if (today <= deadline) {
            daysLeft = daysToDeadline > 0 ? daysToDeadline : 0;
            kpiDaysLeftElement.textContent = `${daysLeft} days`;
            kpiDaysLeftBox.style.backgroundColor = 'var(--color-primary)';
        } else {
            daysLeft = diffInDays(deadline, today); // Calculate actual overdue days
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
        const allTasks = await fetchDataFromSheet('Tasks');
        const projectTasks = allTasks.filter(t => String(t.ProjectID).trim() === String(projectID).trim());
        
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

            // Set status box color based on percentage
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
        taskList.innerHTML = '<li class="placeholder-error">Failed to load tasks.</li>';
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
        const allExpenses = await fetchDataFromSheet('Expenses');
        const projectExpenses = allExpenses.filter(e => String(e.ProjectID).trim() === String(projectID).trim());
        
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
        expensesList.innerHTML = '<li class="placeholder-error">Failed to load expenses.</li>';
    }
};

document.getElementById('expenseEntryForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentProjectID) {
        // Use a more user-friendly modal or message box instead of alert()
        console.warn('Cannot record expense: No project is selected.');
        alert('Please select a project before recording an expense.');
        return;
    }

    const form = e.target;
    const expenseDate = form.elements['expenseDate'].value;
    const expenseDescription = form.elements['expenseDescription'].value;
    const expenseAmount = form.elements['expenseAmount'].value;
    const expenseCategory = form.elements['expenseCategory'].value;
    
    // NOTE: Hardcoded user for this single-user application
    const recordedBy = 'User Admin'; 

    const payload = {
        ProjectID: String(currentProjectID).trim(),
        Date: expenseDate,
        Description: expenseDescription,
        Amount: parseFloat(expenseAmount),
        Category: expenseCategory,
        RecordedBy: recordedBy
    };
    
    // The Apps Script expects an array of objects for bulk operations, 
    // even for a single record.
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
        const allMaterials = await fetchDataFromSheet('Materials');
        const projectMaterials = allMaterials.filter(m => String(m.ProjectID).trim() === String(projectID).trim());
        
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
        materialsList.innerHTML = '<li class="placeholder-error">Failed to load materials.</li>';
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
        Deadline: '', // To be filled in later
        Budget: 0, 
        CreationDate: today,
        Contractor: '',
        Engineers: '',
        Contact1: '',
        Contact2: ''
    };

    // The Apps Script expects an array of objects for bulk operations, 
    // even for a single record.
    const projectResult = await postDataToSheet('Projects', [payload]);
    
    // Now prepare the 23-task template for the 'Tasks' sheet
    // The Apps Script expects an array of objects
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
        // Give a more detailed error if one of the posts failed
        alert(`Failed to add project. Project Status: ${projectResult.status}. Task Status: ${taskResult.status}. Check the console for details.`);
    }
    
    await loadProjects();
});

document.getElementById('deleteProjectBtn').addEventListener('click', () => {
    if (!currentProjectID) return alert('No project is selected.');
    const currentProject = allProjects.find(p => String(p.ProjectID).trim() === String(currentProjectID).trim());
    
    // NOTE: Manual deletion is advised for comprehensive cleanup across multiple sheets.
    const confirmDelete = confirm(`WARNING: Deleting Project "${currentProject.Name}" requires manual removal of all associated data rows (Tasks, Expenses, Materials) from all four tabs in the Google Sheet. Proceed to the Google Sheet?`);
    
    // NOTE: Using a custom modal/message box is preferred over confirm/alert in production.
    if (confirmDelete) {
        window.open('https://docs.google.com/spreadsheets/', '_blank');
        alert("Please manually delete the project data row from ALL 4 tabs in your Google Sheet.");
    }
});


// ==============================================================================
// 9. INITIALIZATION
// ==============================================================================

document.addEventListener('DOMContentLoaded', loadProjects);
