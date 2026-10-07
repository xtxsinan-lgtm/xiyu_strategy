#!/bin/bash
PROJECT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
open -n -a /Applications/Godot.app --args --path "$PROJECT_DIR"
