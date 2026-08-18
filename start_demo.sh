#!/bin/bash

# Cleanup existing processes on ports 10000 and 10001
echo "Cleaning up existing processes on ports 10000 and 10001..."
lsof -ti:10000 | xargs kill -9 2>/dev/null || true
lsof -ti:10001 | xargs kill -9 2>/dev/null || true
sleep 1

# Start FastAPI backend in the background
echo "Starting FastAPI backend on http://localhost:10000..."
pushd backend > /dev/null
python3 main.py > backend.log 2>&1 &
BACKEND_PID=$!
popd > /dev/null

# Wait for backend to start
echo "Waiting for backend to be ready..."
sleep 5

# Check if backend is running
if ps -p $BACKEND_PID > /dev/null
then
   echo "Backend is running (PID: $BACKEND_PID)."
else
   echo "Error: Backend failed to start. Check backend/backend.log"
   # Display last few lines of backend.log to help debugging
   tail -n 20 backend/backend.log
   exit 1
fi

# Start Frontend server (Vite dev server)
echo "Starting Frontend server (Vite) on http://localhost:10001..."
pushd frontend > /dev/null
# Automatically run npm install if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "node_modules not found, running npm install..."
    npm install
fi
npm run dev -- --port 10001 --host > frontend.log 2>&1 &
FRONTEND_PID=$!
popd > /dev/null

echo "------------------------------------------------"
echo "Demo is ready!"
echo "Backend API: http://localhost:10000"
echo "Frontend UI: http://localhost:10001"
echo "------------------------------------------------"
echo "Press Ctrl+C to stop both servers."

# Trap Ctrl+C to kill all processes
trap "kill $BACKEND_PID $FRONTEND_PID; echo 'Servers stopped.'; exit" INT

# Keep script running
wait
