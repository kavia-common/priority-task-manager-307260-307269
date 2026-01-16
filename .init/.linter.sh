#!/bin/bash
cd /home/kavia/workspace/code-generation/priority-task-manager-307260-307269/frontend_react
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

