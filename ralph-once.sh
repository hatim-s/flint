#!/bin/bash

opencode --model opencode/glm-4.7-free --log-level DEBUG --prompt "@docs/prd.json @docs/progress.txt \
1. Read the prd.json and progress.txt files. \
2. Find the next incomplete task and implement it. \
3. Update progress.txt with what you did. \
4. Commit your changes. \
ONLY DO ONE TASK AT A TIME."