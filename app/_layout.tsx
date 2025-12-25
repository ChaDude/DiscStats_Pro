import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { setupDatabase } from '../database/db';

export default function RootLayout() {
  useEffect(() => {
    // Initialize the database (create tables + seed data) when app starts
    setupDatabase();
  }, []);

  return (
    <Stack>
      {/* The Tab Interface (Main App) */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      
      {/* Global Screens */}
      <Stack.Screen 
        name="new-game" 
        options={{ 
          presentation: 'modal',
          title: 'New Game'
        }} 
      />
      <Stack.Screen 
        name="game/[id]" 
        options={{ title: 'Game Tracking' }} 
      />
      <Stack.Screen 
        name="point/[gameId]/[pointNumber]" 
        options={{ title: 'Track Point' }} 
      />
      
      {/* FIXED: Removed parentheses from 'team' */}
      <Stack.Screen 
        name="team/[id]" 
        options={{ title: 'Team Roster' }} 
      />
    </Stack>
  );
}