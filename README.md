# Cloud-Native Online Examination System

Node.js + Express API with a lightweight browser front end, JWT auth, role-based access
(admin / student), timed exams with server-enforced deadlines, automatic grading,
Docker packaging and a GitHub Actions CI pipeline.

## Run locally
    npm install
    npm run seed      # optional: creates admin + a sample exam
    npm start         # http://localhost:3000

Default admin (from .env): admin@exam.local / Admin@12345. Change it before any real use.
Students self-register on the login page.

## Test
    npm test

## Docker
    docker compose up --build

## API summary
| Method | Path | Role |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | public |
| GET | /api/exams | any |
| POST | /api/exams | admin |
| DELETE | /api/exams/:id | admin |
| GET | /api/exams/:id/results | admin |
| POST | /api/exams/:id/start | student |
| POST | /api/exams/:id/submit | student |
| GET | /api/exams/results/me | student |
| GET | /health | public |

AWS deployment: see aws/README.md (planned, not implemented).