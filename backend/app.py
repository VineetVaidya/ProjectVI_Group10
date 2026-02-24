# app.py
from __future__ import annotations

import sqlite3
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from flask import Flask, g, jsonify, make_response, request, send_from_directory, session
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Point static_folder to ../frontend since we moved files there
app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app, supports_credentials=True)
app.secret_key = "dev-secret-key-change-me"  # for class project only

DB_PATH = Path("database/school.db")
DB_PATH.parent.mkdir(exist_ok=True)

UPLOAD_FOLDER = Path("uploads")
UPLOAD_FOLDER.mkdir(exist_ok=True)
ALLOWED_EXTENSIONS = {"pdf", "doc", "docx"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def save_upload(file_storage) -> str | None:
    """Save an uploaded file and return the stored filename, or None."""
    if not file_storage or not file_storage.filename:
        return None
    if not allowed_file(file_storage.filename):
        return None
    safe = secure_filename(file_storage.filename)
    unique_name = f"{int(time.time())}_{safe}"
    file_storage.save(UPLOAD_FOLDER / unique_name)
    return unique_name


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def db() -> sqlite3.Connection:
    """Get a per-request database connection with performance pragmas."""
    if "db_conn" not in g:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA busy_timeout=10000")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.row_factory = sqlite3.Row
        g.db_conn = conn
    return g.db_conn


@app.teardown_appcontext
def close_db(exception):
    """Close the database connection at the end of each request."""
    conn = g.pop("db_conn", None)
    if conn is not None:
        conn.close()


def init_db() -> None:
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA busy_timeout=10000")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    
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
          FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
          FOREIGN KEY (student_id) REFERENCES users(id)
        );
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_users_email_role ON users(email, role)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_code)")
    conn.commit()

    # Migrate: add columns if they don't exist yet
    for stmt in (
        "ALTER TABLE assignments ADD COLUMN file_name TEXT",
        "ALTER TABLE submissions ADD COLUMN file_name TEXT",
        "ALTER TABLE assignments ADD COLUMN course_code TEXT",
        "ALTER TABLE assignments ADD COLUMN due_date TEXT",
    ):
        try:
            conn.execute(stmt)
            conn.commit()
        except Exception:
            pass  # column already exists

    # Seed 1 teacher account (so you can login immediately)
    # Email: teacher@example.com  Password: teacher123
    cur = conn.execute("SELECT id FROM users WHERE email = ?", ("teacher@example.com",))
    if cur.fetchone() is None:
        conn.execute(
            "INSERT INTO users(role,name,email,password) VALUES(?,?,?,?)",
            ("teacher", "Teacher", "teacher@example.com", "teacher123"),
        )
        conn.commit()

    # Seed 20 mock students for the classlist
    mock_students = [
        ("Ahmed, Hana", "hahmed4032@dlearnestoga.ca"),
        ("Al Absi, Hashem", "halabsi5944@dlearnestoga.ca"),
        ("Alavi, Ali Zahid", "aalavi2401@dlearnestoga.ca"),
        ("Alieva, Zulfira", "zalieva1191@dlearnestoga.ca"),
        ("Angeles Luza, Jean Paul", "jangelesluza7933@dlearnestoga.ca"),
        ("Ardon Hernandez, Mauricio", "mardonhernandez4289@dlearnestoga.ca"),
        ("Bajaj, Daksh", "dbajaj8991@dlearnestoga.ca"),
        ("Dhaliwal, Ishaan", "idhaliwal1448@dlearnestoga.ca"),
        ("Hundal, Inderpreet Kaur", "ihundal8478@dlearnestoga.ca"),
        ("Kim, Soyeon", "skim6120@dlearnestoga.ca"),
        ("Martinez, Diego", "dmartinez3847@dlearnestoga.ca"),
        ("Nguyen, Linh", "lnguyen5512@dlearnestoga.ca"),
        ("Patel, Riya", "rpatel7764@dlearnestoga.ca"),
        ("Rodriguez, Sofia", "srodriguez2293@dlearnestoga.ca"),
        ("Singh, Arjun", "asingh4481@dlearnestoga.ca"),
        ("Chen, Wei", "wchen3356@dlearnestoga.ca"),
        ("Thompson, Marcus", "mthompson9102@dlearnestoga.ca"),
        ("Okafor, Chioma", "cokafor6678@dlearnestoga.ca"),
        ("Yamamoto, Kenji", "kyamamoto1834@dlearnestoga.ca"),
        ("Hassan, Fatima", "fhassan5527@dlearnestoga.ca"),
    ]
    for name, email in mock_students:
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if existing is None:
            conn.execute(
                "INSERT INTO users(role,name,email,password) VALUES(?,?,?,?)",
                ("student", name, email, "student123"),
            )
    conn.commit()

    # Seed a permanent assignment + submissions for JMeter to run against
    seed_assignment = conn.execute(
        "SELECT id FROM assignments WHERE title = 'JMeter Seed Assignment'"
    ).fetchone()
    if seed_assignment is None:
        cur = conn.execute(
            "INSERT INTO assignments(title,description,created_at,course_code) VALUES(?,?,?,?)",
            ("JMeter Seed Assignment", "Permanent seed for load testing", now_iso(), "MATH10100"),
        )
        seed_assignment_id = cur.lastrowid
        conn.commit()

        # Seed a submission from every student so JMeter threads spread across rows
        students = conn.execute(
            "SELECT id FROM users WHERE role = 'student'"
        ).fetchall()
        for student in students:
            conn.execute(
                "INSERT INTO submissions(assignment_id,student_id,content,submitted_at) VALUES(?,?,?,?)",
                (seed_assignment_id, student["id"], "JMeter seed submission", now_iso()),
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
    # Force NO CACHE so you always see latest HTML/JS
    resp = make_response(send_from_directory("../frontend", "index.html"))
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

# Serve other static files (js, css)
@app.route("/<path:path>")
def static_files(path):
    return send_from_directory("../frontend", path)

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


@app.route("/api/assignments", methods=["OPTIONS"])
@app.route("/api/assignments/<int:id>", methods=["OPTIONS"])
def assignments_options(id: int | None = None):
    if id is None:
        allowed = "GET, POST, OPTIONS"
    else:
        allowed = "GET, PUT, DELETE, OPTIONS"
    response = jsonify({"allowed_methods": allowed.split(", ")})
    response.headers["Allow"] = allowed
    return response, 200


# ---------------- Assignments ----------------
@app.get("/api/assignments")
def list_assignments():
    course_code = request.args.get('course_code', '').strip()
    conn = db()
    if course_code:
        rows = conn.execute(
            "SELECT id,title,description,created_at,file_name,due_date FROM assignments WHERE course_code=? ORDER BY id DESC",
            (course_code,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id,title,description,created_at,file_name,due_date FROM assignments ORDER BY id DESC"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post("/api/assignments")
def create_assignment():
    user_id, role = require_login()
    if role != "teacher":
        raise PermissionError("Teacher only")

    # Accept both multipart (with file) and plain JSON
    ct = request.content_type or ""
    if "multipart" in ct or "form" in ct:
        title = (request.form.get("title") or "").strip()
        description = (request.form.get("description") or "").strip()
        course_code = (request.form.get("course_code") or "").strip()
        due_date = (request.form.get("due_date") or "").strip()
        file_name = save_upload(request.files.get("file"))
    else:
        data: dict[str, Any] = request.get_json(force=True) or {}
        title = (data.get("title") or "").strip()
        description = (data.get("description") or "").strip()
        course_code = (data.get("course_code") or "").strip()
        due_date = (data.get("due_date") or "").strip()
        file_name = None

    if not title:
        return jsonify({"error": "title required"}), 400

    conn = db()
    cur = conn.execute(
        "INSERT INTO assignments(title,description,created_at,file_name,course_code,due_date) VALUES(?,?,?,?,?,?)",
        (title, description, now_iso(), file_name, course_code or None, due_date or None),
    )
    conn.commit()
    return jsonify({"status": "created", "id": cur.lastrowid}), 201

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

    # Accept multipart (with file) or plain JSON
    ct = request.content_type or ""
    if "multipart" in ct or "form" in ct:
        assignment_id = int(request.form.get("assignment_id") or 0)
        content = (request.form.get("content") or "").strip()
        file_name = save_upload(request.files.get("file"))
        if not content and file_name:
            content = f"(File: {request.files['file'].filename})"
    else:
        data: dict[str, Any] = request.get_json(force=True) or {}
        assignment_id = int(data.get("assignment_id") or 0)
        content = (data.get("content") or "").strip()
        file_name = None

    if assignment_id <= 0 or (not content and not file_name):
        return jsonify({"error": "assignment_id and content or file required"}), 400

    if not content:
        content = "(File submission)"

    conn = db()
    try:
        conn.execute(
            "INSERT INTO submissions(assignment_id, student_id, content, submitted_at, file_name) VALUES(?,?,?,?,?)",
            (assignment_id, user_id, content, now_iso(), file_name),
        )
    except sqlite3.OperationalError:
        conn.execute(
            "INSERT INTO submissions(assignment_id, student_id, content, submitted_at) VALUES(?,?,?,?)",
            (assignment_id, user_id, content, now_iso()),
        )
    conn.commit()
    return jsonify({"status": "submitted"}), 201


@app.get("/api/submissions")
def list_submissions():
    user_id, role = require_login()
    conn = db()

    if role == "student":
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 50, type=int)
        per_page = min(per_page, 100)
        offset = (page - 1) * per_page
        rows = conn.execute(
            """
            SELECT s.id, s.assignment_id, a.title,
                   s.content, s.submitted_at,
                   s.grade, s.feedback, s.graded_at, s.file_name
            FROM submissions s
            JOIN assignments a ON a.id = s.assignment_id
            WHERE s.student_id = ?
            ORDER BY s.id DESC
            LIMIT ? OFFSET ?
            """,
            (user_id, per_page, offset),
        ).fetchall()
        return jsonify([dict(r) for r in rows])

    # teacher
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    per_page = min(per_page, 100)
    offset = (page - 1) * per_page

    rows = conn.execute(
        """
        SELECT s.id, s.assignment_id, a.title,
               u.name AS student_name, u.email AS student_email,
               s.content, s.submitted_at,
               s.grade, s.feedback, s.graded_at, s.file_name
        FROM submissions s
        JOIN assignments a ON a.id = s.assignment_id
        JOIN users u ON u.id = s.student_id
        ORDER BY s.id DESC
        LIMIT ? OFFSET ?
        """,
        (per_page, offset),
    ).fetchall()
    return jsonify([dict(r) for r in rows])


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

    try:
        grade_value = float(grade)
        if grade_value < 0 or grade_value > 100:
            return jsonify({"error": "grade must be a number between 0 and 100"}), 400
    except ValueError:
        return jsonify({"error": "grade must be a numeric value between 0 and 100"}), 400

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



@app.delete("/api/submissions/<int:sub_id>")
def delete_submission(sub_id: int):
    user_id, role = require_login()
    if role != "teacher":
        raise PermissionError("Teacher only")

    conn = db()
    conn.execute("DELETE FROM submissions WHERE id=?", (sub_id,))
    conn.commit()
    return jsonify({"status": "deleted"})


# ---------------- Per-assignment submissions (teacher) ----------------
@app.get("/api/assignments/<int:aid>/submissions")
def assignment_submissions(aid: int):
    user_id, role = require_login()
    if role != "teacher":
        raise PermissionError("Teacher only")
    conn = db()
    rows = conn.execute(
        """
        SELECT s.id, s.student_id, u.name AS student_name, u.email AS student_email,
               s.content, s.submitted_at, s.grade, s.feedback, s.graded_at, s.file_name
        FROM submissions s
        JOIN users u ON u.id = s.student_id
        WHERE s.assignment_id = ?
        ORDER BY u.name
        """,
        (aid,),
    ).fetchall()
    return jsonify([dict(r) for r in rows])


# ---------------- Classlist ----------------
@app.get("/api/classlist")
def classlist():
    require_login()
    conn = db()
    rows = conn.execute(
        "SELECT id, name, email, role FROM users WHERE role = 'student' ORDER BY name"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.get("/uploads/<path:filename>")
def serve_upload(filename: str):
    return send_from_directory(UPLOAD_FOLDER, filename)


# Initialize DB on module import so Gunicorn triggers it
init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)

