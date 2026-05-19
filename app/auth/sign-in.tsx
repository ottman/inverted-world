import { Link, Stack, router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const submit = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/research');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Sign in / Inverted World' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.panel}>
          <Text style={styles.kicker}>sign in</Text>
          <Text style={styles.title}>Return to the desk.</Text>

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
            disabled={isSubmitting || !email.trim() || !password}
            onPress={submit}
            style={[
              styles.primaryButton,
              (isSubmitting || !email.trim() || !password) && styles.disabled,
            ]}
          >
            <Text style={styles.primaryText}>{isSubmitting ? 'signing in...' : 'sign in'}</Text>
          </Pressable>

          <Link href="/auth/sign-up" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>create account</Text>
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
