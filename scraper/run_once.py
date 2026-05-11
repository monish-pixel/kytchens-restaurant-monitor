"""Single-poll entry point for GitHub Actions cron."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

import main

if __name__ == "__main__":
    asyncio.run(main.run_cycle())
