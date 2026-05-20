import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useResearchDesk } from '@/contexts/ResearchContext';
import { useAiChat } from '@/hooks/useAiChat';

const prompts = [
  'Show both sides of the UAP disclosure fight.',
  'Find the source documents behind the Bermuda Triangle story.',
  'Turn the latest episode into a viral sourced article outline.',
  'What conspiracy theory deserves a serious document pull today?',
];

export default function ResearchScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const { isAuthenticated } = useAuth();
  const { desk, ensureResearchDesk, isPreparing } = useResearchDesk();
  const { messages, sendMessage, isStreaming } = useAiChat(desk?.agentId ?? null);
  const [input, setInput] = React.useState(params.q ?? '');
  const booted = React.useRef(false);

  React.useEffect(() => {
    if (!isAuthenticated || booted.current) return;
    booted.current = true;
    ensureResearchDesk().catch(() => {});
  }, [ensureResearchDesk, isAuthenticated]);

  const submit = async (value?: string) => {
    const content = (value ?? input).trim();
    if (!content) return;
    if (!isAuthenticated) {
      router.push({ pathname: '/auth/sign-up', params: { q: content } });
      return;
    }
    const researchDesk = await ensureResearchDesk();
    await sendMessage(content, researchDesk.agentId);
    setInput('');
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Inverted World Research' }} />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>truth engine</Text>
          <Text style={styles.title}>Talk to the research desk.</Text>
          <Text style={styles.subtitle}>
            Conspiracy, paranormal, power, documents, counterarguments. Start anywhere.
          </Text>
        </View>

        <ScrollView
          style={styles.chat}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.message,
                message.role === 'user' ? styles.userMessage : styles.assistantMessage,
              ]}
            >
              <Text style={styles.messageRole}>{message.role}</Text>
              <Text style={styles.messageText}>{message.content}</Text>
            </View>
          ))}

          <View style={styles.promptGrid}>
            {prompts.map((prompt) => (
              <Pressable key={prompt} onPress={() => submit(prompt)} style={styles.prompt}>
                <Text style={styles.promptText}>{prompt}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything..."
            placeholderTextColor={Brand.faint}
            multiline
            style={styles.input}
            onSubmitEditing={() => submit()}
          />
          <Pressable
            disabled={isStreaming || isPreparing}
            onPress={() => submit()}
            style={[styles.send, (isStreaming || isPreparing) && styles.sendDisabled]}
          >
            <MaterialIcons name="arrow-upward" size={18} color={Brand.black} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingVertical: 22,
    gap: 12,
  },
  header: {
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: 'rgba(5,5,5,0.34)',
    padding: 16,
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
    fontSize: 28,
    lineHeight: 34,
    marginTop: 8,
  },
  subtitle: {
    color: Brand.muted,
    fontFamily: Brand.mono,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  chat: {
    flex: 1,
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: 'rgba(5,5,5,0.26)',
  },
  chatContent: {
    padding: 14,
    gap: 12,
  },
  message: {
    maxWidth: 820,
    borderWidth: 1,
    padding: 14,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    borderColor: Brand.line,
    backgroundColor: 'rgba(0,0,0,0.26)',
  },
  userMessage: {
    alignSelf: 'flex-end',
    borderColor: Brand.lineStrong,
    backgroundColor: 'rgba(232,180,92,0.12)',
  },
  messageRole: {
    color: Brand.faint,
    fontFamily: Brand.mono,
    fontSize: 9,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  messageText: {
    color: Brand.text,
    fontFamily: Brand.mono,
    fontSize: 13,
    lineHeight: 21,
  },
  promptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  prompt: {
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: 'rgba(0,0,0,0.24)',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  promptText: {
    color: Brand.muted,
    fontFamily: Brand.mono,
    fontSize: 10,
  },
  composer: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: Brand.lineStrong,
    backgroundColor: 'rgba(0,0,0,0.54)',
    paddingLeft: 14,
  },
  input: {
    flex: 1,
    maxHeight: 132,
    minHeight: 58,
    color: Brand.text,
    fontFamily: Brand.mono,
    fontSize: 13,
    lineHeight: 20,
    paddingTop: 18,
  },
  send: {
    width: 56,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.gold,
  },
  sendDisabled: {
    opacity: 0.5,
  },
});
