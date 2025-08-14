import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { Container, Title, Text, Grid, Card, Button, Group, List } from '@mantine/core';
import { AuthContext } from '../context/AuthContext';

function Home() {
  const { user } = useContext(AuthContext);

  return (
    <Container size="lg" style={{ textAlign: 'center', color: 'white' }}>
      <div style={{ marginBottom: '3rem' }}>
        <Title 
          order={1} 
          size="3rem" 
          mb="lg" 
          style={{ textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)' }}
        >
          🎮 Welcome to Sudoku Game
        </Title>
        <Text size="xl" mb="xs" style={{ opacity: 0.9 }}>
          Challenge yourself with puzzles of varying difficulty levels
        </Text>
        <Text size="xl" style={{ opacity: 0.9 }}>
          Compete with others on the leaderboard or learn at your own pace
        </Text>
      </div>

      <Grid gutter="xl" mb="3rem">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              height: '100%',
            }}
            p="xl"
            radius="md"
          >
            <Title order={3} size="1.5rem" mb="md" c="white">
              🎯 Play Mode
            </Title>
            <Text mb="md" style={{ opacity: 0.9 }}>
              Competitive gameplay with scoring and leaderboards
            </Text>
            <List style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
              <List.Item style={{ opacity: 0.8 }}>Timer runs from start to finish</List.Item>
              <List.Item style={{ opacity: 0.8 }}>No hints allowed</List.Item>
              <List.Item style={{ opacity: 0.8 }}>Auto-solve disqualifies from scoring</List.Item>
              <List.Item style={{ opacity: 0.8 }}>+10 points per correct number</List.Item>
            </List>
            {user ? (
              <Button component={Link} to="/game" variant="filled" color="blue">
                Start Playing
              </Button>
            ) : (
              <Button component={Link} to="/login" variant="filled" color="blue">
                Login to Play
              </Button>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              height: '100%',
            }}
            p="xl"
            radius="md"
          >
            <Title order={3} size="1.5rem" mb="md" c="white">
              📚 Learn Mode
            </Title>
            <Text mb="md" style={{ opacity: 0.9 }}>
              Educational mode for learning Sudoku techniques
            </Text>
            <List style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
              <List.Item style={{ opacity: 0.8 }}>Use hints and auto-solver</List.Item>
              <List.Item style={{ opacity: 0.8 }}>Step through solutions</List.Item>
              <List.Item style={{ opacity: 0.8 }}>See human-style reasoning</List.Item>
              <List.Item style={{ opacity: 0.8 }}>No timer pressure</List.Item>
            </List>
            {user ? (
              <Button component={Link} to="/game" variant="filled" color="gray">
                Start Learning
              </Button>
            ) : (
              <Button component={Link} to="/register" variant="filled" color="gray">
                Register to Learn
              </Button>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              height: '100%',
            }}
            p="xl"
            radius="md"
          >
            <Title order={3} size="1.5rem" mb="md" c="white">
              🏆 Leaderboards
            </Title>
            <Text mb="md" style={{ opacity: 0.9 }}>
              Compete with players worldwide
            </Text>
            <List style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
              <List.Item style={{ opacity: 0.8 }}>Fastest time rankings</List.Item>
              <List.Item style={{ opacity: 0.8 }}>Highest score rankings</List.Item>
              <List.Item style={{ opacity: 0.8 }}>Filter by difficulty</List.Item>
              <List.Item style={{ opacity: 0.8 }}>Real-time updates</List.Item>
            </List>
            <Button component={Link} to="/leaderboard" variant="filled" color="green">
              View Leaderboard
            </Button>
          </Card>
        </Grid.Col>
      </Grid>

      {!user && (
        <Card
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
          p="xl"
          radius="md"
        >
          <Title order={2} size="2rem" mb="md">
            Ready to start?
          </Title>
          <Text size="lg" mb="xl" style={{ opacity: 0.9 }}>
            Join thousands of players and improve your Sudoku skills
          </Text>
          <Group justify="center" gap="md">
            <Button component={Link} to="/register" variant="filled" color="blue" size="lg">
              Create Account
            </Button>
            <Button component={Link} to="/login" variant="filled" color="gray" size="lg">
              Sign In
            </Button>
          </Group>
        </Card>
      )}
    </Container>
  );
}

export default Home; 