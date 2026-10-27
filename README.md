# Cloud-Native Online Examination System with CI/CD

A web app where admins create timed multiple-choice exams and students take them and are graded instantly.
Built with Node.js + Express, a plain HTML/CSS/JS front end, JWT authentication, Docker and GitHub Actions CI.
AWS deployment is the next phase.

## Project structure

    online-exam-system/
    |-- frontend/            What the user sees in the browser
    |   |-- index.html       The single page
    |   |-- style.css        Styling
    |   `-- app.js           Screens: login, student dashboard, exam, admin
    |-- backend/             The server (REST API)
    |   |-- src/
    |   |   |-- server.js    Starts the server
    |   |   |-- app.js       Express setup and routes
    |   |   |-- config.js    Settings from .env
    |   |   |-- seed.js      Creates the first admin and a sample exam
    |   |   |-- store.js     Data layer (JSON file for now)
    |   |   |-- middleware/auth.js   Token and role checks
    |   |   `-- routes/      auth.js (register, login), exams.js (exams, start, submit, results)
    |   |-- tests/           Automated tests (Jest + Supertest)
    |   `-- package.json
    |-- aws/                 Cloud deployment plan (next phase)
    |-- .github/workflows/   CI pipeline
    |-- Dockerfile
    `-- docker-compose.yml

## Run locally (Windows PowerShell)

    npm.cmd run setup     # install backend dependencies
    npm.cmd run seed      # create admin and sample exam
    npm.cmd start         # http://localhost:3000

Admin login: admin@exam.local / Admin@12345 (set in backend/.env). Students register on the login page.

## Test

    npm.cmd test

## Docker

    docker compose up --build

## CI/CD

On every push GitHub Actions runs the tests on Node 20 and 22, builds the Docker image and smoke-tests /health.
The AWS deploy step is planned (see aws/README.md).
