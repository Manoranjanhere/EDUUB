import React, { useState } from 'react';
import axios from 'axios';

const VideoUpload = () => {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleVideoChange = (event) => {
    setSelectedVideo(event.target.files[0]);
  };

  const handleVideoUpload = async () => {
    if (!selectedVideo) {
      alert('Please select a video first!');
      return;
    }

    const formData = new FormData();
    formData.append('video', selectedVideo);

    try {
      setIsUploading(true); 
      const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        },
      });

      setUploadUrl(response.data.url);
      alert('Video uploaded successfully!');
      setIsUploading(false); 
      setUploadProgress(0);  
      setSelectedVideo(null); 
    } catch (error) {
      console.error('Error uploading video:', error);
      alert('Video upload failed');
      setIsUploading(false); // Reset the state in case of error
    }
  };

  return (
    <div className="flex flex-col items-center mt-4">
      <h1 className="text-xl font-bold mb-4">Upload a Video to Cloudinary</h1>

      {/* Display input only if no video is being uploaded */}
      {!isUploading && (
        <input
          type="file"
          accept="video/*"
          onChange={handleVideoChange}
          className="mb-4"
        />
      )}

      {/* Display upload button if no video is being uploaded */}
      {!isUploading && selectedVideo && (
        <button
          onClick={handleVideoUpload}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Upload Video
        </button>
      )}

      {/* Progress Bar with animation */}
      {isUploading && (
        <div className="w-full max-w-lg mt-4">
          <div className="bg-gray-200 rounded-full h-4">
            <div
              className="bg-green-500 h-4 rounded-full"
              style={{
                width: `${uploadProgress}%`,
                transition: 'width 0.2s ease-in-out', 
              }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-1">{uploadProgress}%</p>
        </div>
      )}
    </div>
  );
};

export default VideoUpload;
