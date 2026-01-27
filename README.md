# Student Management System

A web-based Student Management System built with Python (Flask) and SQLite, running in Docker.

## Structure
- `backend/`: Flask application and database.
- `frontend/`: HTML, CSS, JS.
- `docker/`: Docker configuration.
- `jmeter/`: Performance tests.

## Requirements
- Docker
- Docker Compose

## Running the Project
1. Navigate to the `docker` directory:
   ```powershell
   cd docker
   ```
2. Build and start the container:
   ```powershell
   docker compose up --build
   ```
3. Open your browser to: http://localhost:5000

## API Endpoints (for JMeter Testing)

### Base URL
`http://localhost:5000/api`

### Auth
- `POST /api/register`
  - Body: `{"name": "...", "email": "...", "password": "..."}`
- `POST /api/login`
  - Body: `{"role": "student"|"teacher", "email": "...", "password": "..."}`
- `POST /api/logout`

### Assignments (Teacher Only)
- `POST /api/assignments`
  - Headers: Cookie (session)
  - Body: `{"title": "...", "description": "..."}`
- `PUT /api/assignments/<id>`
  - Headers: Cookie (session)
  - Body: `{"title": "...", "description": "..."}`
- `DELETE /api/assignments/<id>`
  - Headers: Cookie (session)

### Submissions (Student Only)
- `POST /api/submissions`
  - Headers: Cookie (session)
  - Body: `{"assignment_id": 1, "content": "..."}`

### Grading (Teacher Only)
- `PATCH /api/submissions/<id>`
  - Headers: Cookie (session)
  - Body: `{"grade": "...", "feedback": "..."}`

## Default Teacher Creds
- **Email**: teacher@example.com
- **Password**: teacher123
