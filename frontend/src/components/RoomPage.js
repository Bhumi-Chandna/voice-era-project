import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import axios from 'axios';
import VideoCall from './VideoCall';
import Chat from './Chat';
import Captions from './Captions';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RoomPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  
  // State
  const [room, setRoom] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [peers, setPeers] = useState({});
  const [socket, setSocket] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [messages, setMessages] = useState([]);
  const [captions, setCaptions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Refs
  const localVideoRef = useRef(null);
  const peersRef = useRef({});
  const socketRef = useRef(null);
  const participantRef = useRef(null);
  const captionIntervalRef = useRef(null);

  // Initialize room and participant
  useEffect(() => {
    const initializeRoom = async () => {
      try {
        const participantName = localStorage.getItem('participantName');
        if (!participantName) {
          navigate('/');
          return;
        }

        // Get room details
        const roomResponse = await axios.get(`${API}/rooms/${roomId}`);
        setRoom(roomResponse.data);

        // Join room
        const participantResponse = await axios.post(`${API}/rooms/${roomId}/join`, {
          name: participantName
        });
        
        const participantData = participantResponse.data;
        setParticipant(participantData);
        participantRef.current = participantData;

        // Initialize socket connection
        const newSocket = io(BACKEND_URL, {
          transports: ['websocket']
        });
        
        setSocket(newSocket);
        socketRef.current = newSocket;

        // Join socket room
        newSocket.emit('join_room', {
          room_id: roomId,
          participant_id: participantData.id
        });

        setLoading(false);
      } catch (err) {
        console.error('Error initializing room:', err);
        setError('Failed to join room');
        setLoading(false);
      }
    };

    initializeRoom();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (captionIntervalRef.current) {
        clearInterval(captionIntervalRef.current);
      }
    };
  }, [roomId, navigate]);

  // Initialize local media stream
  useEffect(() => {
    const getLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: true
        });
        
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Start sign language detection
        startSignLanguageDetection(stream);
      } catch (err) {
        console.error('Error accessing media devices:', err);
        // Don't set error - continue without media access
        console.log('Continuing without camera/microphone access');
        // Still allow user to participate via chat only
      }
    };

    if (!loading && participant) {
      getLocalStream();
    }
  }, [loading, participant]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);
    socket.on('webrtc_offer', handleWebRTCOffer);
    socket.on('webrtc_answer', handleWebRTCAnswer);
    socket.on('webrtc_ice_candidate', handleWebRTCIceCandidate);
    socket.on('new_message', handleNewMessage);
    socket.on('new_caption', handleNewCaption);

    return () => {
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('webrtc_offer');
      socket.off('webrtc_answer');
      socket.off('webrtc_ice_candidate');
      socket.off('new_message');
      socket.off('new_caption');
    };
  }, [socket, localStream]);

  // Socket event handlers
  const handleUserJoined = useCallback((data) => {
    const { sid, participant_id } = data;
    
    if (localStream) {
      // Create peer connection for new user
      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream: localStream
      });

      peer.on('signal', (signal) => {
        socket.emit('webrtc_offer', {
          target_sid: sid,
          offer: signal,
          room_id: roomId
        });
      });

      peer.on('stream', (remoteStream) => {
        setPeers(prev => ({
          ...prev,
          [sid]: { peer, stream: remoteStream, participantId: participant_id }
        }));
      });

      peersRef.current[sid] = peer;
    }
  }, [localStream, socket, roomId]);

  const handleUserLeft = useCallback((data) => {
    const { sid } = data;
    
    if (peersRef.current[sid]) {
      peersRef.current[sid].destroy();
      delete peersRef.current[sid];
    }
    
    setPeers(prev => {
      const newPeers = { ...prev };
      delete newPeers[sid];
      return newPeers;
    });
  }, []);

  const handleWebRTCOffer = useCallback((data) => {
    const { offer, from_sid } = data;
    
    if (localStream) {
      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: localStream
      });

      peer.on('signal', (signal) => {
        socket.emit('webrtc_answer', {
          target_sid: from_sid,
          answer: signal
        });
      });

      peer.on('stream', (remoteStream) => {
        setPeers(prev => ({
          ...prev,
          [from_sid]: { peer, stream: remoteStream }
        }));
      });

      peer.signal(offer);
      peersRef.current[from_sid] = peer;
    }
  }, [localStream, socket]);

  const handleWebRTCAnswer = useCallback((data) => {
    const { answer, from_sid } = data;
    
    if (peersRef.current[from_sid]) {
      peersRef.current[from_sid].signal(answer);
    }
  }, []);

  const handleWebRTCIceCandidate = useCallback((data) => {
    const { candidate, from_sid } = data;
    
    if (peersRef.current[from_sid]) {
      peersRef.current[from_sid].signal(candidate);
    }
  }, []);

  const handleNewMessage = useCallback((data) => {
    setMessages(prev => [...prev, data]);
  }, []);

  const handleNewCaption = useCallback((data) => {
    setCaptions(prev => [data, ...prev.slice(0, 49)]); // Keep last 50 captions
  }, []);

  // Sign language detection
  const startSignLanguageDetection = (stream) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const video = document.createElement('video');
    
    video.srcObject = stream;
    video.play();
    
    video.onloadedmetadata = () => {
      canvas.width = 128;
      canvas.height = 128;
      
      // Capture and analyze frames every 2 seconds
      captionIntervalRef.current = setInterval(() => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          canvas.toBlob(async (blob) => {
            if (blob && participantRef.current) {
              const base64 = await blobToBase64(blob);
              
              try {
                await axios.post(`${API}/predict`, {
                  image_data: base64,
                  room_id: roomId,
                  participant_id: participantRef.current.id
                });
              } catch (err) {
                console.error('Error predicting sign:', err);
              }
            }
          }, 'image/jpeg', 0.8);
        }
      }, 2000);
    };
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  };

  // Control functions
  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const sendMessage = (message) => {
    if (socket && participant) {
      socket.emit('send_message', {
        room_id: roomId,
        message,
        participant_name: participant.name
      });
    }
  };

  const leaveRoom = () => {
    if (socket) {
      socket.emit('leave_room', { room_id: roomId });
    }
    navigate('/');
  };

  if (loading) {
    return (
      <div className="room-container">
        <div className="loading">Loading room...</div>
      </div>
    );
  }

  if (error && error.includes('join room')) {
    return (
      <div className="room-container">
        <div className="error">{error}</div>
        <button onClick={() => navigate('/')} className="btn-primary" style={{margin: '1rem auto', display: 'block', maxWidth: '200px'}}>
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="room-container">
      <div className="room-header">
        <div>
          <span className="room-title">{room?.name || 'Room'}</span>
          <span className="room-id">ID: {roomId}</span>
        </div>
        <button onClick={leaveRoom} className="btn-secondary">
          Leave Room
        </button>
      </div>

      <div className="room-main">
        <div className="video-area">
          <VideoCall
            localStream={localStream}
            localVideoRef={localVideoRef}
            peers={peers}
            participant={participant}
          />
          
          <div className="controls-bar">
            <button
              onClick={toggleAudio}
              className={`control-btn ${isAudioMuted ? 'mute' : 'unmute'}`}
              title={isAudioMuted ? 'Unmute' : 'Mute'}
            >
              {isAudioMuted ? '🔇' : '🎤'}
            </button>
            
            <button
              onClick={toggleVideo}
              className={`control-btn ${isVideoOff ? 'video-off' : 'video-on'}`}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? '📹' : '📷'}
            </button>
            
            <button
              onClick={leaveRoom}
              className="control-btn secondary"
              title="Leave room"
            >
              📞
            </button>
          </div>
        </div>

        <div className="sidebar">
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              Chat
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'captions' ? 'active' : ''}`}
              onClick={() => setActiveTab('captions')}
            >
              Captions
            </button>
          </div>
          
          <div className="sidebar-content">
            {activeTab === 'chat' && (
              <Chat messages={messages} onSendMessage={sendMessage} />
            )}
            {activeTab === 'captions' && (
              <Captions captions={captions} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomPage;