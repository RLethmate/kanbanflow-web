// kanban-gui-test/src/components/FlyingCardAnimation.js

import React, { useEffect, useRef, useState } from 'react';

const FlyingCardAnimation = ({ card, startRect, endRect, onAnimationEnd }) => {
  const animatedRef = useRef(null);
  const animationInstanceRef = useRef(null);

  useEffect(() => {
    if (!animatedRef.current || !startRect || !endRect) {
        return;
    }

    if (animationInstanceRef.current) {
        return;
    }

    console.log(`[FlyingCardAnimation] Karte ${card.id}: Starting animation from (${startRect.left},${startRect.top}) to (${endRect.left},${endRect.top})`);

    const deltaX = endRect.left - startRect.left;
    const deltaY = endRect.top - startRect.top;

    const keyframes = [
      { transform: 'translate(0, 0)', opacity: 1 },
      { transform: `translate(${deltaX}px, ${deltaY}px)`, opacity: 1 },
    ];

    const options = {
      duration: 500,
      easing: 'ease-in-out',
      fill: 'forwards',
    };

    animationInstanceRef.current = animatedRef.current.animate(keyframes, options);

    animationInstanceRef.current.finished.then(() => {
      console.log(`[FlyingCardAnimation] Promise-based animation finished for Karte: ${card.id}`);
      onAnimationEnd(card.id);
    }).catch(error => {
      if (error.name === 'AbortError') {
        console.log(`[FlyingCardAnimation] Karte ${card.id}: Animation was cancelled.`);
      } else {
        console.error(`[FlyingCardAnimation] Karte ${card.id}: Animation error:`, error);
      }
    });

    const fallbackTimeout = setTimeout(() => {
        if (animationInstanceRef.current && animationInstanceRef.current.playState !== 'finished' && animationInstanceRef.current.playState !== 'idle') {
            console.warn(`[FlyingCardAnimation] Fallback: Animation for Karte ${card.id} did not finish (playState: ${animationInstanceRef.current.playState}). Forcing cleanup.`);
            onAnimationEnd(card.id);
            animationInstanceRef.current.cancel();
        }
    }, options.duration + 200);

    return () => {
      if (animationInstanceRef.current) {
        animationInstanceRef.current.cancel();
      }
      clearTimeout(fallbackTimeout);
    };
  }, [card.id, startRect, endRect, onAnimationEnd]);

  return (
    <div
      ref={animatedRef}
      // CRITICAL CHANGE: Remove conflicting Tailwind classes like p-4, mb-3.
      // Keep only essential visual (non-sizing/non-text) classes.
      // bg-white, rounded, shadow-md are okay.
      className="bg-white rounded shadow-md pointer-events-none" // Removed p-4, mb-3
      style={{
        position: 'fixed',
        left: startRect ? startRect.left : 0,
        top: startRect ? startRect.top : 0,
        // CRITICAL: Ensure width and height are from startRect for the clone's initial size
        width: startRect ? startRect.width : 0,  // Apply width from startRect
        height: startRect ? startRect.height : 0, // Apply height from startRect
        zIndex: 1000,
        opacity: startRect ? 1 : 0, // Start opaque if startRect is available
        // Manually apply padding, font size, and text wrapping rules here to match the resting card
        padding: '4px 6px', // Matches the Card component's padding
        fontSize: '0.75rem', // Matches the Card component's font size
        textAlign: 'center', // Center text
        display: 'flex',      // Use flexbox for centering content
        justifyContent: 'center', // Center horizontally
        alignItems: 'center',     // Center vertically
        whiteSpace: 'nowrap',   // Prevent text wrapping (fixes carriage return)
        overflow: 'hidden',      // Hide text that overflows
        textOverflow: 'ellipsis' // Add "..." for hidden text (optional, but good UX)
      }}
    >
      {/* Ensure "Karte" text for gliding clone */}
      {card.birth_id ? `Karte ${card.birth_id}` : card.id}
    </div>
  );
};

export default FlyingCardAnimation;