import React from 'react';

const Captions = ({ captions }) => {
  const formatConfidence = (confidence) => {
    return `${Math.round(confidence * 100)}%`;
  };

  const getConfidenceColor = (confidence) => {
    if (confidence > 0.8) return '#2ed573';
    if (confidence > 0.6) return '#ffa502';
    return '#ff4757';
  };

  return (
    <div className="captions-container">
      {captions.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: '2rem 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👋</div>
          <p>No captions yet.</p>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Start signing to see real-time captions appear here!
          </p>
        </div>
      ) : (
        captions.map((caption) => (
          <div key={caption.id} className="caption-item">
            <div className="caption-author">{caption.participant_name}</div>
            <div className="caption-text">{caption.text}</div>
            <div className="caption-confidence">
              <span style={{ color: getConfidenceColor(caption.confidence) }}>
                Confidence: {formatConfidence(caption.confidence)}
              </span>
              <span style={{ marginLeft: '1rem', color: '#999' }}>
                {new Date(caption.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default Captions;