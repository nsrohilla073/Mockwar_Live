import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

// 🔥 Yahan folder ka path theek kiya hai
import Auth from './screens/Auth';
import Lobby from './screens/Lobby';
import Arena from './screens/Arena';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      {/* Light status bar text because our app is Dark Mode */}
      <StatusBar style="light" backgroundColor="#020617" />
      
      <Stack.Navigator
        initialRouteName="Auth"
        screenOptions={{
          headerShown: false, // Hides the default top bar
          animationEnabled: true,
          gestureEnabled: false, // Disables iOS swipe-back gesture (Anti-cheat)
        }}
      >
        <Stack.Screen name="Auth" component={Auth} />
        <Stack.Screen 
          name="Lobby" 
          component={Lobby} 
          options={{
             // Prevent Android Back button from going to Auth screen
             gestureEnabled: false, 
             headerLeft: () => null,
          }}
        />
        <Stack.Screen 
          name="Arena" 
          component={Arena} 
          options={{
             // Prevents swipe-back on iOS during live match
             gestureEnabled: false,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}