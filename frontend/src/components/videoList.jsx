import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './VideoList.css';

const VideoList = () => {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [answer, setAnswer] = useState(null);
  const modalRef = useRef(null); // Ref for the modal

  const setupSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        setIsListening(false);
        handleVoiceQuery(text);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      window.recognition = recognition;
    }
  };

  const startListening = () => {
    if (window.recognition) {
      setIsListening(true);
      window.recognition.start();
    } else {
      alert('Speech recognition not supported in this browser');
    }
  };

  const fetchVideos = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/videos`);
      setVideos(response.data.data);
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
  };

  const handleVoiceQuery = async (question) => {
    if (!selectedVideo || !question) return;
  
    try {
      console.log("Sending request with videoId:", selectedVideo._id, "and question:", question);
      const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/qa`, {
        videoId: selectedVideo._id, // Send videoId instead of context
        question: question
      });
  
      console.log("Response from server:", response); // Add this line
      console.log("Response data:", response.data); // ADD THIS LINE
      setAnswer(response.data.data);
    } catch (error) {
      console.error('Error getting answer:', error);
      setAnswer(null); // Clear previous answer on error
      alert("Failed to get answer. Check console for details."); // Inform user
    }
  };

  const handleDeleteVideo = async () => {
    if (!selectedVideo) return;

    try {
      await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/videos/${selectedVideo._id}`);
      setVideos(videos.filter(video => video._id !== selectedVideo._id));
      closeModal(); // Close the modal after deleting
    } catch (error) {
      console.error('Error deleting video:', error);
    }
  };

  const closeModal = () => {
    setSelectedVideo(null);
    setTranscript('');
    setAnswer(null);
  };

  // Close modal when clicking outside
  const handleClickOutside = (event) => {
    if (modalRef.current && !modalRef.current.contains(event.target)) {
      closeModal();
    }
  };

  useEffect(() => {
    fetchVideos();
    setupSpeechRecognition();
    document.addEventListener('mousedown', handleClickOutside); // Add listener

    return () => {
      document.removeEventListener('mousedown', handleClickOutside); // Clean up
    };
  }, []);

  return (
    <div className="video-container">
      <div className="video-grid">
        {videos.map((video) => (
          <div 
            key={video._id}
            className="video-card"
            onClick={() => setSelectedVideo(video)}
          >
            <div className="video-thumbnail">
              <video src={video.videoUrl} />
              <div className="video-duration">{video.duration || '0:00'}</div>
            </div>
            <div className="video-info">
              <h3>{video.title || 'Untitled Video'}</h3>
              <p className="video-transcript">{video.transcript?.substring(0, 100)}...</p>
              <span className="video-date">
                {new Date(video.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {selectedVideo && (
        <div className="modal">
          <div className="modal-content" ref={modalRef}> {/* Add ref here */}
            <video 
              src={selectedVideo.videoUrl}
              controls
              autoPlay
            />
            <div className="modal-info">
              <h2>{selectedVideo.title || 'Untitled Video'}</h2>
              <p>{selectedVideo.transcript}</p>
              
              <div className="query-section">
                <button
                  onClick={startListening}
                  className={`voice-btn ${isListening ? 'listening' : ''}`}
                >
                  {isListening ? 'Listening...' : 'Ask a Question'}
                </button>

                {transcript && (
                  <div className="query-box">
                    <p className="query-label">Your Question:</p>
                    <p>{transcript}</p>
                  </div>
                )}

                {answer && (
                  <div className="answer-box">
                    <p className="answer-label">Answer:</p>
                    <p>{answer.answer}</p>
                    <p className="confidence">
                      Confidence: {answer.score}%
                    </p>
                  </div>
                )}
              </div>
              <button onClick={handleDeleteVideo} className="delete-btn">
                Delete Video
              </button>
              <button onClick={closeModal} className="close-btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoList;