
const API_BASE = '/api';

// State
let currentUser = null;
let selectedCourse = null;

// Sample courses data (can be replaced with API later)
const courses = [
    {
        id: 1,
        code: 'MATH10100',
        name: 'Calculus I',
        section: 'Section 1',
        term: 'Winter 2026',
        description: 'Limits, derivatives, integrals, and the fundamental theorem of calculus.',
        color: '#2c5f7a',
        image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&h=400&fit=crop'
    },
    {
        id: 2,
        code: 'MATH20200',
        name: 'Linear Algebra',
        section: 'Section 2',
        term: 'Winter 2026',
        description: 'Vectors, matrices, determinants, eigenvalues, and linear transformations.',
        color: '#4a7c59',
        image: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=600&h=400&fit=crop'
    },
    {
        id: 3,
        code: 'MATH30300',
        name: 'Probability & Statistics',
        section: 'Section 1',
        term: 'Winter 2026',
        description: 'Random variables, distributions, hypothesis testing, and regression analysis.',
        color: '#7c4a6b',
        image: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=600&h=400&fit=crop'
    },
    {
        id: 4,
        code: 'MATH40400',
        name: 'Discrete Mathematics',
        section: 'Section 3',
        term: 'Winter 2026',
        description: 'Logic, set theory, combinatorics, graph theory, and proof techniques.',
        color: '#6b5b3e',
        image: 'https://images.unsplash.com/photo-1580492523406-7ae8e8d4e3fd?w=600&h=400&fit=crop'
    }
];

// DOM Elements
const authSection = document.getElementById('authSection');
const homePage = document.getElementById('homePage');
const studentSection = document.getElementById('studentSection');
const teacherSection = document.getElementById('teacherSection');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

// ==================== HASH-BASED ROUTING ====================
// Keeps the address bar in sync so JMeter / testers see real URLs:
//   #/login          – auth page
//   #/register       – register form
//   #/home           – home / course list
//   #/course/MATH10100              – course dashboard
//   #/course/MATH10100/assignments  – assignments list
//   #/course/MATH10100/assignment/3 – assignment detail
//   #/course/MATH10100/create       – teacher create assignment

let _skipHashChange = false;   // flag to avoid loops

function setHash(path) {
    _skipHashChange = true;
    window.location.hash = path;
    // Reset flag after the browser processes the hash change
    setTimeout(() => { _skipHashChange = false; }, 0);
}

function handleRoute() {
    const hash = (window.location.hash || '').replace(/^#\/?/, '');
    const parts = hash.split('/');

    // Not logged in — only allow login/register
    if (!currentUser) {
        if (parts[0] === 'register') {
            showAuth();
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
        } else {
            showAuth();
        }
        return;
    }

    // Logged in — route to correct view
    if (parts[0] === 'course' && parts[1]) {
        const courseCode = parts[1];
        const course = courses.find(c => c.code === courseCode);
        if (course) {
            selectedCourse = course;
            const subPage = parts[2] || 'dashboard';

            if (currentUser.role === 'student') {
                hideAllSections();
                studentSection.classList.remove('hidden');
                updateDashboardProfile('2');
                setupDashboardBanner();

                if (subPage === 'assignments') {
                    showStudentView('assignments');
                } else if (subPage === 'classlist') {
                    showStudentView('classlist');
                } else if (subPage === 'assignment' && parts[3]) {
                    // Need assignments cached first, then open detail
                    loadStudentData();
                    loadAssignmentsTable().then(() => {
                        openAssignmentDetail(parseInt(parts[3]), true);
                    });
                    return;
                } else {
                    showStudentView('dashboard');
                    loadStudentData();
                }
            } else {
                hideAllSections();
                teacherSection.classList.remove('hidden');
                updateDashboardProfile('3');
                setupTeacherBanner();

                if (subPage === 'assignments') {
                    showTeacherView('assignments');
                } else if (subPage === 'classlist') {
                    showTeacherView('classlist');
                } else if (subPage === 'create') {
                    showTeacherView('create');
                } else {
                    showTeacherView('dashboard');
                    loadTeacherData();
                }
            }
            return;
        }
    }

    if (parts[0] === 'login' || parts[0] === 'register') {
        showAuth();
        return;
    }

    // Default: show home
    showHomePageInternal();
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});

window.addEventListener('hashchange', () => {
    if (_skipHashChange) return;
    handleRoute();
});

async function checkSession() {
    try {
        const res = await fetch(`${API_BASE}/session`);
        const data = await res.json();
        if (data.logged_in) {
            currentUser = data.user;
            handleRoute();
        } else {
            showAuth();
        }
    } catch (err) {
        console.error('Session check failed', err);
        showAuth();
    }
}

function hideAllSections() {
    authSection.classList.add('hidden');
    homePage.classList.add('hidden');
    studentSection.classList.add('hidden');
    teacherSection.classList.add('hidden');
}

function showAuth() {
    hideAllSections();
    authSection.classList.remove('hidden');
    currentUser = null;
    setHash('/login');
}

// Internal version (no hash push — used by router itself)
function showHomePageInternal() {
    hideAllSections();
    homePage.classList.remove('hidden');
    updateProfileInfo();
    renderCourseGrid();
}

function showHomePage() {
    showHomePageInternal();
    setHash('/home');
}

function showDashboard() {
    hideAllSections();
    const code = selectedCourse ? selectedCourse.code : '';
    if (currentUser.role === 'student') {
        studentSection.classList.remove('hidden');
        showStudentView('dashboard');
        updateDashboardProfile('2');
        setupDashboardBanner();
        loadStudentData();
    } else {
        teacherSection.classList.remove('hidden');
        showTeacherView('dashboard');
        updateDashboardProfile('3');
        setupTeacherBanner();
        loadTeacherData();
    }
    setHash(`/course/${code}`);
}

function updateProfileInfo() {
    if (!currentUser) return;
    const initials = getInitials(currentUser.name);

    // Homepage profile
    const avatar = document.getElementById('profileAvatar');
    const name = document.getElementById('profileName');
    const navUser = document.getElementById('navUserName');
    if (avatar) avatar.textContent = initials;
    if (name) name.textContent = currentUser.name;
    if (navUser) navUser.textContent = currentUser.name;
}

function updateDashboardProfile(suffix) {
    if (!currentUser) return;
    const initials = getInitials(currentUser.name);

    const avatar = document.getElementById('profileAvatar' + suffix);
    const name = document.getElementById('profileName' + suffix);
    const navUser = document.getElementById('navUserName' + suffix);
    if (avatar) avatar.textContent = initials;
    if (name) name.textContent = currentUser.name;
    if (navUser) navUser.textContent = currentUser.name;
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function setupDashboardBanner() {
    if (!selectedCourse) return;
    const titleEl = document.getElementById('dashboardCourseTitle');
    const nameEl = document.getElementById('dashboardCourseName');
    const metaEl = document.getElementById('dashboardCourseMeta');
    const bannerImg = document.getElementById('dashboardBannerImg');

    if (titleEl) titleEl.textContent = selectedCourse.code + ' - ' + selectedCourse.name;
    if (nameEl) nameEl.textContent = selectedCourse.name;
    if (metaEl) metaEl.textContent = selectedCourse.code + ' - ' + selectedCourse.term + ' - ' + selectedCourse.section;
    if (bannerImg) bannerImg.style.background = `linear-gradient(135deg, ${selectedCourse.color}, ${selectedCourse.color}cc)`;
}

function setupTeacherBanner() {
    if (!selectedCourse) return;
    const titleEl = document.getElementById('teacherCourseTitle');
    const nameEl = document.getElementById('teacherCourseName');
    const metaEl = document.getElementById('teacherCourseMeta');

    if (titleEl) titleEl.textContent = selectedCourse.code + ' - ' + selectedCourse.name;
    if (nameEl) nameEl.textContent = selectedCourse.name;
    if (metaEl) metaEl.textContent = selectedCourse.code + ' - ' + selectedCourse.term + ' - ' + selectedCourse.section;
}

// Render course cards on homepage
function renderCourseGrid() {
    const grid = document.getElementById('courseGrid');
    if (!grid) return;
    grid.innerHTML = '';

    courses.forEach(course => {
        const card = document.createElement('div');
        card.className = 'course-card';
        card.onclick = () => selectCourse(course);
        card.innerHTML = `
            <div class="course-card-img" style="background-image: url('${course.image}'); background-color: ${course.color};">
                <div class="course-card-overlay">
                    <h3>${course.name}</h3>
                    <p>${course.code}</p>
                </div>
            </div>
            <div class="course-card-body">
                <p>${course.description}</p>
            </div>
            <div class="course-card-footer">
                <span class="course-card-badge">${course.term}</span>
                <span>${course.section}</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

function selectCourse(course) {
    selectedCourse = course;
    showDashboard();
}

function enterDashboardFromSidebar() {
    if (!selectedCourse) {
        // Default to first course if none selected
        selectedCourse = courses[0];
    }
    showDashboard();
}

// Auth Functions
async function login(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const role = document.getElementById('loginRole').value;

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            body: JSON.stringify({ email, password, role })
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data.user;
            setHash('/home');
            showHomePageInternal();
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (err) {
        alert('Login error');
    }
}

async function register(event) {
    event.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;

    try {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });
        if (res.ok) {
            alert('Registered! Please login.');
            toggleAuthMode();
        } else {
            const data = await res.json();
            alert(data.error || 'Registration failed');
        }
    } catch (err) {
        alert('Registration error');
    }
}

function toggleSettingsMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('settingsMenu');
    if (!menu) return;
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    menu.style.top = rect.bottom + 6 + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    menu.classList.toggle('hidden');
}

function closeSettingsMenu() {
    const menu = document.getElementById('settingsMenu');
    if (menu) menu.classList.add('hidden');
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('settingsMenu');
    if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target)) {
        closeSettingsMenu();
    }
});

async function logout() {
    closeSettingsMenu();
    await fetch(`${API_BASE}/logout`, { method: 'POST' });
    selectedCourse = null;
    showAuth();
}

function toggleAuthMode() {
    loginForm.classList.toggle('hidden');
    registerForm.classList.toggle('hidden');
    if (registerForm.classList.contains('hidden')) {
        setHash('/login');
    } else {
        setHash('/register');
    }
}

// ==================== VIEW SWITCHING ====================

function showStudentView(view, skipHash) {
    const views = ['Dashboard', 'Assignments', 'AssignmentDetail', 'Classlist'];
    views.forEach(v => {
        const el = document.getElementById('studentView' + v);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById('studentView' + view.charAt(0).toUpperCase() + view.slice(1));
    if (target) target.classList.remove('hidden');

    // Load data for specific views
    if (view === 'assignments') {
        loadAssignmentsTable();
    } else if (view === 'classlist') {
        loadClasslist('studentClasslistBody');
    }

    // Update URL hash
    if (!skipHash && selectedCourse) {
        const code = selectedCourse.code;
        if (view === 'assignments') {
            setHash(`/course/${code}/assignments`);
        } else if (view === 'classlist') {
            setHash(`/course/${code}/classlist`);
        } else if (view === 'dashboard') {
            setHash(`/course/${code}`);
        }
        // assignmentDetail hash is set in openAssignmentDetail()
    }
}

function showTeacherView(view, skipHash) {
    const views = ['Dashboard', 'Assignments', 'Create', 'Classlist'];
    views.forEach(v => {
        const el = document.getElementById('teacherView' + v);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById('teacherView' + view.charAt(0).toUpperCase() + view.slice(1));
    if (target) target.classList.remove('hidden');

    if (view === 'assignments') {
        loadTeacherAssignmentsTable();
    } else if (view === 'classlist') {
        loadClasslist('teacherClasslistBody');
    }
    if (view === 'create') {
        const t = document.getElementById('createAssignmentTitle');
        const d = document.getElementById('createAssignmentDesc');
        const f = document.getElementById('createAssignmentFile');
        if (t) t.value = '';
        if (d) d.value = '';
        if (f) f.value = '';
    }

    // Update URL hash
    if (!skipHash && selectedCourse) {
        const code = selectedCourse.code;
        if (view === 'assignments') {
            setHash(`/course/${code}/assignments`);
        } else if (view === 'create') {
            setHash(`/course/${code}/create`);
        } else if (view === 'classlist') {
            setHash(`/course/${code}/classlist`);
        } else if (view === 'dashboard') {
            setHash(`/course/${code}`);
        }
    }
}

// ==================== COURSE TOOLS DROPDOWN ====================

function toggleCourseTools(e) {
    e.stopPropagation();
    // Close all course tools menus first
    document.querySelectorAll('.ct-dropdown-menu').forEach(m => m.classList.add('hidden'));
    // Find the menu inside the same wrapper
    const wrapper = e.currentTarget.closest('.ct-dropdown-wrapper');
    const menu = wrapper ? wrapper.querySelector('.ct-dropdown-menu') : null;
    if (menu) menu.classList.toggle('hidden');
}

function closeCourseTools() {
    document.querySelectorAll('.ct-dropdown-menu').forEach(m => m.classList.add('hidden'));
}

// Close course tools when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.ct-dropdown-wrapper')) {
        closeCourseTools();
    }
});

// ==================== ASSIGNMENTS TABLE (Student) ====================

// Cached assignments data
let cachedAssignments = [];

async function loadAssignmentsTable() {
    const tbody = document.getElementById('assignmentsTableBody');
    if (!tbody) return;

    try {
        const code = selectedCourse ? selectedCourse.code : '';
        const res = await fetch(`${API_BASE}/assignments?course_code=${encodeURIComponent(code)}`);
        const assignments = await res.json();
        cachedAssignments = assignments;

        // Also fetch submissions for status
        const subRes = await fetch(`${API_BASE}/submissions`);
        const submissions = await subRes.json();

        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() + 7);

        tbody.innerHTML = '';

        // Category header row
        const catRow = document.createElement('tr');
        catRow.innerHTML = '<td colspan="4" class="category-row">No Category</td>';
        tbody.appendChild(catRow);

        if (assignments.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="4" style="padding:20px; color:#6e7477;">No assignments available.</td>';
            tbody.appendChild(emptyRow);
            return;
        }

        assignments.forEach((a, i) => {
            let dueDate;
            if (a.due_date) {
                dueDate = new Date(a.due_date + 'T08:00:00');
            } else {
                dueDate = new Date(baseDate);
                dueDate.setDate(dueDate.getDate() + (i * 14));
            }
            const endDate = new Date(dueDate);
            endDate.setDate(endDate.getDate() + 3);

            const dueDateStr = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const endDateStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            // Check submission status
            const sub = submissions.find(s => s.assignment_id === a.id);
            let statusHTML, scoreHTML, evalHTML;

            let nameClass, endHTML;
            const total = 30 + i * 5;

            if (sub) {
                const fileCount = sub.file_name ? 1 : Math.floor(Math.random() * 4) + 1;
                statusHTML = `<a href="#" class="table-link">1 Submission, ${fileCount} File${fileCount !== 1 ? 's' : ''}</a>`;
                if (sub.grade) {
                    const pct = ((parseFloat(sub.grade) / total) * 100).toFixed(0);
                    scoreHTML = `${sub.grade} / ${total} - ${pct} %`;
                    evalHTML = `Feedback: <a href="#" class="table-link" onclick="viewFeedback(${JSON.stringify(sub.grade)}, ${total}, ${JSON.stringify(sub.feedback || '')}, ${JSON.stringify(a.title)}); return false;">${sub.feedback ? 'Read' : 'Unread'}</a>`;
                } else {
                    scoreHTML = `- / ${total}`;
                    evalHTML = '';
                }
                // Submitted = bold black name
                nameClass = 'table-link-bold';
                endHTML = `<div class="assignment-end-text"><a href="#" class="table-link-small">Ends ${endDateStr}</a></div>`;
            } else {
                statusHTML = `<a href="#" class="table-link">Not Submitted</a>`;
                scoreHTML = `- / ${total}`;
                evalHTML = '';
                // Not submitted = blue link name
                nameClass = 'table-link-name';
                endHTML = `<div class="assignment-end-text"><a href="#" class="table-link-small">Ends ${endDateStr}</a></div>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="col-assignment">
                    <a href="#" class="${nameClass}" onclick="openAssignmentDetail(${a.id}); return false;">${a.title} Submission</a>
                    <div class="assignment-due-text">Due on ${dueDateStr} 10:00 AM</div>
                    ${endHTML}
                </td>
                <td class="col-status">${statusHTML}</td>
                <td class="col-score">${scoreHTML}</td>
                <td class="col-eval">${evalHTML}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding:20px; color:#6e7477;">Failed to load assignments.</td></tr>';
    }
}

// ==================== ASSIGNMENT DETAIL (Student) ====================

let currentAssignmentDetail = null;

function openAssignmentDetail(assignmentId, skipHash) {
    const a = cachedAssignments.find(x => x.id === assignmentId);
    if (!a) return;
    currentAssignmentDetail = a;

    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 7);
    const idx = cachedAssignments.indexOf(a);
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + (idx * 14));
    const endDate = new Date(dueDate);
    endDate.setDate(endDate.getDate() + 4);

    const dueDateStr = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const endDateStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const breadcrumb = document.getElementById('assignmentDetailBreadcrumb');
    const title = document.getElementById('assignmentDetailTitle');
    const dueLine = document.getElementById('assignmentDetailDue');
    const availLine = document.getElementById('assignmentDetailAvail');
    const fileCount = document.getElementById('assignmentFileCount');
    const fileInput = document.getElementById('assignmentFileInput');
    const comments = document.getElementById('assignmentComments');

    if (breadcrumb) breadcrumb.textContent = a.title + ' - Submission';
    if (title) title.textContent = a.title + ' - Submission';
    if (dueLine) dueLine.textContent = `Due on ${dueDateStr} 8:00 AM`;
    if (availLine) availLine.innerHTML = `Available until ${endDateStr} 8:00 AM. <strong>Access restricted after availability ends.</strong>`;
    if (fileCount) fileCount.textContent = '(0) file(s) to submit';
    if (fileInput) fileInput.value = '';
    if (comments) comments.value = '';

    // Show teacher's attached assignment file if present
    const fileArea = document.getElementById('assignmentDetailFile');
    if (fileArea) {
        if (a.file_name) {
            const origName = a.file_name.replace(/^\d+_/, '');
            fileArea.innerHTML = `<i class="bi bi-file-earmark-arrow-down"></i> <a href="/uploads/${a.file_name}" target="_blank" style="color:#2c5f7a;">Download Assignment File: ${origName}</a>`;
        } else {
            fileArea.innerHTML = '';
        }
    }

    showStudentView('assignmentDetail', true);
    if (!skipHash && selectedCourse) {
        setHash(`/course/${selectedCourse.code}/assignment/${assignmentId}`);
    }
}

function updateFileCount() {
    const fileInput = document.getElementById('assignmentFileInput');
    const fileCount = document.getElementById('assignmentFileCount');
    if (fileInput && fileCount) {
        const count = fileInput.files ? fileInput.files.length : 0;
        fileCount.textContent = `(${count}) file(s) to submit`;
    }
}

async function submitAssignmentDetail() {
    if (!currentAssignmentDetail) return;
    const comments = document.getElementById('assignmentComments');
    const fileInput = document.getElementById('assignmentFileInput');
    const content = comments ? comments.value.trim() : '';
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;

    if (!content && !file) {
        alert('Please add a file or comment before submitting.');
        return;
    }

    const formData = new FormData();
    formData.append('assignment_id', currentAssignmentDetail.id);
    formData.append('content', content || '');
    if (file) {
        formData.append('file', file);
    }

    const res = await fetch(`${API_BASE}/submissions`, {
        method: 'POST',
        body: formData
    });

    if (res.ok) {
        alert('Submitted successfully!');
        showStudentView('assignments');  // hash is set inside showStudentView
    } else {
        alert('Submission failed');
    }
}

// ==================== TEACHER ASSIGNMENTS TABLE ====================

async function loadTeacherAssignmentsTable() {
    const tbody = document.getElementById('teacherAssignmentsTableBody');
    if (!tbody) return;

    try {
        const code = selectedCourse ? selectedCourse.code : '';
        const res = await fetch(`${API_BASE}/assignments?course_code=${encodeURIComponent(code)}`);
        const assignments = await res.json();

        const subRes = await fetch(`${API_BASE}/submissions`);
        const submissions = await subRes.json();

        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() + 7);

        tbody.innerHTML = '';

        const catRow = document.createElement('tr');
        catRow.innerHTML = '<td colspan="4" class="category-row">No Category</td>';
        tbody.appendChild(catRow);

        if (assignments.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="4" style="padding:20px; color:#6e7477;">No assignments yet. Create one from the dashboard.</td>';
            tbody.appendChild(emptyRow);
            return;
        }

        assignments.forEach((a, i) => {
            const dueDate = new Date(baseDate);
            dueDate.setDate(dueDate.getDate() + (i * 14));
            const dueDateStr = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            const subs = submissions.filter(s => s.assignment_id === a.id);
            const subCount = subs.length;
            const total = 30 + i * 5;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="col-assignment">
                    <strong>${a.title} - Submission</strong>
                    <div class="assignment-due-text">Due on ${dueDateStr} 8:00 AM</div>
                </td>
                <td class="col-status"><a href="#" class="table-link" onclick="openSubmissionsModal(${a.id}, '${a.title.replace(/'/g, "\\'")}'); return false;">${subCount} submission(s)</a></td>
                <td class="col-score">/ ${total}</td>
                <td class="col-eval">
                    <button class="btn-small" onclick="deleteAssignment(${a.id}); loadTeacherAssignmentsTable();">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding:20px; color:#6e7477;">Failed to load assignments.</td></tr>';
    }
}

// Student Functions
async function loadStudentData() {
    loadSubmissionsForStudent();
    loadWorkToDo();
}

async function loadSubmissionsForStudent() {
    const gradeList = document.getElementById('gradeList');
    const code = selectedCourse ? selectedCourse.code : '';
    const [subRes, assignRes] = await Promise.all([
        fetch(`${API_BASE}/submissions`),
        fetch(`${API_BASE}/assignments?course_code=${encodeURIComponent(code)}`)
    ]);
    const submissions = await subRes.json();
    const assignments = await assignRes.json();

    // Build total map (id DESC order → index 0 = first in list)
    const totalMap = {};
    const courseAssignmentIds = new Set();
    assignments.forEach((a, i) => {
        totalMap[a.id] = 30 + i * 5;
        courseAssignmentIds.add(a.id);
    });

    // Only show submissions for this course's assignments
    const courseSubmissions = submissions.filter(s => courseAssignmentIds.has(s.assignment_id));

    gradeList.innerHTML = '';

    if (courseSubmissions.length === 0) {
        gradeList.innerHTML = '<li style="color:#5a6068;font-size:14px;padding:12px 0;">No submissions yet.</li>';
        return;
    }

    courseSubmissions.forEach(s => {
        const total = totalMap[s.assignment_id] || 100;
        let gradeHTML;
        if (s.grade) {
            const pct = Math.round((parseFloat(s.grade) / total) * 100);
            const colour = pct >= 70 ? '#1a7a4a' : pct >= 50 ? '#b35a00' : '#c0392b';
            gradeHTML = `<span class="grade-score" style="color:${colour};">${s.grade} / ${total} &mdash; ${pct}%</span>`;
        } else {
            gradeHTML = `<span class="grade-score pending">Pending</span>`;
        }

        const li = document.createElement('li');
        li.className = 'grade-list-item';
        li.innerHTML = `
            <div class="grade-item-title">${s.title}</div>
            <div class="grade-item-meta">${gradeHTML}</div>
            ${s.feedback ? `<div class="grade-item-feedback"><i class="bi bi-chat-left-text"></i> ${s.feedback}</div>` : ''}
        `;
        gradeList.appendChild(li);
    });
}

async function loadWorkToDo() {
    const workToDo = document.getElementById('workToDo');
    if (!workToDo) return;

    const code = selectedCourse ? selectedCourse.code : '';
    const res = await fetch(`${API_BASE}/assignments?course_code=${encodeURIComponent(code)}`);
    const assignments = await res.json();

    if (assignments.length === 0) {
        workToDo.innerHTML = '<p class="text-muted">No work to do right now.</p>';
        return;
    }

    // Generate realistic due dates starting from next week
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 7);

    cachedAssignments = assignments;
    workToDo.innerHTML = '';
    assignments.forEach((a, i) => {
        let dueDate;
        if (a.due_date) {
            dueDate = new Date(a.due_date + 'T08:00:00');
        } else {
            dueDate = new Date(baseDate);
            dueDate.setDate(dueDate.getDate() + (i * 14));
        }
        const now = new Date();
        const daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        const dateStr = dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const urgent = daysLeft <= 3;
        const urgentBadge = urgent
            ? `<span class="todo-urgent-badge">${daysLeft <= 0 ? 'Overdue' : daysLeft === 1 ? 'Due tomorrow' : `${daysLeft} days left`}</span>`
            : '';

        const div = document.createElement('div');
        div.className = 'work-todo-item';
        div.innerHTML = `
            <div class="work-todo-icon" style="${urgent ? 'background:#fff0ef;color:#c0392b;' : ''}"><i class="bi bi-file-earmark-text"></i></div>
            <div class="work-todo-info">
                <a href="#" class="work-todo-title" onclick="openAssignmentDetail(${a.id}); return false;">${a.title}</a>
                <span class="work-todo-due"><i class="bi bi-calendar3" style="font-size:11px;"></i> Due ${dateStr} ${urgentBadge}</span>
            </div>
        `;
        workToDo.appendChild(div);
    });
}

// submitAssignment is now handled by submitAssignmentDetail() in the assignment detail view

// Teacher Functions
async function loadTeacherData() {
    loadAssignmentsForTeacher();
    loadSubmissionsForTeacher();
}

async function loadAssignmentsForTeacher() {
    const assignmentsList = document.getElementById('assignmentsList');
    const code = selectedCourse ? selectedCourse.code : '';
    const [assignRes, subRes] = await Promise.all([
        fetch(`${API_BASE}/assignments?course_code=${encodeURIComponent(code)}`),
        fetch(`${API_BASE}/submissions`)
    ]);
    const assignments = await assignRes.json();
    const submissions = await subRes.json();
    assignmentsList.innerHTML = '';

    if (assignments.length === 0) {
        assignmentsList.innerHTML = '<p style="color:#5a6068;font-size:14px;">No assignments yet.</p>';
        return;
    }

    assignments.forEach((a, i) => {
        const total = 30 + i * 5;
        const subs = submissions.filter(s => s.assignment_id === a.id);
        const graded = subs.filter(s => s.grade).length;
        let dueStr = '';
        if (a.due_date) {
            const d = new Date(a.due_date + 'T08:00:00');
            dueStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }

        const div = document.createElement('div');
        div.className = 'manage-assignment-item';
        div.innerHTML = `
            <div class="ma-left">
                <div class="ma-title">${a.title}</div>
                <div class="ma-meta">
                    ${dueStr ? `<span><i class="bi bi-calendar3"></i> Due ${dueStr}</span>` : '<span style="color:#5a6068;">No due date</span>'}
                    <span class="ma-dot">·</span>
                    <span><i class="bi bi-people"></i> ${subs.length} submission${subs.length !== 1 ? 's' : ''}</span>
                    <span class="ma-dot">·</span>
                    <span><i class="bi bi-check2-circle"></i> ${graded} graded</span>
                    <span class="ma-dot">·</span>
                    <span>/ ${total} pts</span>
                </div>
                ${a.description ? `<div class="ma-desc">${a.description}</div>` : ''}
            </div>
            <div class="ma-actions">
                <button class="btn-small" onclick="deleteAssignment(${a.id})"><i class="bi bi-trash"></i></button>
            </div>
        `;
        assignmentsList.appendChild(div);
    });
}

async function createAssignment() {
    const newAssignmentTitle = document.getElementById('newAssignmentTitle');
    const newAssignmentDesc = document.getElementById('newAssignmentDesc');
    const newAssignmentFile = document.getElementById('newAssignmentFile');
    const newAssignmentDue = document.getElementById('newAssignmentDue');
    const title = newAssignmentTitle.value.trim();
    const description = newAssignmentDesc.value.trim();

    if (!title) return alert('Title required');

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('course_code', selectedCourse ? selectedCourse.code : '');
    formData.append('due_date', newAssignmentDue ? newAssignmentDue.value : '');
    if (newAssignmentFile && newAssignmentFile.files[0]) {
        formData.append('file', newAssignmentFile.files[0]);
    }

    const res = await fetch(`${API_BASE}/assignments`, {
        method: 'POST',
        body: formData
    });

    if (res.ok) {
        newAssignmentTitle.value = '';
        newAssignmentDesc.value = '';
        if (newAssignmentDue) newAssignmentDue.value = '';
        if (newAssignmentFile) newAssignmentFile.value = '';
        loadAssignmentsForTeacher();
    } else {
        alert('Failed to create assignment');
    }
}

async function createAssignmentFromPage() {
    const title = (document.getElementById('createAssignmentTitle').value || '').trim();
    const description = (document.getElementById('createAssignmentDesc').value || '').trim();
    const due_date = (document.getElementById('createAssignmentDue') || {}).value || '';
    const fileInput = document.getElementById('createAssignmentFile');

    if (!title) return alert('Title is required.');

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('course_code', selectedCourse ? selectedCourse.code : '');
    formData.append('due_date', due_date);
    if (fileInput && fileInput.files[0]) {
        formData.append('file', fileInput.files[0]);
    }

    let res;
    try {
        res = await fetch(`${API_BASE}/assignments`, {
            method: 'POST',
            body: formData
        });
    } catch (err) {
        alert('Network error — is the server running?');
        return;
    }

    if (res.ok) {
        showTeacherView('assignments');  // hash is set inside showTeacherView
    } else {
        const data = await res.json().catch(() => ({}));
        alert('Failed to post assignment: ' + (data.error || res.status));
    }
}

async function deleteAssignment(id) {
    if (!confirm('Are you sure? This will delete all submissions for this assignment.')) return;

    const res = await fetch(`${API_BASE}/assignments/${id}`, {
        method: 'DELETE'
    });

    if (res.ok) {
        loadAssignmentsForTeacher();
    } else {
        alert('Failed to delete');
    }
}

async function loadSubmissionsForTeacher() {
    const submissionsDiv = document.getElementById('submissionsDiff');

    const code = selectedCourse ? selectedCourse.code : '';
    const [subRes, assignRes] = await Promise.all([
        fetch(`${API_BASE}/submissions`),
        fetch(`${API_BASE}/assignments?course_code=${encodeURIComponent(code)}`)
    ]);
    const allSubmissions = await subRes.json();
    const assignments = await assignRes.json();

    // assignments come back ordered id DESC; build total map
    const totalMap = {};
    assignments.forEach((a, i) => { totalMap[a.id] = 30 + i * 5; });

    // Only show submissions that belong to this course's assignments
    const courseAssignmentIds = new Set(assignments.map(a => a.id));
    const submissions = allSubmissions.filter(s => courseAssignmentIds.has(s.assignment_id));

    submissionsDiv.innerHTML = '';

    if (submissions.length === 0) {
        submissionsDiv.innerHTML = '<p>No submissions to grade.</p>';
        return;
    }

    submissions.forEach(s => {
        const origName = s.file_name ? s.file_name.replace(/^\d+_/, '') : '';
        const fileLink = s.file_name
            ? `<p><i class="bi bi-file-earmark-arrow-down"></i> <a href="/uploads/${s.file_name}" target="_blank">View Submitted File: ${origName}</a></p>`
            : '';
        const total = totalMap[s.assignment_id] || 100;
        const div = document.createElement('div');
        div.className = 'submission-card';
        div.innerHTML = `
            <h4>${s.title} - ${s.student_name} (${s.student_email})</h4>
            <p>Submitted: ${new Date(s.submitted_at).toLocaleString()}</p>
            <div class="content-box">${s.content}</div>
            ${fileLink}
            <div class="grade-box">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                    <input type="text" placeholder="Score" value="${s.grade || ''}" id="grade-${s.id}" style="width:70px;">
                    <span style="font-size:14px;color:#555;">/ ${total} pts</span>
                </div>
                <input type="text" placeholder="Feedback (optional)" value="${s.feedback || ''}" id="feedback-${s.id}">
                <button onclick="gradeSubmission(${s.id})">Save Grade</button>
            </div>
        `;
        submissionsDiv.appendChild(div);
    });
}

async function gradeSubmission(id) {
    const grade = document.getElementById(`grade-${id}`).value;
    const feedback = document.getElementById(`feedback-${id}`).value;

    const res = await fetch(`${API_BASE}/submissions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ grade, feedback })
    });

    if (res.ok) {
        alert('Grade saved');
    } else {
        alert('Failed to save grade');
    }
}

// ==================== FEEDBACK MODAL ====================

function viewFeedback(grade, total, feedback, title) {
    document.getElementById('feedbackModalTitle').textContent = title + ' — Grade & Feedback';
    document.getElementById('feedbackModalGrade').textContent = grade + ' / ' + total;
    document.getElementById('feedbackModalText').textContent = feedback || 'No feedback was left by the teacher.';
    document.getElementById('feedbackModal').classList.remove('hidden');
}

function closeFeedbackModal() {
    document.getElementById('feedbackModal').classList.add('hidden');
}

// Close modal when clicking the backdrop
document.addEventListener('click', (e) => {
    const modal = document.getElementById('feedbackModal');
    if (modal && !modal.classList.contains('hidden') && e.target === modal) {
        closeFeedbackModal();
    }
});

// ==================== COURSE DROPDOWN ====================

// Extra filler courses (not clickable to dashboard, just for realism)
const fillerCourses = [
    'Math Program Information',
    'Academic Integrity at Learnestoga',
    'MATH50500-25F-Sec1-Differential Equations',
    'MATH60600-25F-Sec2-Real Analysis',
    'MATH70700-25F-Sec1-Abstract Algebra',
    'MATH80800-25F-Sec3-Numerical Methods',
    'MATH90900-25F-Sec2-Topology & Geometry'
];

function buildCourseDropdownList(filter) {
    const list = document.getElementById('courseDropdownList');
    if (!list) return;
    list.innerHTML = '';
    const q = (filter || '').toLowerCase();

    // Pinned / active courses (from sample data)
    courses.forEach(c => {
        const label = `${c.code}-26W-${c.section.replace('Section ', 'Sec')}-${c.name}`;
        if (q && !label.toLowerCase().includes(q)) return;
        const div = document.createElement('div');
        div.className = 'cd-item cd-pinned';
        div.innerHTML = `<span class="cd-item-name">${label}</span><i class="bi bi-pin-fill cd-pin"></i>`;
        div.onclick = () => { closeCourseDropdown(); selectCourse(c); };
        list.appendChild(div);
    });

    // Filler / past courses
    fillerCourses.forEach(name => {
        if (q && !name.toLowerCase().includes(q)) return;
        const div = document.createElement('div');
        div.className = 'cd-item';
        div.innerHTML = `<span class="cd-item-name">${name}</span><i class="bi bi-pin cd-pin"></i>`;
        list.appendChild(div);
    });
}

function toggleCourseDropdown(e) {
    e.stopPropagation();
    const dd = document.getElementById('courseDropdown');
    if (!dd) return;

    if (!dd.classList.contains('hidden')) {
        closeCourseDropdown();
        return;
    }

    // Position dropdown below the clicked button
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    dd.style.top = rect.bottom + 'px';
    dd.style.right = (window.innerWidth - rect.right) + 'px';
    dd.style.left = 'auto';

    // Populate and show
    const searchInput = document.getElementById('courseSearchInput');
    if (searchInput) searchInput.value = '';
    buildCourseDropdownList('');
    dd.classList.remove('hidden');
}

function closeCourseDropdown() {
    const dd = document.getElementById('courseDropdown');
    if (dd) dd.classList.add('hidden');
}

function filterCourseDropdown() {
    const searchInput = document.getElementById('courseSearchInput');
    buildCourseDropdownList(searchInput ? searchInput.value : '');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dd = document.getElementById('courseDropdown');
    if (dd && !dd.classList.contains('hidden') && !dd.contains(e.target)) {
        closeCourseDropdown();
    }
});

// ==================== SUBMISSIONS MODAL (Teacher) ====================

async function openSubmissionsModal(assignmentId, assignmentTitle) {
    const modal = document.getElementById('submissionsModal');
    const title = document.getElementById('submissionsModalTitle');
    const tbody = document.getElementById('submissionsModalBody');
    if (!modal || !tbody) return;

    title.textContent = assignmentTitle + ' — Submissions';
    tbody.innerHTML = '<tr><td colspan="8" style="padding:16px;">Loading...</td></tr>';
    modal.classList.remove('hidden');

    try {
        // Fetch submissions for this assignment AND full classlist
        const [subRes, classRes] = await Promise.all([
            fetch(`${API_BASE}/assignments/${assignmentId}/submissions`),
            fetch(`${API_BASE}/classlist`)
        ]);
        const submissions = await subRes.json();
        const allStudents = await classRes.json();

        tbody.innerHTML = '';

        if (allStudents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="padding:16px;color:#6e7477;">No students enrolled.</td></tr>';
            return;
        }

        // Build a map of student_id -> submission
        const subMap = {};
        submissions.forEach(s => { subMap[s.student_id] = s; });

        allStudents.forEach(student => {
            const sub = subMap[student.id];
            const initials = student.name.split(/[\s,]+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
            const tr = document.createElement('tr');

            if (sub) {
                const dateStr = new Date(sub.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                const origFile = sub.file_name ? sub.file_name.replace(/^\d+_/, '') : '';
                const fileLink = sub.file_name
                    ? `<a href="/uploads/${sub.file_name}" target="_blank" style="color:#006fbf;font-size:12px;"><i class="bi bi-file-earmark-arrow-down"></i> ${origFile}</a>`
                    : '<span style="color:#6e7477;font-size:12px;">—</span>';

                tr.innerHTML = `
                    <td style="text-align:center;"><div class="classlist-avatar" style="background:#0a7d8c;color:#fff;">${initials}</div></td>
                    <td><strong>${student.name}</strong> <span class="sub-status-badge submitted">Submitted</span></td>
                    <td style="font-size:13px;">${student.email}</td>
                    <td style="font-size:12px;">${dateStr}</td>
                    <td>${fileLink}</td>
                    <td><input type="text" value="${sub.grade || ''}" id="modal-grade-${sub.id}" placeholder="—"></td>
                    <td><input type="text" value="${(sub.feedback || '').replace(/"/g, '&quot;')}" id="modal-feedback-${sub.id}" placeholder="—"></td>
                    <td><button class="grade-save-btn" onclick="saveModalGrade(${sub.id})">Save</button></td>
                `;
            } else {
                tr.innerHTML = `
                    <td style="text-align:center;"><div class="classlist-avatar">${initials}</div></td>
                    <td>${student.name} <span class="sub-status-badge not-submitted">Not Submitted</span></td>
                    <td style="font-size:13px;">${student.email}</td>
                    <td style="color:#6e7477;font-size:12px;">—</td>
                    <td style="color:#6e7477;font-size:12px;">—</td>
                    <td style="color:#6e7477;font-size:12px;">—</td>
                    <td style="color:#6e7477;font-size:12px;">—</td>
                    <td></td>
                `;
            }
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="8" style="padding:16px;color:#c00;">Failed to load submissions.</td></tr>';
    }
}

function closeSubmissionsModal() {
    const modal = document.getElementById('submissionsModal');
    if (modal) modal.classList.add('hidden');
}

async function saveModalGrade(subId) {
    const gradeEl = document.getElementById(`modal-grade-${subId}`);
    const feedbackEl = document.getElementById(`modal-feedback-${subId}`);
    const grade = gradeEl ? gradeEl.value.trim() : '';
    const feedback = feedbackEl ? feedbackEl.value.trim() : '';

    if (!grade) {
        alert('Please enter a grade.');
        return;
    }

    const res = await fetch(`${API_BASE}/submissions/${subId}`, {
        method: 'PATCH',
        body: JSON.stringify({ grade, feedback })
    });

    if (res.ok) {
        alert('Grade saved!');
    } else {
        alert('Failed to save grade.');
    }
}

// Close submissions modal when clicking backdrop
document.addEventListener('click', (e) => {
    const modal = document.getElementById('submissionsModal');
    if (modal && !modal.classList.contains('hidden') && e.target === modal) {
        closeSubmissionsModal();
    }
});

// ==================== CLASSLIST ====================

// Convert "First Last" → "Last, First". Names already containing a comma are left as-is.
function caFileChanged(input) {
    const label = document.getElementById('caFileLabel');
    if (!label) return;
    if (input.files && input.files[0]) {
        label.innerHTML = `<i class="bi bi-file-earmark-check"></i> ${input.files[0].name}<input type="file" id="newAssignmentFile" accept=".pdf,.doc,.docx" style="display:none;" onchange="caFileChanged(this)">`;
        label.classList.add('has-file');
    } else {
        label.innerHTML = `<i class="bi bi-paperclip"></i> Choose file…<input type="file" id="newAssignmentFile" accept=".pdf,.doc,.docx" style="display:none;" onchange="caFileChanged(this)">`;
        label.classList.remove('has-file');
    }
}

function toLastFirst(name) {
    if (!name) return '';
    if (name.includes(',')) return name;
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return name;
    const last = parts[parts.length - 1];
    const first = parts.slice(0, -1).join(' ');
    return `${last}, ${first}`;
}

async function loadClasslist(tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="padding:16px;">Loading...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/classlist`);
        const students = await res.json();
        tbody.innerHTML = '';

        if (students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding:16px; color:#6e7477;">No students enrolled.</td></tr>';
            return;
        }

        students.forEach(s => {
            const displayName = toLastFirst(s.name);
            const initials = s.name.split(/[\s,]+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align:center;"><input type="checkbox" disabled></td>
                <td style="text-align:center;">
                    <div class="classlist-avatar">${initials}</div>
                </td>
                <td><a href="#" class="table-link-bold" onclick="return false;">${displayName}</a></td>
                <td>${s.email}</td>
                <td style="text-transform:capitalize;">${s.role}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding:16px; color:#c00;">Failed to load classlist.</td></tr>';
    }
}
