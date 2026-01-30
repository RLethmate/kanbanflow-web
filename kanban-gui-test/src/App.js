// src/App.js
import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Board from './components/Board';
import './index.css'; // Make sure this imports index.css, not App.css

function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="App">
        <h1 className="text-4xl font-bold text-center my-8 text-gray-900">Kanban Board Simulation</h1>
        <Board />
      </div>
    </DndProvider>
  );
}

export default App;