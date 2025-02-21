import React from 'react';
import './App.css';
import VideoUpload from './components/videoUpload';
import VideoList from './components/videoList';

function App() {
  return (
    <div className="App">
      <VideoUpload />
      <VideoList />
    </div>
  );
}

export default App;
