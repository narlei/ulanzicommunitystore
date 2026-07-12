import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/main.css';

if (navigator.platform.startsWith('Mac')) {
  document.body.classList.add('is-mac');
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
