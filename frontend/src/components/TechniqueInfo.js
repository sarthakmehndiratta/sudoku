import React from 'react';
import { Card, Title, Text, Button, Stack } from '@mantine/core';

const definitions = {
  "Naked Single": "A Naked Single is a cell that has only one possible candidate. This is the easiest and most common Sudoku technique.",
  "Hidden Single": "A Hidden Single is a cell where a certain number can only be placed in one cell within a row, column, or 3x3 box, although the cell itself has other candidates.",
  "Hidden Single (Simplified)": "A Hidden Single is a cell where a certain number can only be placed in one cell within a row, column, or 3x3 box, although the cell itself has other candidates."
};

function TechniqueInfo({ technique, onClose }) {
  if (!technique) return null;

  return (
    <Stack gap="sm">
      <Title order={5} c="white" ta="center">{technique}</Title>
      <Text size="sm" c="white" style={{ lineHeight: 1.4 }}>
        {definitions[technique] || "No definition available."}
      </Text>
      <Button onClick={onClose} variant="outline" color="black" size="xs" fullWidth>
        Close
      </Button>
    </Stack>
  );
}

export default TechniqueInfo;
