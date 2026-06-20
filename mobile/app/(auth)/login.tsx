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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fonts, fontSize, spacing } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen() {
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
    const res = magic
      ? await sendMagicLink(email.trim())
      : await signIn(email.trim(), password);
    setLoading(false);
    if (res.error) setError(res.error);
    else if (magic) setNotice('Lien de connexion envoyé. Vérifiez vos emails.');
    // On success the AuthGate handles navigation.
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
          <View style={[styles.mark, { borderColor: colors.borderStrong }]}>
            <Text style={[styles.markText, { color: colors.accent }]}>S</Text>
          </View>
          <Text style={[styles.wordmark, { color: colors.text }]}>Suimini</Text>
          <Text style={[styles.tagline, { color: colors.textMuted }]}>
            Votre arbre généalogique, vivant et partagé
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="vous@exemple.fr"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          {!magic ? (
            <Input
              label="Mot de passe"
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
            label={magic ? 'Envoyer le lien magique' : 'Se connecter'}
            onPress={onSubmit}
            loading={loading}
            style={{ marginTop: spacing.sm }}
          />

          <TouchableOpacity onPress={() => setMagic((m) => !m)} style={styles.switch}>
            <Text style={[styles.switchText, { color: colors.accent }]}>
              {magic ? 'Utiliser un mot de passe' : 'Recevoir un lien magique'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <Button label="Continuer en démo" variant="secondary" onPress={onDemo} />
        {!configured ? (
          <Text style={[styles.hint, { color: colors.textLight }]}>
            Supabase non configuré — mode démo (arbre Famille Dupont).
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={() => router.push('/(auth)/register')}
          style={styles.registerLink}
        >
          <Text style={[styles.registerText, { color: colors.textMuted }]}>
            Pas encore de compte ?{' '}
            <Text style={{ color: colors.accent, fontFamily: fonts.bodyBold }}>
              Créer un compte
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
    width: 56,
    height: 56,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { fontFamily: fonts.display, fontSize: 32 },
  wordmark: { fontFamily: fonts.display, fontSize: fontSize.xxl, marginTop: spacing.xs },
  tagline: { fontFamily: fonts.body, fontSize: fontSize.sm, textAlign: 'center' },
  form: { gap: spacing.md },
  error: { fontFamily: fonts.mono, fontSize: fontSize.sm },
  notice: { fontFamily: fonts.mono, fontSize: fontSize.sm },
  switch: { alignItems: 'center', paddingVertical: spacing.xs },
  switchText: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 0.5 },
  divider: { height: 1.5, marginVertical: spacing.sm },
  hint: { fontFamily: fonts.mono, fontSize: fontSize.xs, textAlign: 'center' },
  registerLink: { alignItems: 'center', paddingVertical: spacing.md },
  registerText: { fontFamily: fonts.body, fontSize: fontSize.base },
});
