"""
Root conftest.py

Sets DATABASE_URL to an in-memory SQLite URI so that tests that import
app modules (which trigger Settings validation on import) do not require a
live PostgreSQL connection or a .env file.

This must be set BEFORE any app module is imported, which is why it lives
in the root conftest rather than inside app/.
"""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
