import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Container, 
  Title, 
  Table, 
  Group, 
  Stack, 
  Text, 
  Badge, 
  Card, 
  Alert,
  LoadingOverlay,
  SimpleGrid,
  Box
} from '@mantine/core';

function Profile() {
  const [profile, setProfile] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProfile();
    fetchGameHistory();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await axios.get('/profile');
      setProfile(response.data);
    } catch (err) {
      setError('Failed to fetch profile');
    }
  };

  const fetchGameHistory = async () => {
    try {
      const response = await axios.get('/game/history');
      setGameHistory(response.data);
    } catch (err) {
      setError('Failed to fetch game history');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <Container size="lg" pos="relative" mih="50vh">
        <LoadingOverlay visible={loading} />
      </Container>
    );
  }

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return 'green';
      case 'medium': return 'yellow';
      case 'hard': return 'red';
      default: return 'gray';
    }
  };

  const getModeColor = (mode) => {
    return mode === 'play' ? 'green' : 'blue';
  };

  return (
    <Container size="lg" style={{ color: 'white', textAlign: 'center' }}>
      <Stack gap="xl">
        <Title order={2} size="2.5rem" mb="xl">
          👤 User Profile
        </Title>
        
        {error && (
          <Alert color="red" style={{ 
            background: 'rgba(220, 53, 69, 0.2)',
            border: '1px solid rgba(220, 53, 69, 0.3)'
          }}>
            {error}
          </Alert>
        )}

        {profile && (
          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="xl" mb="3rem">
            <Card
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
              p="xl"
              radius="md"
            >
              <Text size="2.5rem" fw={700} c="blue" mb="xs">
                {profile.total_points}
              </Text>
              <Text size="lg" style={{ opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1px' }} c="white">
                Total Points
              </Text>
            </Card>
            
            <Card
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
              p="xl"
              radius="md"
            >
              <Text size="2.5rem" fw={700} c="blue" mb="xs">
                {profile.games_played}
              </Text>
              <Text size="lg" style={{ opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1px' }} c="white">
                Games Played
              </Text>
            </Card>
            
            <Card
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
              p="xl"
              radius="md"
            >
              <Text size="2.5rem" fw={700} c="blue" mb="xs">
                {profile.games_played > 0 ? Math.round(profile.total_points / profile.games_played) : 0}
              </Text>
              <Text size="lg" style={{ opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1px' }} c="white">
                Average Score
              </Text>
            </Card>
            
            <Card
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
              p="xl"
              radius="md"
            >
              <Text size="2.5rem" fw={700} c="blue" mb="xs">
                {profile.username}
              </Text>
              <Text size="lg" style={{ opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1px' }} c="white">
                Username
              </Text>
            </Card>
          </SimpleGrid>
        )}

        <Card
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
          p="xl"
          radius="md"
        >
          <Title order={3} size="1.8rem" mb="xl" c="white">
            📊 Recent Games
          </Title>
          
          {gameHistory.length === 0 ? (
            <Box style={{ textAlign: 'center', padding: '3rem' }}>
              <Text size="xl" style={{ opacity: 0.8 }} c="white">
                No games played yet. Start your first game!
              </Text>
            </Box>
          ) : (
            <Table.ScrollContainer minWidth={700}>
              <Table 
                verticalSpacing="md" 
                horizontalSpacing="lg"
                style={{ color: 'white' }}
              >
                <Table.Thead>
                  <Table.Tr style={{ background: 'rgba(255, 255, 255, 0.1)' }}>
                    <Table.Th style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>Date</Table.Th>
                    <Table.Th style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>Mode</Table.Th>
                    <Table.Th style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>Difficulty</Table.Th>
                    <Table.Th style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>Score</Table.Th>
                    <Table.Th style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>Time</Table.Th>
                    <Table.Th style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {gameHistory.map((game) => (
                    <Table.Tr key={game.id} style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                      <Table.Td>
                        <Text c="white">{formatDate(game.created_at)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={getModeColor(game.mode)} variant="filled">
                          {game.mode === 'play' ? '🎯 Play' : '📚 Learn'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge 
                          color={getDifficultyColor(game.puzzle?.difficulty)}
                          variant="filled"
                          style={{ textTransform: 'uppercase' }}
                        >
                          {game.puzzle?.difficulty?.charAt(0).toUpperCase() + game.puzzle?.difficulty?.slice(1)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={700} size="lg" c="green">{game.score}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text style={{ fontFamily: 'monospace' }} size="lg" c="white">
                          {formatTime(game.time_seconds)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge 
                          color={game.completed ? 'green' : 'gray'}
                          variant="filled"
                        >
                          {game.completed ? '✅ Completed' : '⏳ Incomplete'}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Card>
      </Stack>
    </Container>
  );
}

export default Profile; 