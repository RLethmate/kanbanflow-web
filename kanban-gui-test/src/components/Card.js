// src/components/Card.js
import React, { forwardRef, useCallback } from 'react';
import { useDrag } from 'react-dnd';

const ItemTypes = {
  CARD: 'card',
};

const Card = forwardRef(({ id, text, laneId, index, style }, ref) => { // Accept style prop
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.CARD,
    item: { id, text, laneId, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const setRefs = useCallback(
    (node) => {
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
      if (typeof drag === 'function') {
        drag(node);
      } else if (drag) {
        drag.current = node;
      }
      // No more console.logs here for cleaner output during normal ops.
    },
    [ref, drag, id]
  );

  const opacity = isDragging ? 0.4 : 1;

  return (
    <div
      ref={setRefs}
      // Removed fixed width/padding here, as they are now set inline in Board.js
      // Ensure only visual traits that are consistent (like mb-3 for old value)
      // or drag-specific are here.
      className="bg-white rounded shadow-md cursor-grab transition-opacity duration-200 ease-in-out"
      style={{ ...style, opacity }} // Apply external style prop and internal opacity
    >
      {text}
    </div>
  );
});

export default Card;
export { ItemTypes };