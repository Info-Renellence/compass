import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './edge.css';
import './compass.css';
import './motion.css';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
