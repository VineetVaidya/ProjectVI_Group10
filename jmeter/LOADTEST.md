# Load Testing Guide — dLearnestoga

## Goal
Sustained 3-hour load test to crash the Flask/SQLite server, identify weak endpoints,
fix them, then re-run identical test for before/after comparison in the presentation.



## Endpoints Tested

### Auth Endpoints (both roles)
POST /api/register     — student registration (body: name, email, password)
POST /api/login        — login for student OR teacher (body: role, email, password)
GET  /api/session      — check current session state
POST /api/logout       — end session

### Assignment Endpoints (teacher)
GET    /api/assignments          — list all assignments
POST   /api/assignments          — create assignment (body: title, description + optional file)
PUT    /api/assignments/{id}     — update assignment (body: title, description)
DELETE /api/assignments/{id}     — delete assignment + all its submissions (cascade)

### Submission Endpoints
POST  /api/submissions           — student submits assignment (body: assignment_id, content + optional file)
GET   /api/submissions           — list submissions (student sees own; teacher sees all)
PATCH /api/submissions/{id}      — teacher grades a submission (body: grade, feedback)


## Second Instance Test
At ~1.5 hours: open a second browser 
Use the app normally for 15 minutes. Watch for Response Time spikes in JMeter.




## Re-run
Run load_test.jmx again with identical settings after fixes.
Compare Aggregate Reports side by side — that's the presentation slide.
