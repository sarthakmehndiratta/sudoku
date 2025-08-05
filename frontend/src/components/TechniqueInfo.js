import React from 'react';
import './TechniqueInfo.css';

const definitions = {
  "Naked Single": "A Naked Single is a cell that has only one possible candidate. This is the easiest and most common Sudoku technique.",
  "Hidden Single": "A Hidden Single is a cell where a certain number can only be placed in one cell within a row, column, or 3x3 box, although the cell itself has other candidates.",
  "Hidden Single (Simplified)": "A Hidden Single is a cell where a certain number can only be placed in one cell within a row, column, or 3x3 box, although the cell itself has other candidates."
};

function TechniqueInfo({ technique, onClose }) {
  if (!technique) return null;

  return (
    <div className="technique-modal-overlay" onClick={onClose}>
      <div className="technique-modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{technique}</h2>
        <p>{definitions[technique] || "No definition available."}</p>
        <button className="btn btn-primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default TechniqueInfo;
