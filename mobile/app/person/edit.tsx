import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Trash2, Calendar } from 'lucide-react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { fonts, fontSize, spacing, borderWidth } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useFamilyStore } from '@/hooks/useFamilyStore';
import { generateId } from '@/lib/treeUtils';
import type { Gender, Person } from '@/lib/types';

const pad = (n: number) => String(n).padStart(2, '0');
/** Date → ISO `AAAA-MM-JJ` (stored shape, Supabase-friendly). */
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** ISO → display `JJ/MM/AAAA`, or a placeholder when empty. */
const formatFR = (iso: string) => {
  if (!iso) return 'Non renseignée';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
};
const parseISO = (iso: string): Date => {
  const d = iso ? new Date(`${iso}T00:00:00`) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
};

export default function PersonEditScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { isDemo } = useAuth();
  const { activeTree, getPerson, upsertPerson, removePerson } = useFamilyStore();

  const existing = id ? getPerson(id) : undefined;
  const isEdit = !!existing;

  const [firstName, setFirstName] = useState(existing?.firstName ?? '');
  const [lastName, setLastName] = useState(existing?.lastName ?? '');
  const [gender, setGender] = useState<Gender>(existing?.gender ?? 'male');
  const [birthDate, setBirthDate] = useState(existing?.birthDate ?? '');
  const [deathDate, setDeathDate] = useState(existing?.deathDate ?? '');
  const [birthCity, setBirthCity] = useState(existing?.birthPlace?.city ?? '');
  const [bio, setBio] = useState(existing?.bio ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | 'birth' | 'death'>(null);

  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    const field = picker;
    if (Platform.OS !== 'ios') setPicker(null); // Android closes the dialog itself
    if (event.type === 'dismissed' || !date) return;
    const iso = toISO(date);
    if (field === 'birth') setBirthDate(iso);
    else if (field === 'death') setDeathDate(iso);
  };

  const onSave = async () => {
    setError(null);
    if (!firstName.trim() && !lastName.trim()) {
      setError('Renseignez au moins un prénom ou un nom.');
      return;
    }
    const treeId = activeTree?.id;
    if (!treeId) {
      setError('Aucun arbre actif.');
      return;
    }
    const now = new Date().toISOString();
    const city = birthCity.trim();
    const person: Person = {
      ...(existing ?? {}),
      id: existing?.id ?? generateId(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender,
      birthDate: birthDate.trim() || undefined,
      deathDate: deathDate.trim() || undefined,
      isAlive: !deathDate.trim(),
      birthPlace: city ? { ...(existing?.birthPlace ?? {}), city } : undefined,
      bio: bio.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    setSaving(true);
    const res = await upsertPerson(treeId, person);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Enregistrement impossible.');
      return;
    }
    router.back();
  };

  const onDelete = () => {
    if (!existing || !activeTree?.id) return;
    Alert.alert(
      'Supprimer cette fiche ?',
      `${existing.firstName} ${existing.lastName} sera retiré·e de l'arbre. Cette action est définitive.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const res = await removePerson(activeTree.id, existing.id);
            if (!res.ok) {
              setError(res.error ?? 'Suppression impossible.');
              return;
            }
            router.replace('/(tabs)/people');
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top bar */}
      <View
        style={[
          styles.topbar,
          { paddingTop: insets.top + spacing.xs, borderBottomColor: colors.borderStrong },
        ]}
      >
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.textMuted }]}>
          {isEdit ? 'MODIFIER' : 'NOUVELLE FICHE'}
        </Text>
        {isEdit ? (
          <TouchableOpacity style={styles.iconBtn} onPress={onDelete}>
            <Trash2 size={18} color={colors.danger} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        {isDemo ? (
          <View style={[styles.demoBanner, { borderColor: colors.accent, backgroundColor: colors.accentLight }]}>
            <Text style={[styles.demoText, { color: colors.accent }]}>
              MODE DÉMO — modifications locales, non sauvegardées sur le serveur.
            </Text>
          </View>
        ) : null}

        <Input label="Prénom" value={firstName} onChangeText={setFirstName} placeholder="Marie" />
        <Input label="Nom" value={lastName} onChangeText={setLastName} placeholder="Dupont" />

        {/* Gender toggle */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>GENRE</Text>
          <View style={styles.genderRow}>
            {([
              { key: 'male', label: 'Homme' },
              { key: 'female', label: 'Femme' },
            ] as { key: Gender; label: string }[]).map((g) => {
              const active = gender === g.key;
              return (
                <TouchableOpacity
                  key={g.key}
                  onPress={() => setGender(g.key)}
                  activeOpacity={0.8}
                  style={[
                    styles.genderBtn,
                    {
                      borderColor: colors.borderStrong,
                      backgroundColor: active ? colors.accent : colors.bgCard,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.genderLabel,
                      { color: active ? colors.bg : colors.text },
                    ]}
                  >
                    {g.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Date de naissance */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>DATE DE NAISSANCE</Text>
          <TouchableOpacity
            onPress={() => setPicker('birth')}
            activeOpacity={0.8}
            style={[styles.dateBtn, { borderColor: colors.borderStrong, backgroundColor: colors.bgCard }]}
          >
            <Text style={[styles.dateValue, { color: birthDate ? colors.text : colors.textLight }]}>
              {formatFR(birthDate)}
            </Text>
            <Calendar size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Date de décès */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            DATE DE DÉCÈS (VIDE SI VIVANT·E)
          </Text>
          <View style={styles.dateRow}>
            <TouchableOpacity
              onPress={() => setPicker('death')}
              activeOpacity={0.8}
              style={[styles.dateBtn, styles.dateGrow, { borderColor: colors.borderStrong, backgroundColor: colors.bgCard }]}
            >
              <Text style={[styles.dateValue, { color: deathDate ? colors.text : colors.textLight }]}>
                {formatFR(deathDate)}
              </Text>
              <Calendar size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {deathDate ? (
              <TouchableOpacity
                onPress={() => setDeathDate('')}
                style={[styles.clearBtn, { borderColor: colors.borderStrong }]}
              >
                <Text style={[styles.clearText, { color: colors.danger }]}>Effacer</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Picker (inline iOS, dialog Android) */}
        {picker !== null ? (
          <View>
            <DateTimePicker
              value={parseISO(picker === 'birth' ? birthDate : deathDate)}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'spinner'}
              maximumDate={new Date()}
              onChange={onPickerChange}
            />
            {Platform.OS === 'ios' ? (
              <Button label="Terminé" variant="secondary" onPress={() => setPicker(null)} />
            ) : null}
          </View>
        ) : null}

        <Input label="Lieu de naissance" value={birthCity} onChangeText={setBirthCity} placeholder="Lyon" />
        <Input
          label="Biographie"
          value={bio}
          onChangeText={setBio}
          placeholder="Quelques phrases…"
          multiline
          numberOfLines={4}
          style={styles.bioInput}
        />

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <Button
          label={isEdit ? 'Enregistrer' : 'Créer la fiche'}
          onPress={onSave}
          loading={saving}
          style={{ marginTop: spacing.md }}
        />
        {isEdit ? (
          <Button
            label="Supprimer la fiche"
            variant="secondary"
            icon={<Trash2 size={16} color={colors.danger} />}
            onPress={onDelete}
            style={{ marginTop: spacing.sm, borderColor: colors.danger }}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: borderWidth,
  },
  iconBtn: { padding: spacing.xs, minWidth: 36 },
  topTitle: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 2 },
  body: { padding: spacing.lg, gap: spacing.md },
  demoBanner: { borderWidth, padding: spacing.sm },
  demoText: { fontFamily: fonts.mono, fontSize: fontSize.xs - 1, letterSpacing: 0.5 },
  field: { gap: spacing.xs },
  label: { fontFamily: fonts.mono, fontSize: fontSize.xs - 1, letterSpacing: 1 },
  genderRow: { flexDirection: 'row', gap: spacing.sm },
  genderBtn: {
    flex: 1,
    borderWidth,
    paddingVertical: spacing.md - 2,
    alignItems: 'center',
  },
  genderLabel: { fontFamily: fonts.bodyBold, fontSize: fontSize.base },
  dateRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch' },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
  },
  dateGrow: { flex: 1 },
  dateValue: { fontFamily: fonts.body, fontSize: fontSize.base },
  clearBtn: {
    borderWidth,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  clearText: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 0.5 },
  bioInput: { minHeight: 100, textAlignVertical: 'top' },
  error: { fontFamily: fonts.mono, fontSize: fontSize.sm },
});
