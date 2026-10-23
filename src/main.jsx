import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './edge.css';
import './compass.css';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
