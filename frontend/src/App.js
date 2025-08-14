import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

// Components
import Navbar from './components/Navbar';
import Login from './components/Login';
import Register from './components/Register';
import Home from './components/Home';
import Game from './components/Game';
import Leaderboard from './components/Leaderboard';
import Profile from './components/Profile';

// Context
import { AuthContext } from './context/AuthContext';

// Configure axios
axios.defaults.baseURL = 'http://localhost:8080';

const theme = createTheme({
  colorScheme: 'dark',
  colors: {
    dark: [
      '#d5d7e0',
      '#acaebf',
      '#8c8fa3',
      '#666980',
      '#4d4f66',
      '#34354a',
      '#2b2c3d',
      '#1d1e30',
      '#0c0d21',
      '#01010a',
    ],
  },
  primaryColor: 'blue',
});

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // You could verify the token here
      setUser({ token }); // For now, just set the token
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  if (loading) {
    return (
      <MantineProvider theme={theme}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh', 
          fontSize: '24px', 
          color: 'white' 
        }}>
          Loading...
        </div>
      </MantineProvider>
    );
  }

  return (
    <MantineProvider theme={theme}>
      <Notifications position="top-right" />
      <AuthContext.Provider value={{ user, login, logout }}>
        <Router>
          <div style={{ minHeight: '100vh' }}>
            <Navbar />
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
                <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
                <Route path="/game" element={<Game />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" />} />
              </Routes>
            </div>
          </div>
        </Router>
      </AuthContext.Provider>
    </MantineProvider>
  );
}

export default App; 