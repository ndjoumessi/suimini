import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BrandMark } from '@/components/Brand';
import { fonts, fontSize, spacing, shadows } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, sendMagicLink, startDemo, configured } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [magic, setMagic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = magic
        ? await sendMagicLink(email.trim())
        : await signIn(email.trim(), password);
      if (res.error) setError(res.error);
      else if (magic) setNotice(t('auth.magicSent'));
      // On success the AuthGate handles navigation.
    } catch (e: any) {
      // Should not happen (useAuth catches internally) but guards against an
      // uncaught promise rejection if a transport error ever escapes.
      console.error('LOGIN ERROR', JSON.stringify(e), e?.message, e?.status);
      setError(e?.message ?? t('common.connectionFailed'));
    } finally {
      setLoading(false);
    }
  };

  const onDemo = () => {
    startDemo();
    router.replace('/(tabs)/home');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Wordmark */}
        <View style={styles.brand}>
          <View style={[styles.mark, shadows.low]}>
            <BrandMark size={64} color={colors.text} accent={colors.accent} surface={colors.accentLight} />
          </View>
          <Text style={[styles.wordmark, { color: colors.text }]}>Suimini</Text>
          <Text style={[styles.tagline, { color: colors.textMuted }]}>
            {t('auth.tagline')}
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.emailPlaceholder')}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          {!magic ? (
            <Input
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
            />
          ) : null}

          {error ? (
            <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
          ) : null}
          {notice ? (
            <Text style={[styles.notice, { color: colors.success }]}>{notice}</Text>
          ) : null}

          <Button
            label={magic ? t('auth.magicSend') : t('auth.signIn')}
            onPress={onSubmit}
            loading={loading}
            style={{ marginTop: spacing.sm }}
          />

          <TouchableOpacity
            onPress={() => setMagic((m) => !m)}
            style={styles.switch}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={[styles.switchText, { color: colors.accent }]}>
              {magic ? t('auth.usePassword') : t('auth.useMagic')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <Button label={t('auth.continueDemo')} variant="secondary" onPress={onDemo} />
        {!configured ? (
          <Text style={[styles.hint, { color: colors.textLight }]}>
            {t('auth.demoHint')}
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={() => router.push('/(auth)/register')}
          style={styles.registerLink}
        >
          <Text style={[styles.registerText, { color: colors.textMuted }]}>
            {t('auth.noAccount')}{' '}
            <Text style={{ color: colors.accent, fontFamily: fonts.bodyBold }}>
              {t('auth.createAccount')}
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  brand: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  mark: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { fontFamily: fonts.display, fontSize: fontSize.xxl, marginTop: spacing.xs },
  tagline: { fontFamily: fonts.body, fontSize: fontSize.base, textAlign: 'center' },
  form: { gap: spacing.md },
  error: { fontFamily: fonts.bodyMedium, fontSize: fontSize.sm },
  notice: { fontFamily: fonts.bodyMedium, fontSize: fontSize.sm },
  switch: { alignItems: 'center', paddingVertical: spacing.sm, minHeight: 40, justifyContent: 'center' },
  switchText: { fontFamily: fonts.bodyMedium, fontSize: fontSize.sm },
  divider: { height: 1, marginVertical: spacing.sm },
  hint: { fontFamily: fonts.body, fontSize: fontSize.sm, textAlign: 'center' },
  registerLink: { alignItems: 'center', paddingVertical: spacing.md, minHeight: 48, justifyContent: 'center' },
  registerText: { fontFamily: fonts.body, fontSize: fontSize.base },
});
