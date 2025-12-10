// ==================== Todo Application ====================
// Full-featured Todo App with local storage, drag & drop, filters, and more

class TodoApp {
    constructor() {
        this.todos = [];
        this.projects = ['Personal', 'Work', 'Shopping'];
        this.currentFilter = 'all';
        this.currentProject = 'all';
        this.currentView = 'list'; // 'list' or 'board'
        this.currentSort = 'dateCreated';
        this.editingTodoId = null;
        this.theme = localStorage.getItem('theme') || 'light';
        
        this.init();
    }

    init() {
        this.loadFromStorage();
        this.setupEventListeners();
        this.applyTheme();
        this.render();
    }

    // ==================== Storage ====================
    loadFromStorage() {
        const savedTodos = localStorage.getItem('todos');
        const savedProjects = localStorage.getItem('projects');
        
        if (savedTodos) {
            this.todos = JSON.parse(savedTodos);
        }
        if (savedProjects) {
            this.projects = JSON.parse(savedProjects);
        }
    }

    saveToStorage() {
        localStorage.setItem('todos', JSON.stringify(this.todos));
        localStorage.setItem('projects', JSON.stringify(this.projects));
    }

    // ==================== Event Listeners ====================
    setupEventListeners() {
        // Header actions
        document.getElementById('searchInput').addEventListener('input', (e) => this.handleSearch(e));
        document.getElementById('viewToggle').addEventListener('click', () => this.toggleView());
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importData(e));

        // Main actions
        document.getElementById('addTodoBtn').addEventListener('click', () => this.openModal());
        document.getElementById('sortSelect').addEventListener('change', (e) => this.handleSort(e));

        // Sidebar
        document.getElementById('addProjectBtn').addEventListener('click', () => this.addProject());
        document.getElementById('projectList').addEventListener('click', (e) => this.handleProjectClick(e));
        document.querySelector('.filter-list').addEventListener('click', (e) => this.handleFilterClick(e));

        // Modal
        document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('todoForm').addEventListener('submit', (e) => this.handleFormSubmit(e));
        document.getElementById('deleteTodoBtn').addEventListener('click', () => this.deleteTodo());
        document.getElementById('addSubtaskBtn').addEventListener('click', () => this.addSubtask());

        // Close modal on outside click
        document.getElementById('todoModal').addEventListener('click', (e) => {
            if (e.target.id === 'todoModal') this.closeModal();
        });

        // Todo list delegation
        document.getElementById('todoList').addEventListener('click', (e) => this.handleTodoClick(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    // ==================== Rendering ====================
    render() {
        this.renderProjects();
        this.renderTodos();
        this.renderStats();
        this.updateFilterCounts();
    }

    renderProjects() {
        const projectList = document.getElementById('projectList');
        const projectSelect = document.getElementById('todoProject');
        
        // Sidebar projects
        let projectHTML = `
            <li class="project-item ${this.currentProject === 'all' ? 'active' : ''}" data-project="all">
                <span class="project-name">All Tasks</span>
                <span class="project-count">${this.todos.length}</span>
            </li>
        `;
        
        this.projects.forEach(project => {
            const count = this.todos.filter(t => t.project === project).length;
            projectHTML += `
                <li class="project-item ${this.currentProject === project ? 'active' : ''}" data-project="${project}">
                    <span class="project-name">${project}</span>
                    <span class="project-count">${count}</span>
                </li>
            `;
        });
        
        projectList.innerHTML = projectHTML;

        // Modal select
        let selectHTML = '<option value="">No Project</option>';
        this.projects.forEach(project => {
            selectHTML += `<option value="${project}">${project}</option>`;
        });
        projectSelect.innerHTML = selectHTML;
    }

    renderTodos() {
        const filteredTodos = this.getFilteredTodos();
        const sortedTodos = this.sortTodos(filteredTodos);

        if (this.currentView === 'list') {
            this.renderListView(sortedTodos);
        } else {
            this.renderBoardView(sortedTodos);
        }
    }

    renderListView(todos) {
        const todoList = document.getElementById('todoList');
        const emptyState = document.getElementById('emptyState');
        const listView = document.getElementById('listView');
        const boardView = document.getElementById('boardView');

        listView.style.display = 'block';
        boardView.style.display = 'none';

        if (todos.length === 0) {
            emptyState.style.display = 'block';
            todoList.innerHTML = '';
            return;
        }

        emptyState.style.display = 'none';
        
        const todosHTML = todos.map(todo => this.createTodoHTML(todo)).join('');
        todoList.innerHTML = todosHTML;
    }

    renderBoardView(todos) {
        const listView = document.getElementById('listView');
        const boardView = document.getElementById('boardView');
        
        listView.style.display = 'none';
        boardView.style.display = 'grid';

        const statuses = ['todo', 'inprogress', 'completed'];
        
        statuses.forEach(status => {
            const column = boardView.querySelector(`[data-status="${status}"] .board-column-content`);
            const statusTodos = todos.filter(t => t.status === status);
            const count = boardView.querySelector(`[data-status="${status}"] .board-count`);
            
            count.textContent = statusTodos.length;
            
            if (statusTodos.length === 0) {
                column.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No tasks</div>';
            } else {
                column.innerHTML = statusTodos.map(todo => this.createBoardCardHTML(todo)).join('');
            }
        });
    }

    createTodoHTML(todo) {
        const dueDate = todo.dueDate ? new Date(todo.dueDate) : null;
        const isOverdue = dueDate && dueDate < new Date() && !todo.completed;
        const dueDateStr = dueDate ? dueDate.toLocaleDateString() : '';

        const completedSubtasks = todo.subtasks.filter(s => s.completed).length;
        const totalSubtasks = todo.subtasks.length;
        const progress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

        return `
            <li class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
                <div class="todo-checkbox ${todo.completed ? 'checked' : ''}" data-action="toggle"></div>
                <div class="todo-content">
                    <div class="todo-header">
                        <span class="todo-title">${this.escapeHtml(todo.title)}</span>
                        <span class="todo-priority priority-${todo.priority}">${todo.priority}</span>
                    </div>
                    ${todo.description ? `<div class="todo-description">${this.escapeHtml(todo.description)}</div>` : ''}
                    ${totalSubtasks > 0 ? `
                        <div class="todo-progress">
                            <div class="todo-progress-bar" style="width: ${progress}%"></div>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">
                            ${completedSubtasks}/${totalSubtasks} subtasks completed
                        </div>
                    ` : ''}
                    <div class="todo-meta">
                        ${todo.project ? `<span class="todo-meta-item">📁 ${todo.project}</span>` : ''}
                        ${dueDate ? `<span class="todo-due-date ${isOverdue ? 'overdue' : ''}">📅 ${dueDateStr}</span>` : ''}
                        ${todo.tags.length > 0 ? `
                            <div class="todo-tags">
                                ${todo.tags.map(tag => `<span class="todo-tag">#${tag}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="todo-actions">
                    <button class="todo-action-btn" data-action="edit" title="Edit">✏️</button>
                    <button class="todo-action-btn" data-action="delete" title="Delete">🗑️</button>
                </div>
            </li>
        `;
    }

    createBoardCardHTML(todo) {
        const dueDate = todo.dueDate ? new Date(todo.dueDate).toLocaleDateString() : '';
        
        return `
            <div class="board-card" data-id="${todo.id}">
                <div class="todo-header">
                    <span class="todo-title">${this.escapeHtml(todo.title)}</span>
                    <span class="todo-priority priority-${todo.priority}">${todo.priority}</span>
                </div>
                ${todo.description ? `<div class="todo-description">${this.escapeHtml(todo.description)}</div>` : ''}
                <div class="todo-meta">
                    ${todo.project ? `<span class="todo-meta-item">📁 ${todo.project}</span>` : ''}
                    ${dueDate ? `<span class="todo-meta-item">📅 ${dueDate}</span>` : ''}
                </div>
            </div>
        `;
    }

    renderStats() {
        const total = this.todos.length;
        const completed = this.todos.filter(t => t.completed).length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

        document.getElementById('statTotal').textContent = total;
        document.getElementById('statCompleted').textContent = completed;
        document.getElementById('statRate').textContent = rate + '%';
        document.getElementById('statStreak').textContent = this.calculateStreak() + ' days';
    }

    updateFilterCounts() {
        const filters = {
            all: this.todos.length,
            active: this.todos.filter(t => !t.completed).length,
            completed: this.todos.filter(t => t.completed).length,
            urgent: this.todos.filter(t => t.priority === 'urgent').length,
            today: this.todos.filter(t => this.isDueToday(t)).length,
            overdue: this.todos.filter(t => this.isOverdue(t)).length
        };

        Object.keys(filters).forEach(filter => {
            const element = document.querySelector(`[data-filter="${filter}"] .filter-count`);
            if (element) element.textContent = filters[filter];
        });
    }

    // ==================== Filtering & Sorting ====================
    getFilteredTodos() {
        let filtered = [...this.todos];

        // Filter by project
        if (this.currentProject !== 'all') {
            filtered = filtered.filter(t => t.project === this.currentProject);
        }

        // Filter by status/type
        switch (this.currentFilter) {
            case 'active':
                filtered = filtered.filter(t => !t.completed);
                break;
            case 'completed':
                filtered = filtered.filter(t => t.completed);
                break;
            case 'urgent':
                filtered = filtered.filter(t => t.priority === 'urgent');
                break;
            case 'today':
                filtered = filtered.filter(t => this.isDueToday(t));
                break;
            case 'overdue':
                filtered = filtered.filter(t => this.isOverdue(t));
                break;
        }

        // Search filter
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(t => 
                t.title.toLowerCase().includes(searchTerm) ||
                t.description.toLowerCase().includes(searchTerm) ||
                t.tags.some(tag => tag.toLowerCase().includes(searchTerm))
            );
        }

        return filtered;
    }

    sortTodos(todos) {
        const sorted = [...todos];
        
        switch (this.currentSort) {
            case 'dateCreated':
                return sorted.sort((a, b) => b.createdAt - a.createdAt);
            case 'dueDate':
                return sorted.sort((a, b) => {
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate) - new Date(b.dueDate);
                });
            case 'priority':
                const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
                return sorted.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
            case 'name':
                return sorted.sort((a, b) => a.title.localeCompare(b.title));
            default:
                return sorted;
        }
    }

    // ==================== Event Handlers ====================
    handleTodoClick(e) {
        const todoItem = e.target.closest('.todo-item, .board-card');
        if (!todoItem) return;

        const todoId = todoItem.dataset.id;
        const action = e.target.closest('[data-action]')?.dataset.action;

        if (action === 'toggle') {
            this.toggleTodo(todoId);
        } else if (action === 'edit') {
            this.openModal(todoId);
        } else if (action === 'delete') {
            this.confirmDelete(todoId);
        } else if (!action) {
            this.openModal(todoId);
        }
    }

    handleProjectClick(e) {
        const projectItem = e.target.closest('.project-item');
        if (!projectItem) return;

        const project = projectItem.dataset.project;
        this.currentProject = project;
        
        document.querySelectorAll('.project-item').forEach(item => item.classList.remove('active'));
        projectItem.classList.add('active');

        document.getElementById('currentViewTitle').textContent = 
            project === 'all' ? 'All Tasks' : project;

        this.render();
    }

    handleFilterClick(e) {
        const filterItem = e.target.closest('.filter-item');
        if (!filterItem) return;

        const filter = filterItem.dataset.filter;
        this.currentFilter = filter;

        document.querySelectorAll('.filter-item').forEach(item => item.classList.remove('active'));
        filterItem.classList.add('active');

        this.render();
    }

    handleSearch(e) {
        this.render();
    }

    handleSort(e) {
        this.currentSort = e.target.value;
        this.render();
    }

    handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = {
            title: document.getElementById('todoTitle').value,
            description: document.getElementById('todoDescription').value,
            project: document.getElementById('todoProject').value,
            priority: document.getElementById('todoPriority').value,
            dueDate: document.getElementById('todoDueDate').value,
            status: document.getElementById('todoStatus').value,
            tags: document.getElementById('todoTags').value.split(',').map(t => t.trim()).filter(t => t),
            subtasks: this.getSubtasksFromForm()
        };

        if (this.editingTodoId) {
            this.updateTodo(this.editingTodoId, formData);
        } else {
            this.createTodo(formData);
        }

        this.closeModal();
    }

    handleKeyboard(e) {
        // Ctrl/Cmd + N: New todo
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            this.openModal();
        }
        // Escape: Close modal
        if (e.key === 'Escape') {
            this.closeModal();
        }
    }

    // ==================== CRUD Operations ====================
    createTodo(data) {
        const todo = {
            id: Date.now().toString(),
            title: data.title,
            description: data.description || '',
            project: data.project || '',
            priority: data.priority || 'medium',
            dueDate: data.dueDate || null,
            status: data.status || 'todo',
            tags: data.tags || [],
            subtasks: data.subtasks || [],
            completed: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.todos.push(todo);
        this.saveToStorage();
        this.render();
        this.showToast('Task created successfully!');
    }

    updateTodo(id, data) {
        const index = this.todos.findIndex(t => t.id === id);
        if (index === -1) return;

        this.todos[index] = {
            ...this.todos[index],
            ...data,
            completed: data.status === 'completed',
            updatedAt: Date.now()
        };

        this.saveToStorage();
        this.render();
        this.showToast('Task updated successfully!');
    }

    toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (!todo) return;

        todo.completed = !todo.completed;
        todo.status = todo.completed ? 'completed' : 'todo';
        todo.updatedAt = Date.now();

        this.saveToStorage();
        this.render();
    }

    deleteTodo() {
        if (!this.editingTodoId) return;

        this.confirmAction('Delete Task', 'Are you sure you want to delete this task?', () => {
            this.todos = this.todos.filter(t => t.id !== this.editingTodoId);
            this.saveToStorage();
            this.closeModal();
            this.render();
            this.showToast('Task deleted successfully!');
        });
    }

    confirmDelete(id) {
        this.confirmAction('Delete Task', 'Are you sure you want to delete this task?', () => {
            this.todos = this.todos.filter(t => t.id !== id);
            this.saveToStorage();
            this.render();
            this.showToast('Task deleted successfully!');
        });
    }

    // ==================== Modal ====================
    openModal(todoId = null) {
        const modal = document.getElementById('todoModal');
        const modalTitle = document.getElementById('modalTitle');
        const deleteBtn = document.getElementById('deleteTodoBtn');
        const form = document.getElementById('todoForm');

        this.editingTodoId = todoId;

        if (todoId) {
            const todo = this.todos.find(t => t.id === todoId);
            if (!todo) return;

            modalTitle.textContent = 'Edit Task';
            deleteBtn.style.display = 'block';

            // Fill form
            document.getElementById('todoTitle').value = todo.title;
            document.getElementById('todoDescription').value = todo.description;
            document.getElementById('todoProject').value = todo.project;
            document.getElementById('todoPriority').value = todo.priority;
            document.getElementById('todoDueDate').value = todo.dueDate || '';
            document.getElementById('todoStatus').value = todo.status;
            document.getElementById('todoTags').value = todo.tags.join(', ');

            // Render subtasks
            this.renderSubtasks(todo.subtasks);
        } else {
            modalTitle.textContent = 'Add New Task';
            deleteBtn.style.display = 'none';
            form.reset();
            document.getElementById('subtaskList').innerHTML = '';
        }

        modal.classList.add('show');
    }

    closeModal() {
        const modal = document.getElementById('todoModal');
        modal.classList.remove('show');
        this.editingTodoId = null;
    }

    // ==================== Subtasks ====================
    renderSubtasks(subtasks = []) {
        const container = document.getElementById('subtaskList');
        container.innerHTML = subtasks.map((subtask, index) => `
            <div class="subtask-item" data-index="${index}">
                <input type="checkbox" ${subtask.completed ? 'checked' : ''}>
                <input type="text" value="${this.escapeHtml(subtask.title)}" placeholder="Subtask title">
                <button type="button" class="btn-remove-subtask" onclick="app.removeSubtask(${index})">×</button>
            </div>
        `).join('');
    }

    addSubtask() {
        const container = document.getElementById('subtaskList');
        const index = container.children.length;
        
        const subtaskHTML = `
            <div class="subtask-item" data-index="${index}">
                <input type="checkbox">
                <input type="text" placeholder="Subtask title">
                <button type="button" class="btn-remove-subtask" onclick="app.removeSubtask(${index})">×</button>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', subtaskHTML);
    }

    removeSubtask(index) {
        const container = document.getElementById('subtaskList');
        const item = container.querySelector(`[data-index="${index}"]`);
        if (item) item.remove();
    }

    getSubtasksFromForm() {
        const subtasks = [];
        const items = document.querySelectorAll('.subtask-item');
        
        items.forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            const input = item.querySelector('input[type="text"]');
            const title = input.value.trim();
            
            if (title) {
                subtasks.push({
                    title,
                    completed: checkbox.checked
                });
            }
        });
        
        return subtasks;
    }

    // ==================== Projects ====================
    addProject() {
        const name = prompt('Enter project name:');
        if (!name || !name.trim()) return;

        if (this.projects.includes(name.trim())) {
            this.showToast('Project already exists!');
            return;
        }

        this.projects.push(name.trim());
        this.saveToStorage();
        this.renderProjects();
        this.showToast('Project created successfully!');
    }

    // ==================== View & Theme ====================
    toggleView() {
        this.currentView = this.currentView === 'list' ? 'board' : 'list';
        const icon = document.querySelector('.view-icon');
        icon.textContent = this.currentView === 'list' ? '📋' : '📊';
        this.render();
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('theme', this.theme);
        const icon = document.querySelector('.theme-icon');
        icon.textContent = this.theme === 'light' ? '🌙' : '☀️';
    }

    // ==================== Import/Export ====================
    exportData() {
        const data = {
            todos: this.todos,
            projects: this.projects,
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `todos-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showToast('Data exported successfully!');
    }

    importData(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                
                if (data.todos && Array.isArray(data.todos)) {
                    this.todos = data.todos;
                }
                if (data.projects && Array.isArray(data.projects)) {
                    this.projects = data.projects;
                }

                this.saveToStorage();
                this.render();
                this.showToast('Data imported successfully!');
            } catch (error) {
                this.showToast('Error importing data!');
                console.error(error);
            }
        };
        reader.readAsText(file);

        // Reset file input
        e.target.value = '';
    }

    // ==================== Utilities ====================
    isDueToday(todo) {
        if (!todo.dueDate) return false;
        const today = new Date();
        const due = new Date(todo.dueDate);
        return today.toDateString() === due.toDateString();
    }

    isOverdue(todo) {
        if (!todo.dueDate || todo.completed) return false;
        return new Date(todo.dueDate) < new Date();
    }

    calculateStreak() {
        // Simple implementation - counts consecutive days with completed tasks
        const completedDates = this.todos
            .filter(t => t.completed)
            .map(t => new Date(t.updatedAt).toDateString())
            .sort();

        if (completedDates.length === 0) return 0;

        let streak = 1;
        for (let i = completedDates.length - 1; i > 0; i--) {
            const current = new Date(completedDates[i]);
            const previous = new Date(completedDates[i - 1]);
            const diffDays = Math.floor((current - previous) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                streak++;
            } else if (diffDays > 1) {
                break;
            }
        }

        return streak;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    confirmAction(title, message, onConfirm) {
        const dialog = document.getElementById('confirmDialog');
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;

        dialog.classList.add('show');

        const handleConfirm = () => {
            onConfirm();
            cleanup();
        };

        const handleCancel = () => {
            cleanup();
        };

        const cleanup = () => {
            dialog.classList.remove('show');
            document.getElementById('confirmOk').removeEventListener('click', handleConfirm);
            document.getElementById('confirmCancel').removeEventListener('click', handleCancel);
        };

        document.getElementById('confirmOk').addEventListener('click', handleConfirm);
        document.getElementById('confirmCancel').addEventListener('click', handleCancel);
    }
}

// ==================== Initialize App ====================
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TodoApp();
});




