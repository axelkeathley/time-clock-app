import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from './src/screens/HomeScreen';
import WeeklyScreen from './src/screens/WeeklyScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const ICON_MAP: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Home:     ['time',          'time-outline'],
  Weekly:   ['bar-chart',     'bar-chart-outline'],
  Calendar: ['calendar',      'calendar-outline'],
  History:  ['receipt',       'receipt-outline'],
  Settings: ['settings',      'settings-outline'],
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarStyle: {
              backgroundColor: '#1E293B',
              borderTopColor: '#334155',
            },
            tabBarActiveTintColor: '#3B82F6',
            tabBarInactiveTintColor: '#94A3B8',
            tabBarIcon: ({ focused, color, size }) => {
              const [active, inactive] = ICON_MAP[route.name] ?? ['ellipse', 'ellipse-outline'];
              return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
            },
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Weekly" component={WeeklyScreen} />
          <Tab.Screen name="Calendar" component={CalendarScreen} />
          <Tab.Screen name="History" component={HistoryScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
