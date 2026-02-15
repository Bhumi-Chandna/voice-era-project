import asyncio
import os
import logging
import uuid
import base64
import numpy as np
import cv2
import mediapipe as mp
import tensorflow as tf
import joblib
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import socketio

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize MediaPipe
mp_hands = mp.solutions.hands
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils

# Load ML model and labels
model = None
labels = None

def load_ml_model():
    global model, labels
    try:
        model_path = ROOT_DIR / 'sign_model.h5'
        labels_path = ROOT_DIR / 'labels.joblib'
        
        model = tf.keras.models.load_model(str(model_path))
        labels = joblib.load(str(labels_path))
        logger.info(f"Model loaded successfully. Classes: {len(labels)}")
        return True
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        return False

# Load model on startup
load_ml_model()

# Pydantic Models
class Room(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    participants: List[str] = Field(default_factory=list)
    max_participants: int = 6

class RoomCreate(BaseModel):
    name: str
    max_participants: Optional[int] = 6

class Participant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    room_id: str
    joined_at: datetime = Field(default_factory=datetime.utcnow)

class ParticipantCreate(BaseModel):
    name: str

class PredictionRequest(BaseModel):
    image_data: str  # base64 encoded image
    room_id: str
    participant_id: str

class Caption(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    participant_name: str
    room_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    confidence: float

# FastAPI app
app = FastAPI(title="SignMeet API", description="Sign Language Video Calling Platform")
api_router = APIRouter(prefix="/api")

# Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True
)

# Create Socket.IO ASGI app
socket_app = socketio.ASGIApp(sio, app)

# ML Processing Functions
def extract_landmarks(image):
    """Extract MediaPipe landmarks from image"""
    try:
        # Convert image to RGB
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        landmarks_array = np.zeros(63)  # 21*3 = 63 for hand landmarks
        
        # Process hands
        with mp_hands.Hands(
            static_image_mode=True,
            max_num_hands=1,
            min_detection_confidence=0.5
        ) as hands:
            results = hands.process(rgb_image)
            
            if results.multi_hand_landmarks:
                hand_landmarks = results.multi_hand_landmarks[0]
                for i, landmark in enumerate(hand_landmarks.landmark):
                    if i < 21:  # Only use first 21 landmarks
                        landmarks_array[i*3] = landmark.x
                        landmarks_array[i*3+1] = landmark.y
                        landmarks_array[i*3+2] = landmark.z
        
        return landmarks_array
    except Exception as e:
        logger.error(f"Error extracting landmarks: {e}")
        return np.zeros(63)

def predict_sign(image_data: str):
    """Predict sign language from base64 image"""
    try:
        if model is None or labels is None:
            return None, 0.0
        
        # Decode base64 image
        image_bytes = base64.b64decode(image_data.split(',')[1])
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Resize image to model input size (128x128)
        image_resized = cv2.resize(image, (128, 128))
        image_normalized = image_resized.astype(np.float32) / 255.0
        image_batch = np.expand_dims(image_normalized, axis=0)
        
        # Extract landmarks
        landmarks = extract_landmarks(image)
        landmarks_batch = np.expand_dims(landmarks, axis=0)
        
        # Make prediction
        prediction = model.predict([image_batch, landmarks_batch], verbose=0)
        predicted_class = np.argmax(prediction[0])
        confidence = float(np.max(prediction[0]))
        
        predicted_label = labels[predicted_class]
        
        return predicted_label, confidence
        
    except Exception as e:
        logger.error(f"Error in prediction: {e}")
        return None, 0.0

# API Routes
@api_router.get("/")
async def root():
    return {"message": "SignMeet API is running!", "model_loaded": model is not None}

@api_router.post("/rooms", response_model=Room)
async def create_room(room_data: RoomCreate):
    """Create a new room"""
    room = Room(**room_data.dict())
    await db.rooms.insert_one(room.dict())
    return room

@api_router.get("/rooms/{room_id}", response_model=Room)
async def get_room(room_id: str):
    """Get room details"""
    room_data = await db.rooms.find_one({"id": room_id})
    if not room_data:
        raise HTTPException(status_code=404, detail="Room not found")
    return Room(**room_data)

@api_router.post("/rooms/{room_id}/join", response_model=Participant)
async def join_room(room_id: str, participant_data: ParticipantCreate):
    """Join a room"""
    # Check if room exists
    room_data = await db.rooms.find_one({"id": room_id})
    if not room_data:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = Room(**room_data)
    
    # Check room capacity
    if len(room.participants) >= room.max_participants:
        raise HTTPException(status_code=400, detail="Room is full")
    
    # Create participant
    participant = Participant(room_id=room_id, **participant_data.dict())
    
    # Add participant to room
    await db.rooms.update_one(
        {"id": room_id},
        {"$push": {"participants": participant.id}}
    )
    
    # Save participant
    await db.participants.insert_one(participant.dict())
    
    # Notify other participants
    await sio.emit('participant_joined', {
        'participant': participant.dict(),
        'room_id': room_id
    }, room=room_id)
    
    return participant

@api_router.post("/predict")
async def predict_sign_language(request: PredictionRequest):
    """Predict sign language from image"""
    try:
        predicted_text, confidence = predict_sign(request.image_data)
        
        if predicted_text and confidence > 0.7:  # Confidence threshold
            # Get participant info
            participant_data = await db.participants.find_one({"id": request.participant_id})
            if not participant_data:
                raise HTTPException(status_code=404, detail="Participant not found")
            
            participant = Participant(**participant_data)
            
            # Create caption
            caption = Caption(
                text=predicted_text,
                participant_name=participant.name,
                room_id=request.room_id,
                confidence=confidence
            )
            
            # Save caption
            await db.captions.insert_one(caption.dict())
            
            # Broadcast caption to room
            await sio.emit('new_caption', caption.dict(), room=request.room_id)
            
            return {"predicted_text": predicted_text, "confidence": confidence}
        
        return {"predicted_text": None, "confidence": confidence}
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail="Prediction failed")

@api_router.get("/rooms/{room_id}/captions")
async def get_room_captions(room_id: str):
    """Get recent captions for a room"""
    captions = await db.captions.find(
        {"room_id": room_id}
    ).sort("timestamp", -1).limit(50).to_list(50)
    
    return [Caption(**caption) for caption in captions]

# Socket.IO Events
@sio.event
async def connect(sid, environ):
    logger.info(f"Client {sid} connected")

@sio.event
async def disconnect(sid):
    logger.info(f"Client {sid} disconnected")

@sio.event
async def join_room(sid, data):
    """Join a Socket.IO room"""
    room_id = data.get('room_id')
    participant_id = data.get('participant_id')
    
    if room_id:
        await sio.enter_room(sid, room_id)
        await sio.emit('user_joined', {
            'sid': sid,
            'participant_id': participant_id
        }, room=room_id, skip_sid=sid)
        logger.info(f"Client {sid} joined room {room_id}")

@sio.event
async def leave_room(sid, data):
    """Leave a Socket.IO room"""
    room_id = data.get('room_id')
    if room_id:
        await sio.leave_room(sid, room_id)
        await sio.emit('user_left', {'sid': sid}, room=room_id, skip_sid=sid)
        logger.info(f"Client {sid} left room {room_id}")

@sio.event
async def webrtc_offer(sid, data):
    """Handle WebRTC offer"""
    room_id = data.get('room_id')
    target_sid = data.get('target_sid')
    offer = data.get('offer')
    
    await sio.emit('webrtc_offer', {
        'offer': offer,
        'from_sid': sid
    }, room=target_sid)

@sio.event
async def webrtc_answer(sid, data):
    """Handle WebRTC answer"""
    target_sid = data.get('target_sid')
    answer = data.get('answer')
    
    await sio.emit('webrtc_answer', {
        'answer': answer,
        'from_sid': sid
    }, room=target_sid)

@sio.event
async def webrtc_ice_candidate(sid, data):
    """Handle WebRTC ICE candidate"""
    target_sid = data.get('target_sid')
    candidate = data.get('candidate')
    
    await sio.emit('webrtc_ice_candidate', {
        'candidate': candidate,
        'from_sid': sid
    }, room=target_sid)

@sio.event
async def send_message(sid, data):
    """Handle chat messages"""
    room_id = data.get('room_id')
    message = data.get('message')
    participant_name = data.get('participant_name')
    
    await sio.emit('new_message', {
        'message': message,
        'participant_name': participant_name,
        'timestamp': datetime.utcnow().isoformat(),
        'from_sid': sid
    }, room=room_id)

# Include API router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Use the Socket.IO ASGI app as the main app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(socket_app, host="0.0.0.0", port=8001)

# Export the socket_app for production
application = socket_app