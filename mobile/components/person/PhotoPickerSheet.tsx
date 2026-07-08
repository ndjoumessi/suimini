/**
 * Bottom-sheet avatar picker (mobile). Two sources — camera / gallery — both
 * with square editing (`aspect [1,1]`, `quality 1`); compression happens after,
 * in `uploadAvatarMobile`. Permissions are requested on first use and refusal is
 * handled gracefully (Alert). While the picked photo is compressed + uploaded an
 * ActivityIndicator shows; on success the before→after size is surfaced.
 *
 * Atelier styling: theme scrim, hard border, ZERO border-radius (the round
 * source-icon discs are a deliberate "real circle" exception). All copy via
 * i18next (`photo.*`).
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
import { fonts, fontSize, spacing, borderWidth } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { currentLanguage } from '@/lib/i18n';
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

/** Humanized byte size, localized units + decimal separator (fr: "2,3 Mo"). */
function humanBytes(n: number): string {
  const fr = currentLanguage() === 'fr';
  const [mb, kb, b] = fr ? ['Mo', 'Ko', 'o'] : ['MB', 'KB', 'B'];
  const fmt = (v: number) => (fr ? v.toFixed(1).replace('.', ',') : v.toFixed(1));
  if (n >= 1024 * 1024) return `${fmt(n / (1024 * 1024))} ${mb}`;
  if (n >= 1024) return `${Math.round(n / 1024)} ${kb}`;
  return `${n} ${b}`;
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
  const [sizeText, setSizeText] = useState<string | null>(null);

  const close = () => {
    setBusy(false);
    setSizeText(null);
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

    const options: ImagePicker.ImagePickerOptions = {
      allowsEditing: true,
      aspect: [1, 1],
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
    setSizeText(null);
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

    if (out?.beforeBytes && out?.afterBytes && out.beforeBytes !== out.afterBytes) {
      setSizeText(`${humanBytes(out.beforeBytes)} → ${humanBytes(out.afterBytes)}`);
    } else {
      setSizeText(null);
    }

    if (out?.error) {
      Alert.alert(t('photo.uploadErrorTitle'), t('photo.uploadErrorBody'));
      close();
      return;
    }

    // Uploaded (or demo). If we have a size line to show, keep the sheet open on
    // a success state; otherwise dismiss immediately.
    if (out?.beforeBytes && out?.afterBytes && out.beforeBytes !== out.afterBytes) {
      // keep open — user taps Done
    } else {
      close();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bg,
              borderColor: colors.borderStrong,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textMuted }]}>
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
          ) : sizeText ? (
            <View style={styles.center}>
              <Text style={[styles.doneLabel, { color: colors.success }]}>
                {t('photo.done')}
              </Text>
              <Text style={[styles.sizeText, { color: colors.textMuted }]}>
                {t('photo.compressed', { sizes: sizeText })}
              </Text>
              <TouchableOpacity
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel={t('common.done')}
                style={[styles.doneBtn, { borderColor: colors.borderStrong, backgroundColor: colors.accent }]}
              >
                <Text style={[styles.doneBtnText, { color: colors.bg }]}>
                  {t('common.done')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.options}>
              <SourceButton
                icon={<Camera size={22} color={colors.text} />}
                label={t('photo.takePhoto')}
                onPress={() => pick('camera')}
                colors={colors}
              />
              <SourceButton
                icon={<Images size={22} color={colors.text} />}
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
      style={[styles.sourceBtn, { borderColor: colors.borderStrong, backgroundColor: colors.bgCard }]}
    >
      <View style={[styles.iconDisc, { borderColor: colors.borderStrong }]}>{icon}</View>
      <Text style={[styles.sourceLabel, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopWidth: borderWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  title: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 2 },
  closeBtn: { padding: spacing.xs },
  options: { gap: spacing.sm },
  sourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  iconDisc: {
    width: 40,
    height: 40,
    borderRadius: 20, // deliberate "real circle" exception
    borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceLabel: { fontFamily: fonts.bodyBold, fontSize: fontSize.base },
  center: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  status: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 0.5 },
  doneLabel: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5 },
  sizeText: { fontFamily: fonts.mono, fontSize: fontSize.sm, letterSpacing: 0.3 },
  doneBtn: {
    borderWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xs,
  },
  doneBtnText: { fontFamily: fonts.bodyBold, fontSize: fontSize.base },
});
