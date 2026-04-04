from __future__ import annotations

from version2 import DEFAULT_HOST, DEFAULT_PORT, app

__all__ = ["app", "DEFAULT_HOST", "DEFAULT_PORT"]

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=DEFAULT_HOST, port=DEFAULT_PORT, log_level="info")
