import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Container, 
  Title, 
  Text, 
  Card, 
  Button, 
  Group, 
  Grid, 
  Alert,
  Center,
  Box,
  Stack,
  SimpleGrid
} from '@mantine/core';
import { AuthContext } from '../context/AuthContext';
import TechniqueInfo from './TechniqueInfo';

// Add CSS animations
const styles = `
  @keyframes hint-pulse {
    0%, 100% { background-color: #fff3e0; }
    50% { background-color: #ffcc80; }
  }
  
  @keyframes fade-in {
    0% { background-color: #fff; }
    100% { background-color: #d4edda; }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

function Game() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [gameState, setGameState] = useState({
    gameResultId: null,
    puzzle: null,
    board: Array(9).fill().map(() => Array(9).fill(0)),
    initialBoard: Array(9).fill().map(() => Array(9).fill(0)),
    mode: 'play',
    difficulty: 'easy',
    startedAt: null,
    timer: 0,
    usedHints: false,
    usedAutoSolve: false
  });
  
  const [selectedCell, setSelectedCell] = useState(null);
  const [hintState, setHintState] = useState({
    step: 'none', // 'none', 'highlighted', 'filled'
    highlightedCell: null // {row, col}
  });
  const [gameStarted, setGameStarted] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTechnique, setShowTechnique] = useState(null);
  const [lastSolvedCell, setLastSolvedCell] = useState(null);

  const isBoardFull = () => {
    return gameState.board.every(row => row.every(cell => cell !== 0));
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
  }, [user, navigate]);

  useEffect(() => {
    let interval;
    if (gameStarted && !gameCompleted) {
      interval = setInterval(() => {
        setGameState(prev => ({
          ...prev,
          timer: prev.timer + 1
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, gameCompleted]);

  const startGame = async (mode, difficulty) => {
    setLoading(true);
    setError('');
    
    console.log('Starting game with:', { mode, difficulty, user });
    console.log('Authorization header:', axios.defaults.headers.common['Authorization']);
    
    try {
      const response = await axios.post('/game/start', {
        mode,
        difficulty
      });
      
      console.log('Start game response:', response.data);
      
      const { game_result_id, puzzle, started_at } = response.data;
      
      // Parse the starting grid
      const board = parseGrid(puzzle.starting_grid);
      const initialBoard = parseGrid(puzzle.starting_grid);
      
      setGameState({
        gameResultId: game_result_id,
        puzzle,
        board,
        initialBoard,
        mode,
        difficulty,
        startedAt: new Date(started_at),
        timer: 0,
        usedHints: false,
        usedAutoSolve: false
      });
      
      setGameStarted(true);
      setGameCompleted(false);
    } catch (err) {
      console.error('Start game error:', err);
      console.error('Error response:', err.response);
      setError(err.response?.data || 'Failed to start game');
    } finally {
      setLoading(false);
    }
  };

  const parseGrid = (gridString) => {
    const board = Array(9).fill().map(() => Array(9).fill(0));
    for (let i = 0; i < 81; i++) {
      const row = Math.floor(i / 9);
      const col = i % 9;
      board[row][col] = parseInt(gridString[i]) || 0;
    }
    return board;
  };

  const gridToString = (board) => {
    return board.flat().join('');
  };

  const handleCellClick = (row, col) => {
    if (gameCompleted || gameState.initialBoard[row][col] !== 0) {
      return;
    }
    setSelectedCell({ row, col });
  };

  const handleNumberInput = (number) => {
    if (!selectedCell || gameCompleted) return;
    
    const { row, col } = selectedCell;
    const newBoard = [...gameState.board];
    newBoard[row][col] = number;
    
    setGameState(prev => ({
      ...prev,
      board: newBoard
    }));
    
    // Don't clear selectedCell - keep it highlighted
    // setSelectedCell(null); // Removed this line
    setShowTechnique(null); // Hide technique info on number input
  };

  const handleKeyPress = (e) => {
    if (!selectedCell) return;

    const { row, col } = selectedCell;
    const key = e.key;

    if (key >= '1' && key <= '9') {
      handleNumberInput(parseInt(key));
    } else if (key === 'Backspace' || key === 'Delete' || key === '0') {
      handleNumberInput(0);
    } else if (key.startsWith('Arrow')) {
      e.preventDefault();
      
      // Helper function to find next available cell in a direction
      const findNextAvailableCell = (startRow, startCol, deltaRow, deltaCol) => {
        let newRow = startRow + deltaRow;
        let newCol = startCol + deltaCol;
        
        // Keep moving in the direction until we find an empty cell or hit boundary
        while (newRow >= 0 && newRow <= 8 && newCol >= 0 && newCol <= 8) {
          // Check if cell is empty (either initial empty cell or user cleared it)
          if (gameState.initialBoard[newRow][newCol] === 0) {
            return { row: newRow, col: newCol };
          }
          newRow += deltaRow;
          newCol += deltaCol;
        }
        
        // If we hit the boundary, return the original position
        return { row, col };
      };

      let newCell;
      if (key === 'ArrowUp') {
        newCell = findNextAvailableCell(row, col, -1, 0);
      } else if (key === 'ArrowDown') {
        newCell = findNextAvailableCell(row, col, 1, 0);
      } else if (key === 'ArrowLeft') {
        newCell = findNextAvailableCell(row, col, 0, -1);
      } else if (key === 'ArrowRight') {
        newCell = findNextAvailableCell(row, col, 0, 1);
      }

      if (newCell && (newCell.row !== row || newCell.col !== col)) {
        setSelectedCell(newCell);
      }
    }
  };

  const getHint = async () => {
    if (gameCompleted || isBoardFull()) {
      setError('All cells are already filled.');
      return;
    }
    
    setShowTechnique(null); // Hide technique info on hint
    
    try {
      if (hintState.step === 'none') {
        // Step 1: Find a solvable cell to highlight
        const response = await axios.post('/game/hint', {
          game_result_id: gameState.gameResultId,
          mode: 'find_cell',
          current_grid: gridToString(gameState.board)
        });
        
        const { row, col } = response.data;
        setHintState({
          step: 'highlighted',
          highlightedCell: { row, col }
        });
        setError(''); // Clear any previous errors
        
      } else if (hintState.step === 'highlighted') {
        // Step 2: Fill the highlighted cell with the correct value
        const { row, col } = hintState.highlightedCell;
        const response = await axios.post('/game/hint', {
          game_result_id: gameState.gameResultId,
          mode: 'fill_cell',
          row,
          col,
          current_grid: gridToString(gameState.board)
        });
        
        const { value } = response.data;
        const newBoard = [...gameState.board];
        newBoard[row][col] = value;
        
        setGameState(prev => ({
          ...prev,
          board: newBoard,
          usedHints: true
        }));
        
        // Reset hint state
        setHintState({
          step: 'none',
          highlightedCell: null
        });
        setError(''); // Clear any previous errors
      }
    } catch (err) {
      setError(err.response?.data || 'Failed to get hint');
      // Reset hint state on error
      setHintState({
        step: 'none',
        highlightedCell: null
      });
    }
  };

  const solveStep = async () => {
    if (isBoardFull()) {
      setError('All cells are already filled.');
      return;
    }
    
    // Unhighlight hint cell if a hint is active
    if (hintState.step === 'highlighted') {
      setHintState({
        step: 'none',
        highlightedCell: null
      });
    }
    
    try {
      const response = await axios.post('/game/solve-step', {
        game_result_id: gameState.gameResultId
      });
      
      const { row, col, value, reason } = response.data;
      const newBoard = [...gameState.board];
      newBoard[row][col] = value;
      
      setGameState(prev => ({
        ...prev,
        board: newBoard,
        usedAutoSolve: true // Using solve step counts as auto-solve
      }));
      
      setLastSolvedCell({ row, col });
      setShowTechnique(reason);
      
    } catch (err) {
      setError(err.response?.data || 'Failed to get next step');
    }
  };

  const solvePuzzle = async () => {
    try {
      const response = await axios.post('/game/solve', {
        game_result_id: gameState.gameResultId
      });
      
      const solvedBoard = parseGrid(response.data.solved_grid);
      
      setGameState(prev => ({
        ...prev,
        board: solvedBoard,
        usedAutoSolve: true
      }));
      
      setGameCompleted(true);
    } catch (err) {
      setError(err.response?.data || 'Failed to solve puzzle');
    }
  };

  const submitGame = async () => {
    const isFull = isBoardFull();
    if (!isFull) {
      const userConfirmed = window.confirm('The board is not completely filled. Are you sure you want to submit?');
      if (!userConfirmed) {
        return;
      }
    }
    
    try {
      const response = await axios.post('/game/submit', {
        game_result_id: gameState.gameResultId,
        final_grid: gridToString(gameState.board),
        time_seconds: gameState.timer,
        used_hints: gameState.usedHints,
        used_auto_solve: gameState.usedAutoSolve
      });
      
      if (response.data.correct) {
        setGameCompleted(true);
        alert(`Congratulations! Your solution is correct. Score: ${response.data.score}, Time: ${formatTime(response.data.time_seconds)}`);
      } else {
        alert('Your solution is incorrect. Please review your answers.');
      }
    } catch (err) {
      setError(err.response?.data || 'Failed to submit game');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isCellInitial = (row, col) => {
    return gameState.initialBoard[row][col] !== 0;
  };

  const isCellSelected = (row, col) => {
    return selectedCell && selectedCell.row === row && selectedCell.col === col;
  };

  const isCellHintHighlighted = (row, col) => {
    return hintState.step === 'highlighted' && hintState.highlightedCell && hintState.highlightedCell.row === row && hintState.highlightedCell.col === col;
  };

  const isCellLastSolved = (row, col) => {
    return lastSolvedCell && lastSolvedCell.row === row && lastSolvedCell.col === col;
  };

  if (!user) {
    return null;
  }

  if (!gameStarted) {
    return (
      <Container size="lg" style={{ textAlign: 'center', color: 'white' }}>
        <Title order={2} mb="xl">
          🎮 Start New Game
        </Title>
        
        <Card
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            maxWidth: 600,
            margin: '0 auto',
          }}
          p="xl"
          radius="md"
        >
          <Stack gap="xl">
            <div>
              <Title order={3} mb="md" c="white">
                Select Game Mode:
              </Title>
              <Group justify="center" gap="md">
                <Button 
                  variant={gameState.mode === 'play' ? 'filled' : 'outline'}
                  color="black"
                  onClick={() => setGameState(prev => ({ ...prev, mode: 'play' }))}
                >
                  🎯 Play Mode (Competitive)
                </Button>
                <Button 
                  variant={gameState.mode === 'learn' ? 'filled' : 'outline'}
                  color="black"
                  onClick={() => setGameState(prev => ({ ...prev, mode: 'learn' }))}
                >
                  📚 Learn Mode (Educational)
                </Button>
              </Group>
            </div>
            
            <div>
              <Title order={3} mb="md" c="white">
                Select Difficulty:
              </Title>
              <Group justify="center" gap="md">
                {['easy', 'medium', 'hard'].map(diff => (
                  <Button 
                    key={diff}
                    variant={gameState.difficulty === diff ? 'filled' : 'outline'}
                    color="black"
                    onClick={() => setGameState(prev => ({ ...prev, difficulty: diff }))}
                  >
                    {diff.charAt(0).toUpperCase() + diff.slice(1)}
                  </Button>
                ))}
              </Group>
            </div>
            
            <Button 
              color="green"
              size="lg"
              onClick={() => startGame(gameState.mode, gameState.difficulty)}
              loading={loading}
            >
              {loading ? 'Starting...' : 'Start Game'}
            </Button>
          </Stack>
        </Card>
        
        {error && (
          <Alert color="red" mt="md" style={{ background: 'rgba(220, 53, 69, 0.2)' }}>
            {error}
          </Alert>
        )}
      </Container>
    );
  }

  return (
    <Container size="xl" style={{ textAlign: 'center', color: 'white', padding: '1rem' }}>
      <Stack gap="lg">
        <div>
          <Title order={2} mb="md">🎮 Sudoku Game</Title>
          <Group justify="center" gap="md" style={{ flexWrap: 'wrap' }}>
            <Card 
              style={{ 
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}
              p="sm" 
              radius="md"
            >
              <Text size="lg" fw={700}>⏱️ {formatTime(gameState.timer)}</Text>
            </Card>
            <Card 
              style={{ 
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}
              p="sm" 
              radius="md"
            >
              <Text size="md" opacity={0.9}>
                Mode: {gameState.mode === 'play' ? '🎯 Play' : '📚 Learn'} | 
                Difficulty: {gameState.difficulty.charAt(0).toUpperCase() + gameState.difficulty.slice(1)}
              </Text>
            </Card>
          </Group>
        </div>

        {/* Responsive Game Layout */}
        <Grid gutter="lg" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Left Column - Sudoku Grid */}
          <Grid.Col span={{ base: 12, sm: 12, md: 6, lg: 6 }}>
            <Stack align="center" gap="md">
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(9, 1fr)',
                gap: '1px',
                backgroundColor: '#333',
                border: '2px solid #333',
                maxWidth: '100%',
                width: 'min(450px, 100%)',
                aspectRatio: '1 / 1'
              }} onKeyDown={handleKeyPress} tabIndex={0}>
                {gameState.board.map((row, rowIndex) => (
                  row.map((cell, colIndex) => {
                    const isInitial = isCellInitial(rowIndex, colIndex);
                    const isSelected = isCellSelected(rowIndex, colIndex);
                    const isHintHighlighted = isCellHintHighlighted(rowIndex, colIndex);
                    const isLastSolved = isCellLastSolved(rowIndex, colIndex);
                    
                    return (
                      <input
                        key={`${rowIndex}-${colIndex}`}
                        type="text"
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                          textAlign: 'center',
                          fontSize: 'clamp(14px, 2.5vw, 18px)',
                          fontWeight: 'bold',
                          backgroundColor: isInitial ? '#d0d0d0' : 
                                        isLastSolved ? '#d4edda' :
                                        isHintHighlighted ? '#fff3e0' :
                                        isSelected ? '#e3f2fd' : 'white',
                          color: isInitial ? '#000' : 
                                 isLastSolved ? '#155724' : 
                                 '#333',
                          cursor: isInitial ? 'not-allowed' : 'pointer',
                          caretColor: 'transparent', // Hide cursor/caret
                          transition: 'all 0.2s',
                          borderRight: (colIndex + 1) % 3 === 0 && colIndex !== 8 ? '2px solid #333' : 'none',
                          borderBottom: Math.floor(rowIndex / 3) === 0 && rowIndex === 2 || 
                                       Math.floor(rowIndex / 3) === 1 && rowIndex === 5 ? '2px solid #333' : 'none',
                          outline: isSelected ? '2px solid #007bff' : 'none',
                          animation: isHintHighlighted ? 'hint-pulse 1.5s ease-in-out infinite' : 
                                    isLastSolved ? 'fade-in 0.5s ease-in-out' : 'none'
                        }}
                        value={cell === 0 ? '' : cell}
                        readOnly={isInitial}
                        onClick={() => handleCellClick(rowIndex, colIndex)}
                        maxLength={1}
                      />
                    );
                  })
                ))}
              </div>
            </Stack>
          </Grid.Col>

          {/* Right Column - Controls and Info */}
          <Grid.Col span={{ base: 12, sm: 12, md: 6, lg: 6 }}>
  <Stack gap="xs">

    {/* Number Pad */}
    <Card 
      style={{ 
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
      }}
      p="sm"
      radius="md"
    >
      <SimpleGrid 
        cols={5} 
        spacing={7} 
        style={{ maxWidth: '260px', margin: '0 auto' }} // center + limit total width
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <Button
            key={num}
            variant="light"
            size="sm"
            style={{
              width: '100%',
              aspectRatio: '1 / 1', // keeps square shape
              minHeight: '50px',
              fontSize: 'clamp(14px, 2vw, 18px)',
              fontWeight: 'bold',
              padding: 0,
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
            onClick={() => handleNumberInput(num)}
          >
            {num}
          </Button>
        ))}
        <Button
          variant="light"
          size="sm"
          style={{
            width: '100%',
            aspectRatio: '1 / 1',
            minHeight: '50px',
            fontSize: 'clamp(12px, 1.8vw, 16px)',
            fontWeight: 'bold',
            padding: 0,
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}
          onClick={() => handleNumberInput(0)}
        >
          Clear
        </Button>
      </SimpleGrid>
    </Card>

    {/* Game Controls */}
    <Card 
      style={{ 
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}
      p="sm"
      radius="md"
    >
      <Title order={5} mb={4} c="white" ta="center">Game Controls</Title>
      <Stack gap={4}>
        {gameState.mode === 'learn' && (
          <Group justify="center" gap={4}>
            <Button variant="outline" color="yellow" size="sm" onClick={getHint}>
              💡 {hintState.step === 'none' ? 'Hint' : 'Fill'}
            </Button>
            <Button variant="outline" color="orange" size="sm" onClick={solveStep}>
              🔧 Step
            </Button>
            <Button variant="outline" color="orange" size="sm" onClick={solvePuzzle}>
              🔧 Solve
            </Button>
          </Group>
        )}
        <Group justify="center" gap={4}>
          <Button 
            variant="filled" 
            color="green" 
            size="sm" 
            onClick={submitGame} 
            disabled={gameCompleted}
          >
            {gameCompleted ? 'Game Over' : 'Submit'}
          </Button>
          <Button 
            variant="filled" 
            color="red" 
            size="sm" 
            onClick={() => {
              setGameStarted(false);
              setGameState({
                gameResultId: null,
                puzzle: null,
                board: Array(9).fill().map(() => Array(9).fill(0)),
                initialBoard: Array(9).fill().map(() => Array(9).fill(0)),
                mode: 'play',
                difficulty: 'easy',
                startedAt: null,
                timer: 0,
                usedHints: false,
                usedAutoSolve: false
              });
            }}
          >
            New Game
          </Button>
        </Group>
      </Stack>
    </Card>

    {/* Technique Information */}
    {showTechnique && (
      <Card 
        style={{ 
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}
        p="sm"
        radius="md"
      >
        <TechniqueInfo 
          technique={showTechnique} 
          onClose={() => {
            setShowTechnique(null);
            setLastSolvedCell(null);
          }} 
        />
      </Card>
    )}
  </Stack>
</Grid.Col>

        </Grid>

        {error && (
          <Alert color="red" style={{ 
            background: 'rgba(220, 53, 69, 0.2)',
            border: '1px solid rgba(220, 53, 69, 0.3)'
          }}>
            {error}
          </Alert>
        )}
      </Stack>
    </Container>
  );
}

export default Game;
