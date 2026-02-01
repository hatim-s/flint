#!/bin/bash

opencode --log-level DEBUG --prompt "@PRD.md @progress.txt \
1. Read the @.opencode/prd.json and @.opencode/progress.txt files. \
2. Find the next incomplete task and implement it. \
3. Update progress.txt with what you did. \
4. Commit your changes. \
ONLY DO ONE TASK AT A TIME."