#!/usr/bin/env python3
"""Run the entire AI Software Company organization validation suite.

    python3 tests/run_all.py

Exits non-zero on any failure. Equivalent to:

    python3 -m unittest discover -s tests -t tests -v
"""
import sys
import pathlib
import unittest

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def main() -> int:
    loader = unittest.TestLoader()
    suite = loader.discover(start_dir=str(HERE), pattern="test_*.py", top_level_dir=str(HERE))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
