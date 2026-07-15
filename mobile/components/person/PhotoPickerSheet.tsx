/**
 * Bottom-sheet avatar picker (mobile). Two sources — camera / gallery — sans
 * étape d'édition OS forcée (voir plus bas) ; compression happens after, in
 * `uploadAvatarMobile`. Permissions are requested on first use and refusal is
 * handled gracefully (Alert). While the picked photo is compressed + uploaded an
 * ActivityIndicator shows; on success the sheet dismisses immediately (pas
 * d'écran intermédiaire affichant la taille avant/après compression — non
 * actionnable pour l'utilisateur, ça ne faisait qu'ajouter un tap).
 *
 * Style Canopée : sheet arrondie (radius.xl) + poignée, scrim du thème,
 * boutons-source en cartes arrondies avec disque tonal. Tout le texte passe
 * par i18next (`photo.*`).
 */
import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Images, X } from 'lucide-react-native';
import { fonts, fontSize, spacing, radius, shadows, borderWidth } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { uploadAvatarMobile } from '@/lib/uploadImage';

interface PhotoPickerSheetProps {
  visible: boolean;
  /** Person id (or 'new') — used for the Supabase Storage object name. */
  personId: string;
  onClose: () => void;
  /**
   * Final photo uri to store on the person: the Supabase public URL when the
   * upload succeeded, otherwise the local `file://` uri (demo / offline).
   */
  onResult: (uri: string) => void;
}

type Source = 'camera' | 'gallery';

export function PhotoPickerSheet({
  visible,
  personId,
  onClose,
  onResult,
}: PhotoPickerSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [busy, setBusy] = useState(false);

  const close = () => {
    setBusy(false);
    onClose();
  };

  const ensurePermission = async (source: Source): Promise<boolean> => {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('photo.permDeniedTitle'), t('photo.permCameraBody'));
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('photo.permDeniedTitle'), t('photo.permLibraryBody'));
        return false;
      }
    }
    return true;
  };

  const pick = async (source: Source) => {
    if (busy) return;
    const allowed = await ensurePermission(source);
    if (!allowed) return;

    // ⚠️ Pas de `allowsEditing`/`aspect` : sur Android, l'écran système de
    // recadrage déclenché par ces options a été signalé comme bloquant (le
    // bouton "Redimensionner"/validation ne confirme pas la sélection pour
    // certains users/appareils) — symptôme identique à un bug connu de
    // `expo-image-picker` avec l'UI de crop native Android. On saute donc
    // l'édition OS (comme le flux web, qui n'impose pas non plus de crop
    // système) : la photo brute part directement en compression/upload,
    // et `Avatar.tsx` l'affiche déjà en `resizeMode="cover"` (recadrage
    // visuel à l'affichage, quel que soit le ratio source).
    const options: ImagePicker.ImagePickerOptions = {
      quality: 1, // compression happens in uploadAvatarMobile
    };

    let result: ImagePicker.ImagePickerResult;
    try {
      result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
    } catch {
      Alert.alert(t('photo.pickErrorTitle'), t('photo.pickErrorBody'));
      return;
    }

    if (result.canceled || !result.assets?.length) return;
    const localUri = result.assets[0].uri;

    setBusy(true);
    let out;
    try {
      out = await uploadAvatarMobile(localUri, personId);
    } catch {
      out = { error: 'unexpected' as string };
    }
    setBusy(false);

    // Optimistic: use the uploaded URL when available, else the local uri
    // (demo mode, or an upload failure — the photo still shows locally).
    onResult(out?.url ?? localUri);

    if (out?.error) {
      Alert.alert(t('photo.uploadErrorTitle'), t('photo.uploadErrorBody'));
      close();
      return;
    }

    // Uploaded (or demo). Dismiss immediately — the before→after compression
    // size used to be surfaced on an extra "Terminé" confirmation screen, but
    // that info isn't actionable for the user and just adds a tap before the
    // photo shows up on the profile.
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <View
          style={[
            styles.sheet,
            shadows.high,
            {
              backgroundColor: colors.bg,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('photo.title')}
            </Text>
            <TouchableOpacity
              onPress={close}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {busy ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[styles.status, { color: colors.textMuted }]}>
                {t('photo.uploading')}
              </Text>
            </View>
          ) : (
            <View style={styles.options}>
              <SourceButton
                icon={<Camera size={22} color={colors.accent} />}
                label={t('photo.takePhoto')}
                onPress={() => pick('camera')}
                colors={colors}
              />
              <SourceButton
                icon={<Images size={22} color={colors.accent} />}
                label={t('photo.chooseFromGallery')}
                onPress={() => pick('gallery')}
                colors={colors}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function SourceButton({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.sourceBtn, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
    >
      <View style={[styles.iconDisc, { backgroundColor: colors.accentLight }]}>{icon}</View>
      <Text style={[styles.sourceLabel, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  title: { fontFamily: fonts.display, fontSize: fontSize.md },
  closeBtn: { padding: spacing.sm },
  options: { gap: spacing.sm },
  sourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  iconDisc: {
    width: 40,
    height: 40,
    borderRadius: 20, // vrai cercle assumé
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceLabel: { fontFamily: fonts.bodyBold, fontSize: fontSize.base },
  center: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  status: { fontFamily: fonts.body, fontSize: fontSize.sm },
});
