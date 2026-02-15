import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const HomePage = () => {
  const [roomName, setRoomName] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const createRoom = async () => {
    if (!roomName.trim() || !participantName.trim()) {
      setError('Please enter both room name and your name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create room
      const roomResponse = await axios.post(`${API}/rooms`, {
        name: roomName,
        max_participants: 6
      });

      const room = roomResponse.data;
      
      // Store participant name in localStorage
      localStorage.setItem('participantName', participantName);
      
      // Navigate to room
      navigate(`/room/${room.id}`);
    } catch (err) {
      console.error('Error creating room:', err);
      setError('Failed to create room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!joinRoomId.trim() || !participantName.trim()) {
      setError('Please enter both room ID and your name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check if room exists
      await axios.get(`${API}/rooms/${joinRoomId}`);
      
      // Store participant name in localStorage
      localStorage.setItem('participantName', participantName);
      
      // Navigate to room
      navigate(`/room/${joinRoomId}`);
    } catch (err) {
      console.error('Error joining room:', err);
      if (err.response?.status === 404) {
        setError('Room not found. Please check the room ID.');
      } else {
        setError('Failed to join room. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-container">
      <div className="home-card">
        <div className="logo">SignMeet</div>
        <p className="subtitle">
          Connect with sign language recognition powered video calls
        </p>
        
        {error && <div className="error">{error}</div>}

        <div className="form-group">
          <label className="form-label">Your Name</label>
          <input
            type="text"
            value={participantName}
            onChange={(e) => setParticipantName(e.target.value)}
            placeholder="Enter your name"
            className="form-input"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Room Name</label>
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Enter room name"
            className="form-input"
            disabled={loading}
          />
        </div>

        <button 
          onClick={createRoom}
          className="btn-primary"
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create Room'}
        </button>

        <div className="divider">
          <span>or</span>
        </div>

        <div className="form-group">
          <label className="form-label">Room ID</label>
          <input
            type="text"
            value={joinRoomId}
            onChange={(e) => setJoinRoomId(e.target.value)}
            placeholder="Enter room ID to join"
            className="form-input"
            disabled={loading}
          />
        </div>

        <button 
          onClick={joinRoom}
          className="btn-secondary"
          disabled={loading}
        >
          {loading ? 'Joining...' : 'Join Room'}
        </button>

        <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#666', textAlign: 'center' }}>
          <p>✨ Features:</p>
          <p>• Real-time sign language recognition</p>
          <p>• Multi-participant video calls</p>
          <p>• Live captions & chat</p>
          <p>• ISL & universal gestures support</p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;