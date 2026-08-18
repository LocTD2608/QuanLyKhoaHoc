---
name: system-management
description: |
  Coordinates backend FastAPI operations and frontend HTTP serving. Use this skill when asked to start the demo servers, clean up active ports, check API logs, monitor server statuses, or debug connectivity.
---

# Local Environment and Server Management

This skill provides step-by-step instructions for managing and troubleshooting the backend FastAPI server, the static frontend, and associated network ports.

## 📋 Network Topology

| Component | Default URL | Service Type | Output Log File |
| :--- | :--- | :--- | :--- |
| **FastAPI Backend API** | `http://localhost:10000` | FastAPI (Python) | `backend/backend.log` |
| **Scientific Frontend UI** | `http://localhost:10001` | Simple HTTP Server | `frontend/frontend.log` |
| **RAG Chatbot Server** | `http://localhost:10002` | FastAPI (Web App) | `backend/services/rag_chatbot/web_app.log` |

---

## 🛠️ Operational Guide

### 1. Starting the Entire Demo Suite
To launch both the backend API and frontend servers simultaneously, run the main helper script from the workspace root:
```bash
./start_demo.sh
```
This script automatically:
1. Cleans up existing processes listening on ports `10000` and `10001`.
2. Starts the FastAPI backend in the background.
3. Starts the HTTP frontend in the background.
4. Traps the `Ctrl+C` exit signal to cleanly kill both processes upon stopping.

### 2. Manual Server Control

#### Starting Backend Manually
```bash
cd backend
python3 main.py > backend.log 2>&1 &
```

#### Starting Frontend Manually
```bash
cd frontend
python3 -m http.server 10001 > frontend.log 2>&1 &
```

### 3. Port Cleanup (Force Kill Servers)
If port conflicts arise or the servers fail to shut down properly, kill all active processes listening on the standard ports:
```bash
# Kill Backend
lsof -ti:10000 | xargs kill -9 2>/dev/null || true

# Kill Frontend
lsof -ti:10001 | xargs kill -9 2>/dev/null || true

# Kill RAG Chatbot
lsof -ti:10002 | xargs kill -9 2>/dev/null || true
```

### 🔍 Debugging & Troubleshooting

- **Checking logs**:
  Use `tail` to inspect runtime outputs and trace exceptions:
  ```bash
  # Check backend API logs
  tail -n 50 backend/backend.log

  # Check frontend logs
  tail -n 50 frontend/frontend.log

  # Check chatbot logs
  tail -n 50 backend/services/rag_chatbot/web_app.log
  ```
- **FastAPI Startup Failure**:
  If the backend fails to start, verify that required dependencies are installed:
  ```bash
  pip install -r backend/requirements.txt
  ```
- **Access CORS Issues**:
  The FastAPI application uses `CORSMiddleware` to allow all origins (`*`) and explicitly appends the `Access-Control-Allow-Private-Network` header, preventing local network access blocks in modern browsers.
