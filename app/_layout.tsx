import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Chrome } from '@/components/Chrome';
import { SignalBackground } from '@/components/SignalBackground';
import { Brand } from '@/constants/theme';
import { AuthProvider } from '@/contexts/AuthContext';
import { RecursivProvider } from '@/contexts/RecursivContext';
import { ResearchProvider } from '@/contexts/ResearchContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <RecursivProvider>
            <ResearchProvider>
              <View style={styles.root}>
                <SignalBackground />
                <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
                  <Chrome>
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: 'transparent' },
                      }}
                    />
                  </Chrome>
                </SafeAreaView>
                <StatusBar style="light" />
              </View>
            </ResearchProvider>
          </RecursivProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.bg,
  },
  safe: {
    flex: 1,
  },
});
