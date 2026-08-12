# Contributing to Music Sync

Thank you for your interest in contributing to **Music Sync**! We welcome contributions from developers of all skill levels, whether you are fixing bugs, improving documentation, submitting feature requests, or writing code.

---

## 📜 Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to the project maintainers at **adhikarijanis@gmail.com**.

---

## 🚀 How to Contribute

### 1. Reporting Bugs
Before opening a new issue, please search existing issues to ensure it hasn't already been reported.

When submitting a bug report, use our [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md) and include:
- Clear, descriptive title.
- Steps to reproduce the issue.
- Expected vs actual behavior.
- Environment details (OS, Docker version, Python version, Browser).
- Relevant log output (backend logs or container output).

### 2. Suggesting Features
Enhancement suggestions are tracked as GitHub issues. When suggesting features, use our [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md) and include:
- Clear explanation of the feature and problem it solves.
- Proposed implementation details or mockups if applicable.

---

## 🛠️ Local Development Setup

Music Sync consists of a Python/FastAPI backend and a React/Vite frontend orchestrated with Docker Compose.

### Prerequisites
- [Docker Engine](https://docs.docker.com/engine/) & [Docker Compose](https://docs.docker.com/compose/)
- [Python 3.13+](https://www.python.org/)
- [Node.js 20+](https://nodejs.org/) & `npm`

### Setup Instructions

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/your-username/Music-Sync.git
   cd Music-Sync
   ```

2. **Branching Model**:
   Create a topic branch for your work branching off `main`:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

3. **Running the Development Stack**:
   - Using Docker:
     ```bash
     docker compose up --build
     ```
   - Running Backend locally (without Docker):
     ```bash
     python -m venv venv
     source venv/bin/activate  # On Windows: venv\Scripts\activate
     pip install -r requirements.txt
     uvicorn app.main:app --reload --port 8000
     ```
   - Running Frontend locally (without Docker):
     ```bash
     cd dashboard
     npm install
     npm run dev
     ```

---

## 🧪 Coding Guidelines & Style

- **Python**: Follow PEP 8 guidelines. Type hints are strongly encouraged.
- **JavaScript/React**: Use functional components, React Hooks, and standard ESLint rules.
- **Commits**: Write clear, descriptive commit messages:
  - `feat: add last_n watch mode support`
  - `fix: handle missing LRCLIB lyric response gracefully`
  - `docs: update deployment options in README`

---

## 📬 Submitting a Pull Request (PR)

1. Ensure your code passes all local builds and linting.
2. Push your topic branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
3. Open a Pull Request against the `main` branch of `janisadhi/Music-Sync`.
4. Fill out the [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md).
5. Address any review comments or requested changes from maintainers.

Thank you for making Music Sync better! 🎵
