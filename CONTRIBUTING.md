# Contributing to Music Sync

Thank you for your interest in contributing to **Music Sync**! We welcome bug reports, feature proposals, documentation improvements, and code contributions.

---

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to the maintainers at **adhikarijanis@gmail.com**.

---

## How Can I Contribute?

### 1. Reporting Bugs

Before submitting a bug report, please check existing issues to ensure it hasn't already been reported.

When creating a bug report using our [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md), please include:
- A clear, descriptive title.
- Exact steps to reproduce the behavior.
- Expected vs. actual behavior.
- System environment details (OS, Python version, Node version, Docker version).
- Relevant terminal or container logs (e.g., `docker compose logs app`).

### 2. Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating a feature request using our [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md):
- Use a clear and descriptive title.
- Provide a detailed explanation of the proposed feature.
- Explain why this enhancement would be useful to users.

### 3. Improving Documentation

If you notice inaccuracies, broken links, or missing information in the documentation or [Wiki](https://github.com/janisadhi/Music-Sync/wiki), please submit a documentation issue or open a pull request directly.

---

## Development Setup

### Workspace Environment

1. **Fork and Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/Music-Sync.git
   cd Music-Sync
   ```

2. **Backend Setup**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Database Migration**:
   Ensure PostgreSQL is running locally or in Docker, configure `.env`, then run:
   ```bash
   alembic upgrade head
   ```

4. **Frontend Setup**:
   ```bash
   cd dashboard
   npm install
   npm run dev
   ```

---

## Development Guidelines

### Python Coding Standards
- Follow PEP 8 guidelines.
- Use explicit type hints for function arguments and return types.
- Format python code using standard tools (`black` / `ruff`).
- Ensure all new features or bug fixes include unit tests in the appropriate module directory (e.g., `app/downloader/test_*.py`).

### Frontend Coding Standards
- Write clean, modular React 19 functional components.
- Use predefined CSS variables and modern UI styling.
- Ensure API service calls are placed in `dashboard/src/services/`.

### Running Tests

Run backend tests using `pytest`:

```bash
# Run full test suite
pytest

# Run tests with verbose output
pytest -v

# Run specific test module
pytest app/downloader/test_downloader_service.py
```

---

## Pull Request Process

1. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Commit Changes**:
   Write clear, concise commit messages following conventional commit principles (e.g., `feat(downloader): add exponential backoff retry`, `fix(api): handle missing playlist error`).

3. **Validate Code Locally**:
   - Verify that all unit tests pass (`pytest`).
   - Verify that the React dashboard builds cleanly (`npm run build` inside `dashboard/`).
   - Check database migration compatibility (`alembic check` or test up/down revisions).

4. **Submit Pull Request**:
   Fill out the [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md) completely, describing:
   - What was changed.
   - Why the change was made.
   - How it was tested.
   - Any breaking changes or database migration considerations.
