import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

//const root = ReactDOM.createRoot(document.getElementById('react-kanban-board-container'));
// Revert this line for local development (`npm start`)
// It should look for the default 'root' ID that Create React App provides in public/index.html
//const root = ReactDOM.createRoot(document.getElementById('root'));
// CRITICAL: For TYPO3 deployment, change this back to your TYPO3 embed ID
const root = ReactDOM.createRoot(document.getElementById('react-kanban-board-container'));


root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
