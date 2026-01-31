// kanban-gui-test/src/components/Board.js

import React, { useState, useCallback, useRef, useEffect } from 'react';
// Lane is still imported, but its content is rendered inline for flexibility to manage layout
import Lane from './Lane';
import Card from './Card';
import FlyingCardAnimation from './FlyingCardAnimation';

//const API_BASE_URL = 'http://127.0.0.1:8000'; // Your FastAPI backend URL
// IMPORTANT: Change this to the Ngrok URL copied from your Ngrok terminal in 'cd /opt/homebrew/bin/' --> ./ngrok http 8000
//const API_BASE_URL = 'https://f1dcfea1a82a.ngrok-free.app'; // <<< REPLACE WITH YOUR NGROK URL <<<
const API_BASE_URL = 'https://kanbanflow-web.onrender.com';

const Board = () => {
  const [lanes, setLanes] = useState([]);
  const [dashboardData, setDashboardData] = useState([]);

  // Default complexity for "Schritt A/B/C" columns (IDs 1, 3, 5)
  const [complexity, setComplexity] = useState({ 1: 1, 3: 1, 5: 1 });
  const [wipLimit, setWipLimit] = useState(5);
  const [simSpeed, setSimSpeed] = useState(1.0);

  const [simulationRunning, setSimulationRunning] = useState(false);

  const flyingAnimations = useRef([]); // Manages active gliding animations
  const cardRefs = useRef(new Map()); // Stores DOM refs for cards
  const laneRefs = useRef(new Map()); // Stores DOM refs for lanes

  const [isReady, setIsReady] = useState(false); // UI readiness flag
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsReady(true);
      console.log('Board component and initial refs are likely ready.');
    }, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  // Helper to get a card by its ID from current React lanes state
  const getCardById = useCallback((cardId) => {
    for (const lane of lanes) {
      const card = lane.cards.find(c => c.id === cardId);
      if (card) return card;
    }
    return null;
  }, [lanes]);

  // Triggers the gliding animation for a specific card
  const programmaticMoveCard = useCallback((cardId, targetLaneId) => {
    const cardElement = cardRefs.current.get(cardId);
    const targetLaneElement = laneRefs.current.get(targetLaneId);

    if (!cardElement || !targetLaneElement) {
      console.warn(`[Gliding Trace] Could not find element for card ${cardId} or lane ${targetLaneId}. Cannot animate.`);
      return;
    }

    const startRect = cardElement.getBoundingClientRect();
    const currentCardData = getCardById(cardId);

    if (!currentCardData) {
        console.warn(`[Gliding Trace] Card ${cardId} not found in current state for animation.`);
        return;
    }

    console.log(`[Gliding Trace] Initiating animation for ${cardId}. Current flyingAnimations count: ${flyingAnimations.current.length}.`);

    // Add animation data immediately
    flyingAnimations.current.push({
        id: `flying-${cardId}-${Date.now()}`, // Unique ID for this animation instance
        card: currentCardData,
        startRect: startRect,
        endRect: null // Will be updated via rAF
    });
    // Force React to re-render to pick up new items in flyingAnimations.current
    flyingAnimations.current = [...flyingAnimations.current]; 
    console.log(`[Gliding Trace] Added ${cardId}. New flyingAnimations count: ${flyingAnimations.current.length}. Array: `, flyingAnimations.current.map(a => a.card.id));


    // Schedule getting endRect after React re-renders the actual card
    requestAnimationFrame(() => {
        flyingAnimations.current = flyingAnimations.current.map(anim => {
            // Only process animations that have a startRect but no endRect yet AND match this card's ID
            if (anim.card.id === cardId && anim.startRect && anim.endRect === null) {
                const newCardInDOM = cardRefs.current.get(anim.card.id);
                if (newCardInDOM) {
                    const endRect = newCardInDOM.getBoundingClientRect();
                    return { ...anim, endRect: endRect };
                } else {
                    console.warn(`[Gliding-Fix] Card ${anim.card.id} not found in new DOM position for endRect. Cancelling animation clone.`);
                    return null; // Mark for removal
                }
            }
            return anim; // Return other animations as is
        }).filter(Boolean); // Remove any null entries (cancelled animations)
        flyingAnimations.current = [...flyingAnimations.current]; // Force re-render after updating endRects
        console.log(`[Gliding Trace] After rAF update. Current flyingAnimations count: ${flyingAnimations.current.length}. Array: `, flyingAnimations.current.map(a => a.card.id));
    });

  }, [getCardById]);

  // Callback from FlyingCardAnimation when an animation finishes
  const handleAnimationEnd = useCallback((animatedCardId) => {
    console.log(`[Gliding Trace] Animation ended for card: ${animatedCardId}. Clearing animation entry.`);
    const initialCount = flyingAnimations.current.length;
    flyingAnimations.current = flyingAnimations.current.filter(anim => anim.card.id !== animatedCardId);
    flyingAnimations.current = [...flyingAnimations.current];
    console.log(`[Gliding Trace] After filter for ${animatedCardId}. Count changed from ${initialCount} to ${flyingAnimations.current.length}. Array: `, flyingAnimations.current.map(a => a.card.id));
  }, []);

  // --- API Call Functions ---
  // Sets simulation parameters on the backend
  const setConfig = useCallback(async () => {
    console.log("setConfig: Attempting to set simulation config...");
    try {
      const response = await fetch(`${API_BASE_URL}/simulation/config`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ complexity, wip_limit: wipLimit, speed: simSpeed }),
      });
      console.log("setConfig: Fetch request sent and response received.");
      const data = await response.json();
      if (response.ok) {
        console.log('setConfig: Config set successfully:', data);
        return true; // Indicate success
      } else {
        console.error('setConfig: Failed to set config (server responded with error):', data);
        return false; // Indicate failure
      }
    } catch (error) {
      console.error('setConfig: Network error or problem sending request:', error);
      return false; // Indicate failure
    }
  }, [complexity, wipLimit, simSpeed]);

  // Starts the simulation
  const startSimulation = useCallback(async () => {
    console.log("startSimulation: Attempting to start simulation...");
    try {
      // Await setConfig and check its return value for success
      const configSetSuccess = await setConfig();
      if (!configSetSuccess) {
        console.warn("startSimulation: Configuration failed. Aborting simulation start.");
        setSimulationRunning(false); // Ensure UI button state is correct
        return; // Exit if config failed
      }
      console.log("startSimulation: setConfig call finished and successful.");

      // Now attempt to start the simulation itself
      const response = await fetch(`${API_BASE_URL}/simulation/start`, {
        method: 'POST',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await response.json();
      if (response.ok) {
        console.log('startSimulation: Simulation started successfully:', data);
        setSimulationRunning(true); // Update state to running
      } else {
        console.error('startSimulation: Failed to start simulation (server responded with error):', data);
        // If the backend says it's already running, sync frontend state.
        if (data.detail && data.detail === 'Simulation is already running.') {
            console.log("startSimulation: Backend reported simulation already running. Syncing frontend state.");
            setSimulationRunning(true); // Sync frontend state (button becomes disabled)
        } else {
            // General error
            setSimulationRunning(false); // Ensure UI button state is correct
        }
      }
    } catch (error) {
      console.error('startSimulation: Network error starting simulation or error from setConfig:', error);
      setSimulationRunning(false); // Assume failure, ensure UI button state is correct
    }
  }, [setConfig]); // Dependency: setConfig must be robust

  // Stops the simulation
  const stopSimulation = useCallback(async () => {
    console.log("Stopping simulation...");
    try {
      const response = await fetch(`${API_BASE_URL}/simulation/stop`, {
        method: 'POST',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await response.json();
      if (response.ok) {
        console.log('Simulation stopped:', data);
        setSimulationRunning(false);
      } else {
        console.error('Failed to stop simulation:', data);
      }
    } catch (error) {
      console.error('Network error stopping simulation:', error);
    }
  }, []);

  // Clears dashboard data
  const clearDashboard = useCallback(async () => {
    console.log("Clearing dashboard...");
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/clear`, {
        method: 'POST',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await response.json();
      if (response.ok) {
        console.log('Dashboard cleared:', data);
        setDashboardData([]); // Clear frontend dashboard data instantly
      } else {
        console.error('Failed to clear dashboard:', data);
      }
    } catch (error) {
      console.error('Network error clearing dashboard:', error);
    }
  }, []);

  // --- Polling for Board State and Dashboard Data ---
  // Fetches simulation data periodically from backend
  useEffect(() => {
    let intervalId;
    const pollingInterval = 1000; // Poll every 1 second

    const fetchSimulationData = async () => {
      // Fetch board state
      try {
        const boardResponse = await fetch(`${API_BASE_URL}/simulation/status`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
          
        const boardData = await boardResponse.json();
        if (boardResponse.ok) {
          setSimulationRunning(boardData.is_running); // Sync running status from backend

          setLanes(prevLanes => {
            const newLanes = boardData.lanes;
            if (!prevLanes.length) return newLanes; // First load, no animation needed, just set initial state

            const cardsToAnimateData = []; // Store data for cards that need gliding

            // Step 1: Create a quick lookup map for cards in the *previous* state
            const oldCardsMap = new Map();
            prevLanes.forEach(lane => {
                lane.cards.forEach(card => {
                    oldCardsMap.set(card.id, card);
                });
            });

            // Step 2: Iterate through cards in the *new* state to detect moves
            for (const newLane of newLanes) {
                for (const newCard of newLane.cards) {
                    const oldCard = oldCardsMap.get(newCard.id);

                    // Condition for triggering a glide animation:
                    // 1. The card existed in the previous state.
                    // 2. Its current lane (newCard.col) is different from its previous lane (oldCard.col).
                    if (oldCard && oldCard.col !== newCard.col) {
                        const cardElement = cardRefs.current.get(oldCard.id); // Try to get the DOM element of the OLD card

                        // Only attempt to animate if the old card's DOM element is *still present*
                        // at its previous location when we poll.
                        if (cardElement) {
                            cardsToAnimateData.push({
                                card: oldCard, // Pass the OLD card data to the animation clone
                                newLaneId: newCard.col, // The new column ID is the target lane ID
                                startRect: cardElement.getBoundingClientRect() // Capture START position from the OLD element
                            });
                        } else {
                            console.warn(`[Gliding-Fix] Old element for card ${oldCard.id} (from lane ${oldCard.col} to ${newCard.col}) not found for animation. Skipping glide.`);
                        }
                    }
                }
            }

            // Immediately push animation data to the ref, then force re-render
            // This ensures FlyingCardAnimation components are mounted quickly when original hides.
            cardsToAnimateData.forEach(animData => {
                flyingAnimations.current.push({
                    id: `flying-${animData.card.id}-${Date.now()}`, // Unique ID for this animation instance
                    card: animData.card,
                    startRect: animData.startRect,
                    endRect: null // Will be updated by requestAnimationFrame
                });
            });
            flyingAnimations.current = [...flyingAnimations.current]; // Force re-render

            // Schedule endRect calculation after React updates DOM for newLanes
            requestAnimationFrame(() => {
                flyingAnimations.current = flyingAnimations.current.map(anim => {
                    // Only process animations that have a startRect but no endRect yet
                    if (anim.startRect && anim.endRect === null) {
                        const newCardInDOM = cardRefs.current.get(anim.card.id);
                        if (newCardInDOM) {
                            const endRect = newCardInDOM.getBoundingClientRect();
                            return { ...anim, endRect: endRect };
                        } else {
                            console.warn(`[Gliding-Fix] Card ${anim.card.id} not found in new DOM position for endRect. Cancelling animation clone.`);
                            return null;
                        }
                    }
                    return anim; // Return already completed animations as is
                }).filter(Boolean); // Remove any null entries (cancelled animations)
                flyingAnimations.current = [...flyingAnimations.current]; // Force re-render after updating endRects
            });

            return newLanes; // This updates the React `lanes` state with the new board data
          });

        } else {
          console.error('Failed to fetch board state:', boardData);
          setSimulationRunning(false);
        }
      } catch (error) {
        console.error('Network error fetching board state:', error);
        setSimulationRunning(false);
      }

      // Fetch dashboard data
      try {
        const dashboardResponse = await fetch(`${API_BASE_URL}/dashboard/data`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        const dashboardData = await dashboardResponse.json();
        if (dashboardResponse.ok) {
          setDashboardData(dashboardData.dashboard_entries || []);
        } else {
          console.error('Failed to fetch dashboard data:', dashboardData);
        }
      } catch (error) {
        console.error('Network error fetching dashboard data:', error);
      }
    };

    fetchSimulationData(); // Initial fetch on mount
    intervalId = setInterval(fetchSimulationData, pollingInterval); // Set up polling interval
    return () => {
      clearInterval(intervalId); // Clear interval on component unmount
      console.log('Polling interval cleared.');
    };
  }, [programmaticMoveCard]); // Re-run effect if programmaticMoveCard callback changes (unlikely)

  // Handler for individual complexity input changes
  const handleComplexityChange = useCallback((colId, value) => {
    setComplexity(prev => ({
      ...prev,
      [colId]: parseInt(value) || 0 // Ensure it's an integer
    }));
  }, []);

return (
    // Overall layout: flex column, centered, with padding
    <div className="flex flex-col p-2 bg-gray-50 min-h-screen items-center">
      {/* Simulation Controls */}
      <div className="p-3 bg-white rounded-lg shadow-md w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <h3 className="text-xl font-bold text-gray-800 flex-shrink-0">
          Verbessere die Durchlaufzeit der roten Karte durch WiP Limits!
        </h3>
      
        {/* Global Parameters */}
        <div className="flex items-center gap-6 flex-grow justify-center">
            <div className="flex items-center gap-2">
              <label className="text-gray-700 text-[10px] font-bold mb-0 leading-none">Gesamt WIP Limit:</label>
              <input
                type="number"
                value={wipLimit}
                onChange={(e) => setWipLimit(parseInt(e.target.value) || 0)}
                className="shadow appearance-none border rounded w-12 py-0.5 px-1 text-gray-700 leading-tight focus:outline-none focus:shadow-outline text-xs text-center"
                min="0"
              />
            </div>

            {/* Sim. Geschw. auskommentiert für mehr Platz
            <div>
              <label className="block text-gray-700 text-xs font-bold mb-0">Sim. Geschw. (s/Schritt):</label>
              <input
                type="number"
                step="0.1"
                value={simSpeed}
                className="shadow appearance-none border rounded w-20 py-0.5 px-1 text-gray-700 leading-tight focus:outline-none focus:shadow-outline text-xs"
                min="0.1"
              />
            </div>
            */}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-2 flex-shrink-0">
          <button
            onClick={startSimulation}
            disabled={!isReady || simulationRunning}
            className={`!w-16 py-1.5 rounded-lg text-white font-bold text-sm transition-colors duration-200 ${
              !isReady || simulationRunning ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-700'
            }`}
          >
            Start
          </button>

           <button
            onClick={clearDashboard}
            disabled={!isReady}
            className={`!w-16 py-1.5 rounded-lg text-white font-bold text-sm transition-colors duration-200 ${
              !isReady ? 'bg-gray-400 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-700'
            }`}
          >
            Löschen
          </button> 
        </div>
      </div>

      {/* Kanban Board Display */}
      <div className="flex p-2 overflow-x-auto items-start bg-gray-100 rounded-lg shadow-inner w-full max-w-5xl mt-2">
        {lanes.length === 0 ? (
          <p className="text-center text-gray-500 w-full p-10">
            Keine Board-Daten verfügbar. Simulation starten.
          </p>
        ) : (
          lanes.map((lane) => (
            <div
              key={lane.id}
              ref={el => {
                if (el) laneRefs.current.set(lane.id, el);
                else laneRefs.current.delete(lane.id);
              }}
              className="flex-shrink-0 mr-1 bg-gray-200 rounded-lg shadow-inner flex flex-col items-center"
              style={{ width: '122px', minHeight: '500px' }}
            >
              {/* Column Header Section */}
              <div className="p-1.5 bg-gray-300 rounded-t-lg text-center w-full border-b border-gray-400" style={{ minHeight: '70px' }}>
                <h2 className="text-sm font-semibold text-gray-800 pb-0.5">
                  {lane.title}
                </h2>
                {lane.max_wip_in_round !== undefined && (
                    <span className="text-xs text-gray-600 block">Max WIP: {lane.max_wip_in_round}</span>
                )}
                {(lane.id === 'lane-1' || lane.id === 'lane-3' || lane.id === 'lane-5') && (
                    <div className="mt-1 flex items-center justify-center gap-1">
                        <label className="text-gray-700 text-xs font-bold">K'xität:</label>
                        <input
                            type="number"
                            value={complexity[parseInt(lane.id.split('-')[1])] || 1}
                            onChange={(e) => handleComplexityChange(parseInt(lane.id.split('-')[1]), e.target.value)}
                            className="shadow appearance-none border rounded w-10 py-0 px-0.5 text-gray-700 leading-tight focus:outline-none focus:shadow-outline text-xs text-center"
                            min="1"
                        />
                    </div>
                )}
              </div>

              {/* Card Area */}
              <div className="flex flex-col items-center w-full mt-1 overflow-y-auto" style={{ maxHeight: 'calc(100% - 70px)' }}>
                {lane.cards.map((card, index) => {
                  const isFlyingClone = flyingAnimations.current.some(anim => anim.card.id === card.id);
                  return (
                    <Card
                      key={card.id}
                      id={card.id}
                      text={card.birth_id ? `Karte ${card.birth_id}` : card.id}
                      laneId={card.col}
                      index={index}
                      ref={el => {
                        if (el) cardRefs.current.set(card.id, el);
                        else cardRefs.current.delete(card.id);
                      }}
                      style={{
                        visibility: isFlyingClone ? 'hidden' : 'visible',
                        backgroundColor: card.is_red ? '#ca0633' : '#ffffff',
                        width: '90px',
                        height: '30px',
                        padding: '4px 6px',
                        fontSize: '0.75rem',
                        textAlign: 'center',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: '4px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dashboard Table */}
      <div className="p-2 bg-white rounded-lg shadow-md w-full max-w-5xl text-sm mt-4">
        <h3 className="text-xl font-bold text-gray-800 mb-2 border-b pb-1">Dashboard</h3>
        {dashboardData.length === 0 ? (
          <p className="text-gray-500 text-xs p-1">Dashboard ist leer. Simulation starten.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Runde</th>
                  <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">WiP Limit</th>
                  <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durchlaufzeit (Rot)</th>
                  <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Flusseff.</th>
                  <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">in Arbeit</th>
                  <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Erledigt</th>
                  <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durchsatz</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dashboardData.slice().reverse().map((entry, index) => (
                  <tr key={index}>
                    <td className="px-1 py-1 whitespace-nowrap text-xs text-gray-900">{entry.round}</td>
                    <td className="px-1 py-1 whitespace-nowrap text-xs text-gray-900">{entry.wip_limit}</td>
                    <td className="px-1 py-1 whitespace-nowrap text-xs text-gray-900">{entry.red_card_cycle_time}</td>
                    <td className="px-1 py-1 whitespace-nowrap text-xs text-gray-900">{entry.flow_efficiency}</td>
                    <td className="px-1 py-1 whitespace-nowrap text-xs text-gray-900">{entry.in_progress}</td>
                    <td className="px-1 py-1 whitespace-nowrap text-xs text-gray-900">{entry.done}</td>
                    <td className="px-1 py-1 whitespace-nowrap text-xs text-gray-900">{entry.throughput}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Render flying animations */}
      {flyingAnimations.current.map(anim => anim.startRect && (
        <FlyingCardAnimation
          key={anim.id}
          card={anim.card}
          startRect={anim.startRect}
          endRect={anim.endRect}
          onAnimationEnd={handleAnimationEnd}
        />
      ))}
    </div>
  );
};
  
export default Board;

