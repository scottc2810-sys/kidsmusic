"""Stdio launcher for the Melo MCP server, runnable from any working directory:

    claude mcp add melo --env KM_MCP_TOKEN=<token> -- <path-to-venv-python> <path-to>/backend/melo_mcp.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
os.chdir(HERE)  # so relative settings (.env, data dir defaults) resolve like the web server

from app.mcp_server import main  # noqa: E402

if __name__ == "__main__":
    main()
