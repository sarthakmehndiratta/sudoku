import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Container, Card, Title, TextInput, PasswordInput, Button, Alert, Anchor, Group } from '@mantine/core';
import { AuthContext } from '../context/AuthContext';

function Login() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/auth/login', formData);
      login(response.data.user, response.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container 
      size="xs" 
      style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '80vh' 
      }}
    >
      <Card
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          width: '100%',
        }}
        p="xl"
        radius="md"
      >
        <Title order={2} ta="center" mb="xl" c="white">
          🔐 Login
        </Title>
        
        {error && (
          <Alert color="red" mb="md" style={{ background: 'rgba(220, 53, 69, 0.2)' }}>
            {error}
          </Alert>
        )}
        
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Username"
            placeholder="Enter your username"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            required
            mb="md"
            styles={{
              label: { color: 'white', fontWeight: 500 },
              input: {
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                '&::placeholder': { color: 'rgba(255, 255, 255, 0.7)' },
                '&:focus': {
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderColor: '#007bff',
                },
              },
            }}
          />
          
          <PasswordInput
            label="Password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            mb="xl"
            styles={{
              label: { color: 'white', fontWeight: 500 },
              input: {
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                '&::placeholder': { color: 'rgba(255, 255, 255, 0.7)' },
                '&:focus': {
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderColor: '#007bff',
                },
              },
            }}
          />
          
          <Button 
            type="submit" 
            fullWidth 
            size="lg"
            loading={loading}
            mb="xl"
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
        
        <Group 
          justify="center" 
          pt="md" 
          style={{ 
            borderTop: '1px solid rgba(255, 255, 255, 0.2)' 
          }}
        >
          <Anchor component={Link} to="/register" c="blue">
            Don't have an account? Register here
          </Anchor>
        </Group>
      </Card>
    </Container>
  );
}

export default Login; 