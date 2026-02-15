import React, { useEffect, useRef } from 'react';

const VideoCall = ({ localStream, localVideoRef, peers, participant }) => {
  const remoteVideoRefs = useRef({});

  // Update remote video streams
  useEffect(() => {
    Object.entries(peers).forEach(([sid, peerData]) => {
      if (remoteVideoRefs.current[sid] && peerData.stream) {
        remoteVideoRefs.current[sid].srcObject = peerData.stream;
      }
    });
  }, [peers]);

  // Clean up refs when peers disconnect
  useEffect(() => {
    const currentSids = Object.keys(peers);
    const refSids = Object.keys(remoteVideoRefs.current);

    refSids.forEach(sid => {
      if (!currentSids.includes(sid)) {
        delete remoteVideoRefs.current[sid];
      }
    });
  }, [peers]);

  return (
    <div className="video-grid">
      {/* Local video */}
      <div className="video-container">
        {localStream ? (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="video-element"
          />
        ) : (
          <div className="video-element" style={{ 
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '1.2rem',
            textAlign: 'center',
            padding: '1rem'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👤</div>
            <div>Camera not available</div>
            <div style={{ fontSize: '0.9rem', marginTop: '0.5rem', opacity: 0.8 }}>
              Chat-only mode
            </div>
          </div>
        )}
        <div className="video-overlay">
          <div className="participant-name">
            {participant?.name || 'You'} (You)
          </div>
          <div className="caption-overlay">
            {localStream ? 'Sign recognition active...' : 'Text chat available'}
          </div>
        </div>
      </div>

      {/* Remote videos */}
      {Object.entries(peers).map(([sid, peerData]) => (
        <div key={sid} className="video-container">
          <video
            ref={el => {
              if (el) {
                remoteVideoRefs.current[sid] = el;
                if (peerData.stream) {
                  el.srcObject = peerData.stream;
                }
              }
            }}
            autoPlay
            playsInline
            className="video-element"
          />
          <div className="video-overlay">
            <div className="participant-name">
              Participant {sid.slice(0, 8)}
            </div>
          </div>
        </div>
      ))}

      {/* Placeholder for empty slots */}
      {Array.from({ length: Math.max(0, 6 - Object.keys(peers).length - 1) }).map((_, index) => (
        <div key={`placeholder-${index}`} className="video-container">
          <div className="video-element" style={{ 
            background: 'linear-gradient(135deg, #2c3e50, #4a6741)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '1.2rem'
          }}>
            Waiting for participant...
          </div>
        </div>
      ))}
    </div>
  );
};

export default VideoCall;