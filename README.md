# voice-era - Sign Language Video Calling Platform

A real-time video calling platform with integrated sign language recognition, designed to help deaf/mute individuals communicate effectively.

## 🌟 Features

### Core Video Calling
- **Multi-participant video calls** (up to 6 participants)
- **WebRTC peer-to-peer connections** for high-quality video/audio
- **Room-based system** with unique room IDs (like Google Meet/Zoom)
- **Camera and microphone controls** (mute/unmute, video on/off)
- **Graceful fallback** for users without camera/microphone access

### Sign Language Recognition
- **Real-time ISL recognition** using custom TensorFlow model
- **106 sign classes** including:
  - ISL Alphabet (A-Z)
  - Numbers (1, 3-9)
  - Common words (namastey, help, accept, home, school, etc.)
- **MediaPipe integration** for hand/face landmark detection
- **Live captions** with confidence scores
- **Dual-input model** (128x128 image + 63 landmark features)

### Communication Features
- **Real-time chat** during video calls
- **Live caption display** with participant names
- **Shared caption area** for all participants
- **Caption overlay** on video feeds
- **Message history** and caption history

### User Experience
- **Beautiful modern UI** with gradient design and glassmorphism effects
- **Responsive layout** for desktop and mobile
- **Professional controls** similar to Google Meet/Zoom
- **Real-time updates** via WebSocket connections
- **Error handling** and graceful degradation

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 16+
- MongoDB
- Modern web browser with WebRTC support

### Installation

1. **Backend Setup**
```bash
cd backend
pip install -r requirements.txt
```

2. **Frontend Setup**
```bash
cd frontend
yarn install
```

3. **Environment Configuration**
```bash
# backend/.env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="voice-era_db"
CORS_ORIGINS="*"

# frontend/.env
REACT_APP_BACKEND_URL=http://localhost:8001
```

### Running the Application

1. **Start MongoDB**
```bash
mongod
```

2. **Start Backend**
```bash
cd backend
python server.py
```

3. **Start Frontend**
```bash
cd frontend
yarn start
```

4. **Access the Application**
- Open http://localhost:3000 in your browser
- Create a room or join with a room ID
- Allow camera/microphone access for full functionality

## 🌐 Deployment with ngrok

For testing with friends or remote deployment:

1. **Install ngrok**
```bash
npm install -g ngrok
```

2. **Expose Backend**
```bash
ngrok http 8001
```

3. **Update Frontend Environment**
```bash
# Update frontend/.env with ngrok URL
REACT_APP_BACKEND_URL=https://abc123.ngrok.io
```

4. **Expose Frontend**
```bash
ngrok http 3000
# Share this URL with friends
```

## 📁 Project Structure

```
voice-era/
├── backend/
│   ├── server.py              # Main FastAPI application
│   ├── sign_model.h5          # Trained TensorFlow model
│   ├── labels.joblib          # Sign language class labels
│   ├── requirements.txt       # Python dependencies
│   └── .env                   # Backend environment variables
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── HomePage.js     # Room creation/joining
│   │   │   ├── RoomPage.js     # Main video call interface
│   │   │   ├── VideoCall.js    # Video grid component
│   │   │   ├── Chat.js         # Chat functionality
│   │   │   └── Captions.js     # Caption display
│   │   ├── App.js             # Main React component
│   │   └── App.css            # Styling and animations
│   ├── package.json           # Node.js dependencies
│   └── .env                   # Frontend environment variables
└── README.md                  # This file
```

## 🤖 Machine Learning Model

### Model Architecture
- **Input Layer 1**: 128x128x3 RGB image
- **Input Layer 2**: 63 MediaPipe landmarks (21 hand landmarks × 3 coordinates)
- **CNN Layers**: 3 convolutional layers for image processing
- **Dense Layers**: Fully connected layers for landmark processing
- **Concatenation**: Combined image and landmark features
- **Output**: 106 classes with softmax activation

### Supported Signs
The model recognizes 106 different signs including:
- **Alphabet**: A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z
- **Numbers**: 1, 3, 4, 5, 6, 7, 8, 9
- **Common Words**: accept, age, bag, book, help, home, idea, namastey, school, technology, etc.

## 🎯 API Endpoints

### Room Management
- `POST /api/rooms` - Create a new room
- `GET /api/rooms/{room_id}` - Get room details
- `POST /api/rooms/{room_id}/join` - Join a room

### Sign Language Recognition
- `POST /api/predict` - Predict sign from image data
- `GET /api/rooms/{room_id}/captions` - Get room captions

### WebSocket Events
- `join_room` - Join a Socket.IO room
- `webrtc_offer/answer/ice_candidate` - WebRTC signaling
- `send_message` - Send chat messages
- `new_caption` - Broadcast new captions

## 🛠️ Troubleshooting

### Common Issues

1. **Camera/Microphone Access Denied**
   - Grant camera/microphone permissions in browser
   - The app works in chat-only mode without media access

2. **WebRTC Connection Failed**
   - Ensure both users are on the same network or using ngrok
   - Check firewall settings for WebRTC ports

3. **Sign Language Recognition Not Working**
   - Verify camera is working and has good lighting
   - Check that TensorFlow model loaded successfully in backend logs

---

**voice-era** - Bridging communication gaps through technology 🤟
