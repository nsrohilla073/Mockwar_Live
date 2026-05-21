import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';

import Auth from './screens/Auth';
import Lobby from './screens/Lobby';
import Arena from './screens/Arena'; 

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Auth" component={Auth} />
        <Stack.Screen name="Lobby" component={Lobby} />
        <Stack.Screen name="Arena" component={Arena} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}