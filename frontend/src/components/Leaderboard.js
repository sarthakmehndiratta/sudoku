import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Container, 
  Title, 
  Table, 
  Select, 
  Group, 
  Stack, 
  Text, 
  Badge, 
  Card, 
  Alert,
  LoadingOverlay,
  Box
} from '@mantine/core';

function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    difficulty: '',
    type: 'score'
  });

  useEffect(() => {
    fetchLeaderboard();
  }, [filters]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams();
      if (filters.difficulty) params.append('difficulty', filters.difficulty);
      if (filters.type) params.append('type', filters.type);
      
      const response = await axios.get(`/leaderboard?${params}`);
      // Ensure we always have an array, even if API returns null
      setLeaderboard(response.data || []);
    } catch (err) {
      setError('Failed to fetch leaderboard');
      // Set empty array on error
      setLeaderboard([]);
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

  const getRankEmoji = (rank) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return '';
    }
  };

  return (
    <Container size="lg" style={{ color: 'white', textAlign: 'center' }}>
      <Stack gap="xl">
        <Title order={2} size="2.5rem" mb="xl">
          🏆 Leaderboard
        </Title>
        
        <Group justify="center" gap="xl" style={{ flexWrap: 'wrap' }}>
          <Box>
            <Text fw={700} size="lg" mb="xs" c="white">Difficulty:</Text>
            <Select
              data={[
                { value: '', label: 'All Difficulties' },
                { value: 'easy', label: 'Easy' },
                { value: 'medium', label: 'Medium' },
                { value: 'hard', label: 'Hard' }
              ]}
              value={filters.difficulty}
              onChange={(value) => setFilters(prev => ({ ...prev, difficulty: value || '' }))}
              styles={{
                input: {
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: 'white'
                }
              }}
            />
          </Box>
          
          <Box>
            <Text fw={700} size="lg" mb="xs" c="white">Sort by:</Text>
            <Select
              data={[
                { value: 'score', label: 'Highest Score' },
                { value: 'time', label: 'Fastest Time' }
              ]}
              value={filters.type}
              onChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
              styles={{
                input: {
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: 'white'
                }
              }}
            />
          </Box>
        </Group>

        {error && (
          <Alert color="red" style={{ 
            background: 'rgba(220, 53, 69, 0.2)',
            border: '1px solid rgba(220, 53, 69, 0.3)'
          }}>
            {error}
          </Alert>
        )}

        {(leaderboard || []).length === 0 ? (
          <Card
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
            p="3rem"
            radius="md"
          >
            <Text size="xl" style={{ opacity: 0.8 }} c="white">
              No leaderboard data available
            </Text>
          </Card>
        ) : (
          <Card
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
            p="xl"
            radius="md"
          >
            <Table.ScrollContainer minWidth={700}>
              <Table 
                verticalSpacing="md" 
                horizontalSpacing="lg"
                style={{ color: 'white' }}
              >
                <Table.Thead>
                  <Table.Tr style={{ background: 'rgba(255, 255, 255, 0.1)' }}>
                    <Table.Th style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>Rank</Table.Th>
                    <Table.Th style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>Player</Table.Th>
                    <Table.Th style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>Difficulty</Table.Th>
                    {filters.type === 'score' ? (
                      <>
                        <Table.Th style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>Score</Table.Th>
                        <Table.Th style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>Time</Table.Th>
                      </>
                    ) : (
                      <>
                        <Table.Th style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>Time</Table.Th>
                        <Table.Th style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>Score</Table.Th>
                      </>
                    )}
                    <Table.Th style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>Date</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {leaderboard.map((entry, index) => (
                    <Table.Tr 
                      key={index} 
                      style={{ 
                        background: index < 3 ? 
                          index === 0 ? 'linear-gradient(45deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.1))' :
                          index === 1 ? 'linear-gradient(45deg, rgba(192, 192, 192, 0.2), rgba(192, 192, 192, 0.1))' :
                          'linear-gradient(45deg, rgba(205, 127, 50, 0.2), rgba(205, 127, 50, 0.1))' :
                          'transparent'
                      }}
                    >
                      <Table.Td>
                        <Text fw={700} size="lg" c="white">
                          {getRankEmoji(index + 1)} #{index + 1}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={700} c="white">{entry.username}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge 
                          color={getDifficultyColor(entry.difficulty)}
                          variant="filled"
                          style={{ textTransform: 'uppercase' }}
                        >
                          {entry.difficulty.charAt(0).toUpperCase() + entry.difficulty.slice(1)}
                        </Badge>
                      </Table.Td>
                      {filters.type === 'score' ? (
                        <>
                          <Table.Td>
                            <Text fw={700} size="lg" c="green">{entry.score}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text style={{ fontFamily: 'monospace' }} size="lg" c="white">
                              {formatTime(entry.time_seconds)}
                            </Text>
                          </Table.Td>
                        </>
                      ) : (
                        <>
                          <Table.Td>
                            <Text style={{ fontFamily: 'monospace' }} size="lg" c="white">
                              {formatTime(entry.time_seconds)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={700} size="lg" c="green">{entry.score}</Text>
                          </Table.Td>
                        </>
                      )}
                      <Table.Td>
                        <Text style={{ opacity: 0.7 }} size="sm" c="white">
                          {formatDate(entry.completed_at)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        )}
      </Stack>
    </Container>
  );
}

export default Leaderboard;