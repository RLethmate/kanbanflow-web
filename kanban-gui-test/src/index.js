import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

function mountApp() {
  const container = document.getElementById('kanban-root') || document.getElementById('root');
  
  if (container) {
    const root = ReactDOM.createRoot(container);
    root.render(<App />);
    console.log("Kanban-App erfolgreich eingehängt!");
  } else {
    console.error("ID 'kanban-root' nicht gefunden. Suche läuft...");
    // Falls TYPO3 noch nicht fertig ist, probieren wir es in 500ms nochmal
    setTimeout(mountApp, 500);
  }
}

// Startversuch, sobald das Skript geladen ist
mountApp();