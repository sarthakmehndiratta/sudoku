import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Group, Button, Box, Anchor } from '@mantine/core';
import { AuthContext } from '../context/AuthContext';

function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Box
      style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        padding: '1rem 2rem',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
      }}
    >
      <Group justify="space-between" align="center">
        <Anchor 
          component={Link} 
          to="/" 
          c="white" 
          fw={700} 
          fz="xl" 
          style={{ textDecoration: 'none' }}
        >
          🎮 Sudoku Game
        </Anchor>
        
        <Group gap="md">
          <Anchor component={Link} to="/" c="white" style={{ textDecoration: 'none' }}>
            Home
          </Anchor>
          <Anchor component={Link} to="/leaderboard" c="white" style={{ textDecoration: 'none' }}>
            Leaderboard
          </Anchor>
          {user ? (
            <>
              <Anchor component={Link} to="/game" c="white" style={{ textDecoration: 'none' }}>
                Play Game
              </Anchor>
              <Anchor component={Link} to="/profile" c="white" style={{ textDecoration: 'none' }}>
                Profile
              </Anchor>
              <Button 
                variant="subtle" 
                c="white" 
                onClick={handleLogout}
                style={{ background: 'none', border: 'none' }}
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Anchor component={Link} to="/login" c="white" style={{ textDecoration: 'none' }}>
                Login
              </Anchor>
              <Anchor component={Link} to="/register" c="white" style={{ textDecoration: 'none' }}>
                Register
              </Anchor>
            </>
          )}
        </Group>
      </Group>
    </Box>
  );
}

export default Navbar; 