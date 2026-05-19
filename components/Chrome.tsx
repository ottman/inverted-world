import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link, router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export function Chrome({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 720;

  return (
    <View style={styles.shell}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.push('/')} style={styles.logo}>
          <Text style={styles.mark}>IW</Text>
          {!compact && <Text style={styles.logoText}>Inverted World</Text>}
        </Pressable>
        <View style={styles.nav}>
          <Link href="/archive" asChild>
            <Pressable style={styles.navButton}>
              <Text style={styles.navText}>archive</Text>
            </Pressable>
          </Link>
          <Link href="/research" asChild>
            <Pressable style={styles.navButton}>
              <Text style={styles.navText}>research</Text>
            </Pressable>
          </Link>
          {user ? (
            <Pressable onPress={signOut} style={styles.navButton}>
              <MaterialIcons name="logout" size={14} color={Brand.gold} />
            </Pressable>
          ) : (
            <Pressable onPress={() => router.push('/auth/sign-up')} style={styles.navButtonJoin}>
              <Text style={styles.navText}>join</Text>
            </Pressable>
          )}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  topbar: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: 'rgba(5,5,5,0.44)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    gap: 12,
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mark: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: Brand.gold,
    color: Brand.gold,
    fontFamily: Brand.mono,
    fontSize: 12,
    lineHeight: 30,
    textAlign: 'center',
  },
  logoText: {
    color: Brand.text,
    fontFamily: Brand.mono,
    fontSize: 13,
    textTransform: 'uppercase',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navButton: {
    minHeight: 34,
    minWidth: 34,
    borderWidth: 1,
    borderColor: Brand.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: 'rgba(5,5,5,0.32)',
  },
  navButtonJoin: {
    minHeight: 34,
    minWidth: 34,
    borderWidth: 1,
    borderColor: Brand.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: 'rgba(5,5,5,0.32)',
  },
  navText: {
    color: Brand.text,
    fontFamily: Brand.mono,
    fontSize: 11,
    textTransform: 'uppercase',
  },
});
