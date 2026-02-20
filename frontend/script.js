
const API_BASE = '/api';

// State
let currentUser = null;

// DOM Elements (Safely get elements as they might not exist on all pages)
const authSection = document.getElementById('authSection');
const studentSection = document.getElementById('studentSection');
const teacherSection = document.getElementById('teacherSection');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const assignmentSelect = document.getElementById('assignmentSelect');
const submissionText = document.getElementById('submissionText');
const gradeList = document.getElementById('gradeList');
const newAssignmentTitle = document.getElementById('newAssignmentTitle');
const newAssignmentDesc = document.getElementById('newAssignmentDesc');
const submissionsDiv = document.getElementById('submissionsDiff');
const assignmentsList = document.getElementById('assignmentsList');

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path === '/' || path.endsWith('index.html')) {
        // Login Page
        checkSessionForLogin();
    } else if (path.includes('/student')) {
        // Student Dashboard
        checkSessionForStudent();
    } else if (path.includes('/teacher')) {
        // Teacher Dashboard
        checkSessionForTeacher();
    }
});

// Logic for Login Page (index.html)
async function checkSessionForLogin() {
    try {
        const res = await fetch(`${API_BASE}/session`);
        const data = await res.json();
        if (data.logged_in) {
            // Already logged in, redirect to correct dashboard
            if (data.user.role === 'student') {
                window.location.href = '/student';
            } else {
                window.location.href = '/teacher';
            }
        } else {
            // Not logged in, stay here. Initialize login role selector.
            configureLoginByPath(); // This function is less relevant now as paths are distinct, but we keep it for now.
            authSection.classList.remove('hidden');
        }
    } catch (err) {
        console.error('Session check failed', err);
        authSection.classList.remove('hidden');
    }
}

// Logic for Student Page
async function checkSessionForStudent() {
    try {
        const res = await fetch(`${API_BASE}/session`);
        const data = await res.json();
        if (data.logged_in) {
            currentUser = data.user;
            if (currentUser.role !== 'student') {
                // Wrong role, redirect
                window.location.href = '/teacher';
                return;
            }
            // Authorized
            loadStudentData();
        } else {
            // Not logged in
            window.location.href = '/';
        }
    } catch (err) {
        window.location.href = '/';
    }
}

// Logic for Teacher Page
async function checkSessionForTeacher() {
    try {
        const res = await fetch(`${API_BASE}/session`);
        const data = await res.json();
        if (data.logged_in) {
            currentUser = data.user;
            if (currentUser.role !== 'teacher') {
                // Wrong role, redirect
                window.location.href = '/student';
                return;
            }
            // Authorized
            loadTeacherData();
        } else {
            // Not logged in
            window.location.href = '/';
        }
    } catch (err) {
        window.location.href = '/';
    }
}
// Removed configureLoginByPath, checkSession generic, showAuth, showDashboard as they are replaced by page-specific logic or simplified.

function configureLoginByPath() {
    // Kept for compatibility if index.html uses it, though less needed now.
    // Could just default to 'student' and let user pick.
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
            // Redirect based on role
            if (currentUser.role === 'student') {
                window.location.href = '/student';
            } else {
                window.location.href = '/teacher';
            }
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
            window.location.href = '/';
        } else {
            const data = await res.json();
            alert(data.error || 'Registration failed');
        }
    } catch (err) {
        alert('Registration error');
    }
}

async function logout() {
    await fetch(`${API_BASE}/logout`, { method: 'POST' });
    window.location.href = '/';
}



// Student Functions
async function loadStudentData() {
    loadAssignmentsForStudent();
    loadSubmissionsForStudent();
}

async function loadAssignmentsForStudent() {
    const res = await fetch(`${API_BASE}/assignments`);
    const assignments = await res.json();
    assignmentSelect.innerHTML = '<option value="">Select Assignment</option>';
    assignments.forEach(a => {
        assignmentSelect.innerHTML += `<option value="${a.id}">${a.title}</option>`;
    });
}

async function loadSubmissionsForStudent() {
    const res = await fetch(`${API_BASE}/submissions`);
    const submissions = await res.json();
    gradeList.innerHTML = '';

    if (submissions.length === 0) {
        gradeList.innerHTML = '<li>No submissions yet.</li>';
        return;
    }

    submissions.forEach(s => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>${s.title}</strong><br>
            File: <a href="/uploads/${s.file_path}" target="_blank">Download Submission</a><br>
            Comments: ${s.content}<br>
            Grade: ${s.grade || 'Pending'} <br>
            Feedback: ${s.feedback || 'None'}
            <hr>
        `;
        gradeList.appendChild(li);
    });
}

async function submitAssignment() {
    const assignment_id = assignmentSelect.value;
    const content = submissionText.value;
    const fileInput = document.getElementById('submissionFile');
    const file = fileInput.files[0];

    if (!assignment_id || !file) {
        alert('Please select assignment and upload a .zip file');
        return;
    }

    const formData = new FormData();
    formData.append('assignment_id', assignment_id);
    formData.append('content', content);
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/submissions`, {
        method: 'POST',
        body: formData
    });

    if (res.ok) {
        alert('Submitted!');
        submissionText.value = '';
        loadSubmissionsForStudent();
    } else {
        alert('Submission failed');
    }
}

// Teacher Functions
async function loadTeacherData() {
    loadAssignmentsForTeacher();
    loadSubmissionsForTeacher();
}

async function loadAssignmentsForTeacher() {
    const res = await fetch(`${API_BASE}/assignments`);
    const assignments = await res.json();
    assignmentsList.innerHTML = '';

    assignments.forEach(a => {
        const div = document.createElement('div');
        div.className = 'assignment-item';
        div.innerHTML = `
            <div>
                <strong>${a.title}</strong>: ${a.description}
            </div>
            <div>
                <button onclick="deleteAssignment(${a.id})">Delete</button>
            </div>
        `;
        assignmentsList.appendChild(div);
    });
}

async function createAssignment() {
    const title = newAssignmentTitle.value;
    const description = newAssignmentDesc.value;

    if (!title) return alert('Title required');

    const res = await fetch(`${API_BASE}/assignments`, {
        method: 'POST',
        body: JSON.stringify({ title, description })
    });

    if (res.ok) {
        newAssignmentTitle.value = '';
        newAssignmentDesc.value = '';
        loadAssignmentsForTeacher();
    } else {
        alert('Failed to create assignment');
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
    const res = await fetch(`${API_BASE}/submissions`);
    const submissions = await res.json();
    submissionsDiv.innerHTML = '';

    if (submissions.length === 0) {
        submissionsDiv.innerHTML = '<p>No submissions to grade.</p>';
        return;
    }

    submissions.forEach(s => {
        const div = document.createElement('div');
        div.className = 'submission-card';
        div.innerHTML = `
            <h4>${s.title} - ${s.student_name} (${s.student_email})</h4>
            <p>Submitted: ${new Date(s.submitted_at).toLocaleString()}</p>
            <div class="content-box">
                <a href="/uploads/${s.file_path}" target="_blank">Download Submission</a><br>
                Comments: ${s.content}
            </div>
            <div class="grade-box">
                <input type="text" placeholder="Grade" value="${s.grade || ''}" id="grade-${s.id}">
                <input type="text" placeholder="Feedback" value="${s.feedback || ''}" id="feedback-${s.id}">
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
