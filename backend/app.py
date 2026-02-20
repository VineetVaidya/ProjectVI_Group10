# app.py
from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, make_response, request, send_from_directory, session
import os
from werkzeug.utils import secure_filename

# Point static_folder to ../frontend since we moved files there

# Define base paths relative to this file
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
DATABASE_DIR = BASE_DIR / "database"
UPLOAD_FOLDER = BASE_DIR / "uploads"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
app.secret_key = "dev-secret-key-change-me"

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

DB_PATH = DATABASE_DIR / "school.db"
DB_PATH.parent.mkdir(exist_ok=True)


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = db()
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON")
    
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          role TEXT NOT NULL CHECK(role IN ('student','teacher')),
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS submissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          assignment_id INTEGER NOT NULL,
          student_id INTEGER NOT NULL,
          content TEXT NOT NULL,
          submitted_at TEXT NOT NULL,
          grade TEXT,
          feedback TEXT,
          graded_at TEXT,
          file_path TEXT,
          FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
          FOREIGN KEY (student_id) REFERENCES users(id)
        );
        """
    )

    
    # Migration: Check if file_path column exists
    cur = conn.execute("PRAGMA table_info(submissions)")
    columns = [row[1] for row in cur.fetchall()]
    if 'file_path' not in columns:
        conn.execute("ALTER TABLE submissions ADD COLUMN file_path TEXT")
    
    conn.commit()

    # Seed 1 teacher account (so you can login immediately)
    # Email: teacher@example.com  Password: teacher123
    cur = conn.execute("SELECT id FROM users WHERE email = ?", ("teacher@example.com",))
    if cur.fetchone() is None:
        conn.execute(
            "INSERT INTO users(role,name,email,password) VALUES(?,?,?,?)",
            ("teacher", "Teacher", "teacher@example.com", "teacher123"),
        )
        conn.commit()


def require_login() -> tuple[int, str]:
    user_id = session.get("user_id")
    role = session.get("role")
    if not user_id or not role:
        raise PermissionError("Not logged in")
    return int(user_id), str(role)


@app.errorhandler(PermissionError)
def handle_perm(e: PermissionError):
    return jsonify({"error": str(e)}), 401


@app.route("/")
def home():
    # Force NO CACHE
    resp = make_response(send_from_directory(str(FRONTEND_DIR), "index.html"))
    # Add simple cache busting headers
    resp.headers["Cache-Control"] = "no-store"
    return resp

@app.route("/student")
def student_page():
    resp = make_response(send_from_directory(str(FRONTEND_DIR), "student.html"))
    resp.headers["Cache-Control"] = "no-store"
    return resp

@app.route("/teacher")
def teacher_page():
    resp = make_response(send_from_directory(str(FRONTEND_DIR), "teacher.html"))
    resp.headers["Cache-Control"] = "no-store"
    return resp

# Serve other static files (js, css)
@app.route("/<path:path>")
def static_files(path):
    resp = make_response(send_from_directory(str(FRONTEND_DIR), path))
    resp.headers["Cache-Control"] = "no-store"
    return resp

# ---------------- Auth ----------------
@app.post("/api/register")
def register():
    data: dict[str, Any] = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not name or not email or not password:
        return jsonify({"error": "name, email, password required"}), 400

    conn = db()
    try:
        conn.execute(
            "INSERT INTO users(role,name,email,password) VALUES(?,?,?,?)",
            ("student", name, email, password),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "email already exists"}), 409

    return jsonify({"status": "registered"}), 201


@app.post("/api/login")
def login():
    data: dict[str, Any] = request.get_json(force=True)
    role = (data.get("role") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if role not in ("student", "teacher"):
        return jsonify({"error": "role must be student or teacher"}), 400

    conn = db()
    row = conn.execute(
        "SELECT id, role, name, email FROM users WHERE role=? AND email=? AND password=?",
        (role, email, password),
    ).fetchone()
    if row is None:
        return jsonify({"error": "invalid credentials"}), 401

    session["user_id"] = int(row["id"])
    session["role"] = row["role"]
    session["name"] = row["name"]
    session["email"] = row["email"]
    return jsonify({"status": "ok", "user": dict(row)})


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"status": "logged_out"})


@app.get("/api/session")
def get_session():
    if not session.get("user_id"):
        return jsonify({"logged_in": False})
    return jsonify(
        {
            "logged_in": True,
            "user": {
                "id": session["user_id"],
                "role": session["role"],
                "name": session["name"],
                "email": session["email"],
            },
        }
    )


# ---------------- Assignments ----------------
@app.get("/api/assignments")
def list_assignments():
    conn = db()
    rows = conn.execute(
        "SELECT id,title,description,created_at FROM assignments ORDER BY id DESC"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post("/api/assignments")
def create_assignment():
    user_id, role = require_login()
    if role != "teacher":
        raise PermissionError("Teacher only")

    data: dict[str, Any] = request.get_json(force=True)
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()

    if not title:
        return jsonify({"error": "title required"}), 400

    conn = db()
    conn.execute(
        "INSERT INTO assignments(title,description,created_at) VALUES(?,?,?)",
        (title, description, now_iso()),
    )
    conn.commit()
    return jsonify({"status": "created"}), 201

@app.put("/api/assignments/<int:id>")
def update_assignment(id: int):
    user_id, role = require_login()
    if role != "teacher":
        raise PermissionError("Teacher only")

    data: dict[str, Any] = request.get_json(force=True)
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()

    if not title:
        return jsonify({"error": "title required"}), 400

    conn = db()
    conn.execute(
        "UPDATE assignments SET title=?, description=? WHERE id=?",
        (title, description, id),
    )
    conn.commit()
    return jsonify({"status": "updated"})

@app.delete("/api/assignments/<int:id>")
def delete_assignment(id: int):
    user_id, role = require_login()
    if role != "teacher":
        raise PermissionError("Teacher only")

    conn = db()
    # Due to ON DELETE CASCADE, submissions should be deleted too, but we need to ensure PRAGMA foreign_keys is on
    conn.execute("DELETE FROM assignments WHERE id=?", (id,))
    conn.commit()
    return jsonify({"status": "deleted"})


# ---------------- Submissions ----------------
@app.post("/api/submissions")
def submit_assignment():
    user_id, role = require_login()
    if role != "student":
        raise PermissionError("Student only")

    # Handle form data and files
    assignment_id = int(request.form.get("assignment_id") or 0)
    content = (request.form.get("content") or "").strip()
    
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    if not allowed_file(file.filename):
        return jsonify({"error": "Only .zip files are allowed"}), 400

    if assignment_id <= 0:
        return jsonify({"error": "assignment_id required"}), 400

    if file:
        filename = secure_filename(file.filename)
        # Unique filename to avoid overwrites: timestamp_userid_filename
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        unique_filename = f"{timestamp}_{user_id}_{filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        
        conn = db()
        conn.execute(
            """
            INSERT INTO submissions(assignment_id, student_id, content, submitted_at, file_path)
            VALUES(?,?,?,?,?)
            """,
            (assignment_id, user_id, content, now_iso(), unique_filename),
        )
        conn.commit()
        return jsonify({"status": "submitted"}), 201

    return jsonify({"error": "Upload failed"}), 500


@app.get("/api/submissions")
def list_submissions():
    user_id, role = require_login()
    conn = db()

    if role == "student":
        rows = conn.execute(
            """
            SELECT s.id, s.assignment_id, a.title,
                   s.content, s.submitted_at,
                   s.grade, s.feedback, s.graded_at, s.file_path
            FROM submissions s
            JOIN assignments a ON a.id = s.assignment_id
            WHERE s.student_id = ?
            ORDER BY s.id DESC
            """,
            (user_id,),
        ).fetchall()
        return jsonify([dict(r) for r in rows])

    # teacher
    rows = conn.execute(
        """
        SELECT s.id, s.assignment_id, a.title,
               u.name AS student_name, u.email AS student_email,
               s.content, s.submitted_at,
               s.grade, s.feedback, s.graded_at, s.file_path
        FROM submissions s
        JOIN assignments a ON a.id = s.assignment_id
        JOIN users u ON u.id = s.student_id
        ORDER BY s.id DESC
        """
    ).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/uploads/<name>')
def download_file(name):
    return send_from_directory(app.config['UPLOAD_FOLDER'], name)


@app.patch("/api/submissions/<int:sub_id>")
def grade_submission(sub_id: int):
    user_id, role = require_login()
    if role != "teacher":
        raise PermissionError("Teacher only")

    data: dict[str, Any] = request.get_json(force=True)
    grade = (data.get("grade") or "").strip()
    feedback = (data.get("feedback") or "").strip()

    if not grade:
        return jsonify({"error": "grade required"}), 400

    conn = db()
    conn.execute(
        """
        UPDATE submissions
        SET grade=?, feedback=?, graded_at=?
        WHERE id=?
        """,
        (grade, feedback, now_iso(), sub_id),
    )
    conn.commit()
    return jsonify({"status": "graded"})



# Initialize DB on module import so Gunicorn triggers it
init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)

