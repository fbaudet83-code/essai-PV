import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { startVersionPolling } from './services/versionService';

// Auto-refresh when a new deployment is detected (Netlify + Vite hashed assets)
startVersionPolling({ intervalMs: 60_000 });


const container = document.getElementById('root');
if (!container) {
  throw new Error("Element root non trouvé");
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);