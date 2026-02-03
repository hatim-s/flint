#!/bin/bash

opencode --log-level DEBUG --prompt "@prd.json @progress.txt \
1. Read the prd.json and progress.txt files. \
2. Find the next incomplete task and implement it. \
3. Update progress.txt with what you did. \
4. Commit your changes. \
ONLY DO ONE TASK AT A TIME."