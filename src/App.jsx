import { useState, useRef, useEffect } from 'react';
import './App.css';
import { detectDrowsiness } from './api';
import alarmSound from './sound.wav';

const SLEEPING_STATUS = 'SLEEPING !!!';
const DIZZY_STATUS = 'DIZZY';
const ACTIVE_STATUS = 'ACTIVE';

function App() {
  const [status, setStatus] = useState('');
  const [outputImg, setOutputImg] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [alertActive, setAlertActive] = useState(false);
  const [alertHistory, setAlertHistory] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const videoRef = useRef();
  const canvasRef = useRef();
  const intervalRef = useRef();
  const audioRef = useRef();
  const alertTimeoutRef = useRef();

  // Enable sound on user interaction
  const enableSound = () => {
    setSoundEnabled(true);
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }).catch(err => {
        console.error("Audio enable error:", err);
      });
    }
  };

  useEffect(() => {
    if (isStreaming) {
      startStreaming();
    } else {
      stopStreaming();
    }
    
    // Return cleanup function that only runs on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
    // eslint-disable-next-line
  }, [isStreaming]);

  useEffect(() => {
    // Add alert to history when status changes to SLEEPING or DIZZY
    if (status === SLEEPING_STATUS || status === DIZZY_STATUS) {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      const newAlert = {
        type: status === SLEEPING_STATUS ? 'sleeping' : 'drowsy',
        time: time,
        id: now.getTime()
      };
      
      setAlertHistory(prev => [newAlert, ...prev].slice(0, 10));
      
      if (soundEnabled) {
        // Play sound if status is SLEEPING or DIZZY
        if (!alertActive) {
          setAlertActive(true);
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(err => console.error("Audio play error:", err));
          }
          if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
          alertTimeoutRef.current = setTimeout(() => {
            setAlertActive(false);
          }, 100); // 2.5 seconds
        }
      }
    } else if (status === ACTIVE_STATUS) {
      setAlertActive(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    }
  }, [status, alertActive, soundEnabled]);

  const startStreaming = async () => {
    console.log("Starting camera...");
    setStatus('Starting camera...');
    setIsLoading(true);
    
    try {
      // Get new stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus('Streaming...');
        setIsLoading(false);
        intervalRef.current = setInterval(captureAndSendFrame, 100);
        enableSound();
        console.log("Camera started successfully");
      }
    } catch (err) {
      console.error("Camera error:", err);
      setStatus('Camera error: ' + err.message);
      setIsLoading(false);
    }
  };

  const stopStreaming = () => {
    console.log("Stopping camera...");
    
    // Clear the interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Stop all video tracks and clear video element
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => {
        console.log("Stopping track:", track.kind, track.readyState);
        track.stop();
      });
      videoRef.current.srcObject = null;
      videoRef.current.src = "";
      videoRef.current.load();
    }
    
    // Clear alert timeout
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
      alertTimeoutRef.current = null;
    }
    
    // Stop and reset audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    // Reset all state
    setSoundEnabled(false);
    setOutputImg(null);
    setAlertActive(false);
    setIsLoading(false);
    setStatus('');
    
    console.log("Camera stopped successfully");
  };

  const captureAndSendFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        setIsLoading(true);
        const result = await detectDrowsiness(new File([blob], 'frame.png', { type: 'image/png' }));
        setOutputImg('data:image/png;base64,' + result.image);
        setStatus(result.status);
      } catch (err) {
        setStatus('Error: ' + err.message);
      }
      setIsLoading(false);
    }, 'image/png');
  };

  return (
    <div className="App" style={{ display: 'flex', minHeight: '100vh',minWidth: '100vw', background: '#f0f0f0' }}>
      {/* Left */}
      <div style={{ width: '60px', background: 'white', padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '40px', height: '40px', background: '#7c5cfc', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: '20px' }}>🏠</div>
        <div style={{ width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#333', fontSize: '20px', margin: '20px 0' }}>📄</div>
        <div style={{ width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#333', fontSize: '20px' }}>⏱️</div>
      </div>
      
      {/* Center - Video feed */}
      <div style={{ flex: 1, background: '#24292e', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
          {!isStreaming ? (
            <div style={{ color: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: '60px', marginBottom: '10px' }}>📷</div>
              <div>Click Start Camera to begin monitoring</div>
            </div>
          ) : (
            <video ref={videoRef} autoPlay muted style={{ display: 'none', maxWidth: '100%', maxHeight: '100%' }} />
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {outputImg && isStreaming && (
            <img src={outputImg} alt="Processed" style={{ maxWidth: '100%', maxHeight: '100%' }} />
          )}
        </div>
        {isLoading && (
          <div style={{ position: 'absolute', bottom: '20px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '5px 15px', borderRadius: '15px' }}>
            <span>Processing...</span>
          </div>
        )}
      </div>
      
      {/* Right side panel */}
      <div style={{ width: '280px', background: 'white', padding: '20px' }}>
        {/* Status indicators */}
        <div>
          <div style={{ 
            background: status === DIZZY_STATUS ? '#FFC107' : '#f1f1f1',
            color: status === DIZZY_STATUS ? 'white' : '#555',
            padding: '12px',
            borderRadius: '30px',
            textAlign: 'center',
            fontWeight: 'bold',
            marginBottom: '15px'
          }}>
            Drowsy
          </div>
          
          <div style={{ 
            background: (status === DIZZY_STATUS || status === SLEEPING_STATUS) ? '#E53935' : '#f1f1f1',
            color: (status === DIZZY_STATUS || status === SLEEPING_STATUS) ? 'white' : '#555',
            padding: '12px',
            borderRadius: '30px',
            textAlign: 'center',
            fontWeight: 'bold',
            marginBottom: '15px'
          }}>
            Alert triggered
          </div>
          
          <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '20px 0' }} />
        </div>
        
        {/* Alert history */}
        <div style={{ margin: '20px 0', maxHeight: '300px', overflowY: 'auto' }}>
          {alertHistory.length > 0 ? alertHistory.map(alert => (
            <div key={alert.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>Drowsy alert</div>
              <div style={{ color: '#888' }}>{alert.time}</div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', color: '#888' }}>No alerts yet</div>
          )}
        </div>
        
        {/* Camera controls */}
        <div style={{ marginTop: '20px' }}>
          <button 
            onClick={() => setIsStreaming(!isStreaming)} 
            style={{ 
              background: isStreaming ? '#B9B4EA' : '#7c5cfc', 
              color: 'white', 
              border: 'none', 
              borderRadius: '30px', 
              padding: '12px', 
              width: '100%', 
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {isStreaming ? 'Stop camera' : 'Start camera'}
          </button>
        </div>
      </div>
      
      <audio 
        ref={audioRef} 
        src={alarmSound} 
        preload="auto" 
        loop 
      />
    </div>
  );
}

export default App;