import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { setupDatabase } from '../database/db';

export default function RootLayout() {
  useEffect(() => {
    setupDatabase();
  }, []);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      
      <Stack.Screen 
        name="new-game" 
        options={{ presentation: 'modal', title: 'New Game' }} 
      />
      <Stack.Screen 
        name="new-team" 
        options={{ presentation: 'modal', title: 'New Team' }} 
      />
      
      {/* NEW: Add Player Modal */}
      <Stack.Screen 
        name="new-player" 
        options={{ presentation: 'modal', title: 'Add Player' }} 
      />

      <Stack.Screen name="game/[id]" options={{ title: 'Game Tracking' }} />
      <Stack.Screen name="point/[gameId]/[pointNumber]" options={{ title: 'Track Point' }} />
      <Stack.Screen name="team/[id]" options={{ title: 'Team Roster' }} />
    </Stack>
  );
}