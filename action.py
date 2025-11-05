import subprocess
import sys
import os
from pathlib import Path

print("=== LOCAL DEVELOPMENT ENVIRONMENT CHECK ===")

# Check Node.js
try:
    node_version = subprocess.run(['node', '--version'], capture_output=True, text=True)
    if node_version.returncode == 0:
        print(f"✓ Node.js: {node_version.stdout.strip()}")
    else:
        print("✗ Node.js not found")
except FileNotFoundError:
    print("✗ Node.js not installed")

# Check npm
try:
    npm_version = subprocess.run(['npm', '--version'], capture_output=True, text=True)
    if npm_version.returncode == 0:
        print(f"✓ npm: {npm_version.stdout.strip()}")
    else:
        print("✗ npm not found")
except FileNotFoundError:
    print("✗ npm not installed")

# Check git
try:
    git_version = subprocess.run(['git', '--version'], capture_output=True, text=True)
    if git_version.returncode == 0:
        print(f"✓ Git: {git_version.stdout.strip()}")
    else:
        print("✗ Git not found")
except FileNotFoundError:
    print("✗ Git not installed")

# Check VS Code (optional but recommended)
try:
    code_version = subprocess.run(['code', '--version'], capture_output=True, text=True, timeout=5)
    if code_version.returncode == 0:
        print("✓ VS Code available")
    else:
        print("? VS Code not in PATH (optional)")
except (FileNotFoundError, subprocess.TimeoutExpired):
    print("? VS Code not found (optional)")

print(f"\n✓ Python: {sys.version}")
print(f"✓ Current directory: {Path.cwd()}")

print("\n=== READY FOR AUGMENT TASKS ===")
print("If Node.js + npm are ✓, we can proceed with:")
print("1. Generate Supabase schema SQL")
print("2. Generate React PWA scaffold via Augment")
print("3. Setup complete project structure")

print("\nNEXT STEP: Share your Supabase URL + anon key for .env setup")