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
import { ChevronLeft } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fonts, fontSize, spacing } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (password.length < 8) {
      setError(t('auth.register.passwordTooShort'));
      return;
    }
    setLoading(true);
    const res = await signUp(email.trim(), password, name.trim() || undefined);
    setLoading(false);
    if (res.error) setError(res.error);
    else setDone(true);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>{t('common.back')}</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text }]}>{t('auth.register.title')}</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          {t('auth.register.subtitle')}
        </Text>

        {done ? (
          <View style={[styles.doneBox, { borderColor: colors.borderStrong, backgroundColor: colors.bgCard }]}>
            <Text style={[styles.doneTitle, { color: colors.accent }]}>
              {t('auth.register.sentTitle')}
            </Text>
            <Text style={[styles.doneText, { color: colors.text }]}>
              {t('auth.register.sentBody')}
            </Text>
            <Button
              label={t('auth.register.backToLogin')}
              onPress={() => router.replace('/(auth)/login')}
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : (
          <View style={styles.form}>
            <Input
              label={t('auth.register.displayName')}
              value={name}
              onChangeText={setName}
              placeholder={t('auth.register.displayNamePlaceholder')}
              autoCapitalize="words"
            />
            <Input
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.emailPlaceholder')}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Input
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.register.passwordHint')}
              secureTextEntry
              autoCapitalize="none"
            />
            {error ? (
              <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
            ) : null}
            <Button
              label={t('auth.register.submit')}
              onPress={onSubmit}
              loading={loading}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.md },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: spacing.sm },
  backText: { fontFamily: fonts.body, fontSize: fontSize.base },
  title: { fontFamily: fonts.display, fontSize: fontSize.xxl },
  sub: { fontFamily: fonts.body, fontSize: fontSize.base, lineHeight: 22, marginBottom: spacing.sm },
  form: { gap: spacing.md },
  error: { fontFamily: fonts.mono, fontSize: fontSize.sm },
  doneBox: { borderWidth: 1.5, padding: spacing.lg, gap: spacing.sm },
  doneTitle: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5 },
  doneText: { fontFamily: fonts.body, fontSize: fontSize.base, lineHeight: 24 },
});
