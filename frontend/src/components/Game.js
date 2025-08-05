import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import TechniqueInfo from './TechniqueInfo';
import './Game.css';

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
    
    setSelectedCell(null);
  };

  const handleKeyPress = (e) => {
    if (!selectedCell) return;
    
    const key = e.key;
    if (key >= '1' && key <= '9') {
      handleNumberInput(parseInt(key));
    } else if (key === 'Backspace' || key === 'Delete' || key === '0') {
      handleNumberInput(0);
    }
  };

  const getHint = async () => {
    if (gameCompleted) return;
    
    try {
      if (hintState.step === 'none') {
        // Step 1: Find a solvable cell to highlight
        const response = await axios.post('/game/hint', {
          game_result_id: gameState.gameResultId,
          mode: 'find_cell'
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
          col
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
    try {
      const response = await axios.post('/game/submit', {
        game_result_id: gameState.gameResultId,
        final_grid: gridToString(gameState.board),
        time_seconds: gameState.timer,
        used_hints: gameState.usedHints,
        used_auto_solve: gameState.usedAutoSolve
      });
      
      setGameCompleted(true);
      
      if (response.data.completed) {
        alert(`Game completed! Score: ${response.data.score}, Time: ${formatTime(response.data.time_seconds)}`);
      } else if (response.data.disqualified) {
        alert('Game completed but disqualified due to hints or auto-solve usage');
      } else {
        alert('Game submitted but not completed correctly');
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
      <div className="game-setup">
        <h2>🎮 Start New Game</h2>
        <div className="game-options">
          <div className="mode-selection">
            <h3>Select Game Mode:</h3>
            <div className="mode-buttons">
              <button 
                className={`btn ${gameState.mode === 'play' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setGameState(prev => ({ ...prev, mode: 'play' }))}
              >
                🎯 Play Mode (Competitive)
              </button>
              <button 
                className={`btn ${gameState.mode === 'learn' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setGameState(prev => ({ ...prev, mode: 'learn' }))}
              >
                📚 Learn Mode (Educational)
              </button>
            </div>
          </div>
          
          <div className="difficulty-selection">
            <h3>Select Difficulty:</h3>
            <div className="difficulty-buttons">
              {['easy', 'medium', 'hard'].map(diff => (
                <button 
                  key={diff}
                  className={`btn ${gameState.difficulty === diff ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setGameState(prev => ({ ...prev, difficulty: diff }))}
                >
                  {diff.charAt(0).toUpperCase() + diff.slice(1)}
                </button>
              ))}
            </div>
          </div>
          
          <button 
            className="btn btn-success start-game-btn"
            onClick={() => startGame(gameState.mode, gameState.difficulty)}
            disabled={loading}
          >
            {loading ? 'Starting...' : 'Start Game'}
          </button>
        </div>
        
        {error && <div className="error-message">{error}</div>}
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="game-header">
        <h2>🎮 Sudoku Game</h2>
        <div className="game-info">
          <div className="timer">⏱️ {formatTime(gameState.timer)}</div>
          <div className="mode-info">
            Mode: {gameState.mode === 'play' ? '🎯 Play' : '📚 Learn'} | 
            Difficulty: {gameState.difficulty.charAt(0).toUpperCase() + gameState.difficulty.slice(1)}
          </div>
        </div>
      </div>

      <div className="game-board">
        <div className="sudoku-grid" onKeyDown={handleKeyPress} tabIndex={0}>
          {gameState.board.map((row, rowIndex) => (
            row.map((cell, colIndex) => (
              <input
                key={`${rowIndex}-${colIndex}`}
                type="text"
                className={`sudoku-cell ${
                  isCellInitial(rowIndex, colIndex) ? 'initial' : ''
                } ${isCellSelected(rowIndex, colIndex) ? 'selected' : ''} ${
                  isCellHintHighlighted(rowIndex, colIndex) ? 'hint-highlighted' : ''
                } ${isCellLastSolved(rowIndex, colIndex) ? 'last-solved' : ''}`}
                value={cell === 0 ? '' : cell}
                readOnly={isCellInitial(rowIndex, colIndex)}
                onClick={() => handleCellClick(rowIndex, colIndex)}
                maxLength={1}
              />
            ))
          ))}
        </div>
      </div>

      <div className="game-controls">
        <div className="number-pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              className="btn number-btn"
              onClick={() => handleNumberInput(num)}
            >
              {num}
            </button>
          ))}
          <button
            className="btn number-btn"
            onClick={() => handleNumberInput(0)}
          >
            Clear
          </button>
        </div>

        <div className="game-actions">
          {gameState.mode === 'learn' && (
            <>
              <button className="btn btn-secondary" onClick={getHint}>
                {hintState.step === 'none' ? '💡 Hint' : '💡 Fill Hint'}
              </button>
              <button className="btn btn-secondary" onClick={solveStep}>
                🔧 Solve Step
              </button>
              <button className="btn btn-secondary" onClick={solvePuzzle}>
                🔧 Auto-Solve (All)
              </button>
            </>
          )}
          
          <button 
            className="btn btn-success" 
            onClick={submitGame}
            disabled={gameCompleted}
          >
            {gameCompleted ? 'Game Over' : 'Submit Game'}
          </button>
          
          <button 
            className="btn btn-danger" 
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
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      
      <TechniqueInfo 
        technique={showTechnique} 
        onClose={() => {
          setShowTechnique(null);
          setLastSolvedCell(null);
        }} 
      />
    </div>
  );
}

export default Game;
