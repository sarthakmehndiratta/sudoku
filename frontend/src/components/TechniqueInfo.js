import React from 'react';
import { Modal, Title, Text, Button } from '@mantine/core';

const definitions = {
  "Naked Single": "A Naked Single is a cell that has only one possible candidate. This is the easiest and most common Sudoku technique.",
  "Hidden Single": "A Hidden Single is a cell where a certain number can only be placed in one cell within a row, column, or 3x3 box, although the cell itself has other candidates.",
  "Hidden Single (Simplified)": "A Hidden Single is a cell where a certain number can only be placed in one cell within a row, column, or 3x3 box, although the cell itself has other candidates."
};

function TechniqueInfo({ technique, onClose }) {
  return (
    <Modal
      opened={!!technique}
      onClose={onClose}
      title={
        <Title order={2} c="white">
          {technique}
        </Title>
      }
      centered
      styles={{
        content: {
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        },
        header: {
          background: 'transparent',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        },
        close: {
          color: 'white',
        }
      }}
    >
      <Text size="lg" style={{ lineHeight: 1.6, marginBottom: '2rem' }} c="white">
        {definitions[technique] || "No definition available."}
      </Text>
      <Button onClick={onClose} fullWidth>
        Close
      </Button>
    </Modal>
  );
}

export default TechniqueInfo;
