#!/bin/bash
echo "Starting local server on http://localhost:8000"
echo "Visit http://localhost:8000/chat.html to view the application"
echo "Press Ctrl+C to stop the server"
python3 -m http.server 8000