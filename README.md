
# 🚑 LifeLane
### Smart Emergency Corridor Management & Traffic Signal Priority System

## About the Project
LifeLane is a smart emergency traffic management prototype designed to improve emergency vehicle movement by prioritizing emergency requests and simulating optimized routes.

## Key Features
- Emergency requests for Ambulance and Fire Brigade
- Critical, High and Normal priority classification
- Emergency priority dispatch queue
- Interactive map using OpenStreetMap
- Route visualization using OSRM
- Simulated emergency vehicle tracking
- Pause, resume and manual tracking completion
- Automatic dispatch of the next emergency
- MongoDB database integration

## Technology Stack

### Frontend
- React
- TypeScript
- Vite
- Leaflet
- React-Leaflet

### Backend
- Node.js
- Express.js
- MongoDB Atlas
- Mongoose

## Project Structure
- `frontend/` – React frontend
- `backend/` – Express backend and database integration

## How to Run

### Backend
```bash
cd backend
npm install
```

Create a `.env` file:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
```

Start:
```bash
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Project Status
Academic PBL Prototype

Note: Emergency tracking and traffic priority are simulated. 
Real-world traffic signal control and live emergency dispatch integrations are not connected.
