import { Link, Stack, router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function SignUpScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const { signUp } = useAuth();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const submit = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await signUp(name.trim() || email.split('@')[0], email.trim(), password);
      router.replace({ pathname: '/research', params: params.q ? { q: params.q } : undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Join Inverted World' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.panel}>
          <Text style={styles.kicker}>join</Text>
          <Text style={styles.title}>Open a research desk.</Text>
          <Text style={styles.subtitle}>
            Your account creates a Recursiv API key and a private Inverted World agent workspace.
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="name"
            placeholderTextColor={Brand.faint}
            autoCapitalize="words"
            style={styles.input}
          />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="email"
            placeholderTextColor={Brand.faint}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="password"
            placeholderTextColor={Brand.faint}
            secureTextEntry
            style={styles.input}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            disabled={isSubmitting || !email.trim() || password.length < 8}
            onPress={submit}
            style={[
              styles.primaryButton,
              (isSubmitting || !email.trim() || password.length < 8) && styles.disabled,
            ]}
          >
            <Text style={styles.primaryText}>{isSubmitting ? 'opening...' : 'create desk'}</Text>
          </Pressable>

          <Link href="/auth/sign-in" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>sign in instead</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  panel: {
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: 'rgba(5,5,5,0.42)',
    padding: 18,
  },
  kicker: {
    color: Brand.gold,
    fontFamily: Brand.mono,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  title: {
    color: Brand.text,
    fontFamily: Brand.mono,
    fontSize: 30,
    lineHeight: 36,
    marginTop: 10,
  },
  subtitle: {
    color: Brand.muted,
    fontFamily: Brand.mono,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
    marginBottom: 18,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: 'rgba(0,0,0,0.34)',
    color: Brand.text,
    fontFamily: Brand.mono,
    fontSize: 13,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  error: {
    color: Brand.red,
    fontFamily: Brand.mono,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  primaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.gold,
    marginTop: 4,
  },
  disabled: {
    opacity: 0.48,
  },
  primaryText: {
    color: Brand.black,
    fontFamily: Brand.mono,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Brand.line,
    marginTop: 10,
  },
  secondaryText: {
    color: Brand.muted,
    fontFamily: Brand.mono,
    fontSize: 11,
    textTransform: 'uppercase',
  },
});
