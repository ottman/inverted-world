import { ThemeProvider, type Theme } from '@react-navigation/native';
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

const navigationTheme: Theme = {
  dark: true,
  colors: {
    primary: Brand.gold,
    background: Brand.bg,
    card: Brand.bg,
    text: Brand.text,
    border: Brand.line,
    notification: Brand.red,
  },
  fonts: {
    regular: { fontFamily: Brand.mono, fontWeight: '400' },
    medium: { fontFamily: Brand.mono, fontWeight: '500' },
    bold: { fontFamily: Brand.mono, fontWeight: '700' },
    heavy: { fontFamily: Brand.mono, fontWeight: '800' },
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <RecursivProvider>
            <ResearchProvider>
              <ThemeProvider value={navigationTheme}>
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
              </ThemeProvider>
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
    overflow: 'hidden',
  },
  safe: {
    flex: 1,
  },
});
