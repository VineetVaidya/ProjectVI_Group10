
const API_BASE = '/api';

// State
let currentUser = null;

// DOM Elements
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
    checkSession();
});

async function checkSession() {
    try {
        const res = await fetch(`${API_BASE}/session`);
        const data = await res.json();
        if (data.logged_in) {
            currentUser = data.user;
            showDashboard();
        } else {
            showAuth();
        }
    } catch (err) {
        console.error('Session check failed', err);
        showAuth();
    }
}

function showAuth() {
    authSection.classList.remove('hidden');
    studentSection.classList.add('hidden');
    teacherSection.classList.add('hidden');
    currentUser = null;
}

function showDashboard() {
    authSection.classList.add('hidden');
    if (currentUser.role === 'student') {
        studentSection.classList.remove('hidden');
        teacherSection.classList.add('hidden');
        loadStudentData();
    } else { // teacher
        studentSection.classList.add('hidden');
        teacherSection.classList.remove('hidden');
        loadTeacherData();
    }
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
            showDashboard();
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

async function logout() {
    await fetch(`${API_BASE}/logout`, { method: 'POST' });
    showAuth();
}

function toggleAuthMode() {
    loginForm.classList.toggle('hidden');
    registerForm.classList.toggle('hidden');
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
            Content: ${s.content}<br>
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

    if (!assignment_id || !content) {
        alert('Please select assignment and enter content');
        return;
    }

    const res = await fetch(`${API_BASE}/submissions`, {
        method: 'POST',
        body: JSON.stringify({ assignment_id, content })
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
            <div class="content-box">${s.content}</div>
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
