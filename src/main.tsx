import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import './edit-task.css';
import './task-manager-v2.css';
import './executive-dashboard.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

import './plan-library.css';
