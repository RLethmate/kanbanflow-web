// src/components/Lane.js
import React from 'react';
import { useDrop } from 'react-dnd';
import Card, { ItemTypes } from './Card'; // Import ItemTypes

const Lane = ({ id, title, cards, moveCard }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.CARD,
    drop: (item, monitor) => {
      // Only move if the card is dropped into a different lane
      if (item.laneId !== id) {
        moveCard(item.id, item.laneId, id);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const backgroundColor = isOver ? 'bg-indigo-100' : 'bg-gray-100';

  return (
    <div
      ref={drop}
      className={`w-80 p-4 rounded-lg shadow-inner flex-shrink-0 mr-4 ${backgroundColor} transition-colors duration-200 ease-in-out`}
    >
      <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b border-gray-300 pb-2">{title}</h2>
      {cards.map((card, index) => (
        <Card key={card.id} id={card.id} text={card.text} laneId={id} index={index} />
      ))}
    </div>
  );
};

export default Lane;