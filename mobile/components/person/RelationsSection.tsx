import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  FlatList,
  Alert,
  type AccessibilityActionEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Plus, Trash2, X, Check } from 'lucide-react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { fonts, fontSize, spacing, borderWidth } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { useFamilyStore } from '@/hooks/useFamilyStore';
import {
  generateId,
  normalizeText,
  getDisplayName,
  getParents,
  getChildren,
  getSpouses,
} from '@/lib/treeUtils';
import type { Person, Relationship } from '@/lib/types';

/**
 * Relationship kinds offered in the "add" sheet. `child` is stored as an
 * inverted `parent` relationship (person1 = parent, person2 = child) — the
 * exact encoding treeUtils/getParents and the web app understand.
 */
type AddKind = 'parent' | 'child' | 'spouse';

/** Kind of an existing relationship from `personId`'s point of view. */
function relKind(rel: Relationship, personId: string): string {
  if (rel.type === 'parent') return rel.person1Id === personId ? 'child' : 'parent';
  if (rel.type === 'child') return rel.person1Id === personId ? 'parent' : 'child';
  return rel.type; // spouse | partner | sibling
}

interface RelationsSectionProps {
  person: Person;
}

/** "Relations" section of the person sheet: list (swipe-to-delete) + add sheet. */
export function RelationsSection({ person }: RelationsSectionProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { activeTree, persons, relationships, addRelationship, removeRelationship } =
    useFamilyStore();

  const [sheetOpen, setSheetOpen] = useState(false);

  const rows = useMemo(
    () =>
      relationships.filter(
        (r) => r.person1Id === person.id || r.person2Id === person.id,
      ),
    [relationships, person.id],
  );

  const kindLabel = (kind: string): string => {
    switch (kind) {
      case 'parent':
        return t('relations.kindParent');
      case 'child':
        return t('relations.kindChild');
      case 'spouse':
        return t('relations.kindSpouse');
      case 'partner':
        return t('relations.kindPartner');
      case 'sibling':
        return t('relations.kindSibling');
      default:
        return kind;
    }
  };

  const confirmDelete = (rel: Relationship, other: Person | undefined) => {
    if (!activeTree) return;
    Alert.alert(
      t('relations.deleteTitle'),
      t('relations.deleteBody', {
        name: other ? getDisplayName(other) : '—',
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const res = await removeRelationship(activeTree.id, rel.id);
            if (!res.ok) {
              Alert.alert(t('relations.errDelete'), res.error ?? '');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.accent }]}>
        {t('relations.title').toUpperCase()}
      </Text>
      <Card elevated padded={false}>
        {rows.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textLight }]}>
            {t('relations.empty')}
          </Text>
        ) : (
          rows.map((rel, i) => {
            const otherId = rel.person1Id === person.id ? rel.person2Id : rel.person1Id;
            const other = persons.find((p) => p.id === otherId);
            const kind = relKind(rel, person.id);
            return (
              <RelationRow
                key={rel.id}
                rel={rel}
                other={other}
                kindLabel={kindLabel(kind)}
                isLast={i === rows.length - 1}
                onDelete={() => confirmDelete(rel, other)}
              />
            );
          })
        )}
      </Card>
      {rows.length > 0 ? (
        <Text style={[styles.hint, { color: colors.textLight }]}>
          {t('relations.swipeHint')}
        </Text>
      ) : null}
      <Button
        label={t('relations.add')}
        variant="secondary"
        icon={<Plus size={16} color={colors.text} />}
        onPress={() => setSheetOpen(true)}
      />
      {sheetOpen ? (
        <AddRelationshipSheet
          person={person}
          persons={persons}
          relationships={relationships}
          onClose={() => setSheetOpen(false)}
          onConfirm={async (rel) => {
            if (!activeTree) return;
            const res = await addRelationship(activeTree.id, rel);
            if (!res.ok) {
              Alert.alert(t('relations.errAdd'), res.error ?? '');
              return;
            }
            setSheetOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

function RelationRow({
  rel,
  other,
  kindLabel,
  isLast,
  onDelete,
}: {
  rel: Relationship;
  other: Person | undefined;
  kindLabel: string;
  isLast: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const renderRightActions = () => (
    <TouchableOpacity
      style={[styles.deleteAction, { backgroundColor: colors.danger }]}
      onPress={onDelete}
      accessibilityRole="button"
      accessibilityLabel={t('relations.deleteAction')}
    >
      <Trash2 size={18} color={colors.bone} />
      <Text style={[styles.deleteActionText, { color: colors.bone }]}>
        {t('common.delete')}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderRightActions}
    >
      <Pressable
        style={[
          styles.relRow,
          { backgroundColor: colors.bgCard },
          !isLast && { borderBottomWidth: borderWidth, borderBottomColor: colors.border },
        ]}
        // Accessible fallback so deletion never depends on the swipe gesture:
        // long-press AND a custom accessibility action both open the confirm.
        onLongPress={onDelete}
        delayLongPress={450}
        accessibilityActions={[{ name: 'delete', label: t('relations.deleteAction') }]}
        onAccessibilityAction={(e: AccessibilityActionEvent) => {
          if (e.nativeEvent.actionName === 'delete') onDelete();
        }}
      >
        {other ? <Avatar person={other} size={36} /> : null}
        <View style={styles.relText}>
          <Text style={[styles.relKind, { color: colors.textLight }]}>
            {kindLabel.toUpperCase()}
          </Text>
          <Text style={[styles.relName, { color: colors.text }]} numberOfLines={1}>
            {other ? getDisplayName(other) : '—'}
          </Text>
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

function AddRelationshipSheet({
  person,
  persons,
  relationships,
  onClose,
  onConfirm,
}: {
  person: Person;
  persons: Person[];
  relationships: Relationship[];
  onClose: () => void;
  onConfirm: (rel: Relationship) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [kind, setKind] = useState<AddKind>('parent');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // People already linked to `person` for the chosen kind → excluded (no dupes).
  const alreadyLinked = useMemo(() => {
    const linked =
      kind === 'parent'
        ? getParents(person.id, relationships, persons)
        : kind === 'child'
          ? getChildren(person.id, relationships, persons)
          : getSpouses(person.id, relationships, persons);
    return new Set(linked.map((p) => p.id));
  }, [kind, person.id, relationships, persons]);

  const candidates = useMemo(() => {
    const q = normalizeText(query);
    return persons.filter((p) => {
      if (p.id === person.id || alreadyLinked.has(p.id)) return false;
      if (!q) return true;
      return normalizeText(`${p.firstName} ${p.lastName}`).includes(q);
    });
  }, [persons, person.id, alreadyLinked, query]);

  const selectKind = (k: AddKind) => {
    setKind(k);
    setSelectedId(null); // the exclusion set changes with the kind
  };

  const confirm = async () => {
    if (!selectedId || saving) return;
    // parent/child are both stored as a 'parent' relationship
    // (person1 = parent, person2 = child) — same encoding as the web app.
    const rel: Relationship =
      kind === 'spouse'
        ? { id: generateId(), type: 'spouse', person1Id: person.id, person2Id: selectedId, isActive: true }
        : kind === 'parent'
          ? { id: generateId(), type: 'parent', person1Id: selectedId, person2Id: person.id }
          : { id: generateId(), type: 'parent', person1Id: person.id, person2Id: selectedId };
    setSaving(true);
    await onConfirm(rel);
    setSaving(false);
  };

  const kinds: { key: AddKind; label: string }[] = [
    { key: 'parent', label: t('relations.typeParent') },
    { key: 'child', label: t('relations.typeChild') },
    { key: 'spouse', label: t('relations.typeSpouse') },
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
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
          {/* Sheet header */}
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.textMuted }]}>
              {t('relations.addTitle')}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Kind selector */}
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('relations.typeLabel')}
          </Text>
          <View style={styles.kindRow}>
            {kinds.map((k) => {
              const active = kind === k.key;
              return (
                <TouchableOpacity
                  key={k.key}
                  onPress={() => selectKind(k.key)}
                  activeOpacity={0.8}
                  style={[
                    styles.kindBtn,
                    {
                      borderColor: colors.borderStrong,
                      backgroundColor: active ? colors.accent : colors.bgCard,
                    },
                  ]}
                >
                  <Text
                    style={[styles.kindLabel, { color: active ? colors.bg : colors.text }]}
                  >
                    {k.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Target person */}
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('relations.withLabel')}
          </Text>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder={t('relations.searchPlaceholder')}
            autoCorrect={false}
          />
          <FlatList
            data={candidates}
            keyExtractor={(p) => p.id}
            style={[styles.list, { borderColor: colors.borderStrong }]}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.textLight }]}>
                {t('relations.noCandidates')}
              </Text>
            }
            renderItem={({ item, index }) => {
              const active = item.id === selectedId;
              return (
                <TouchableOpacity
                  onPress={() => setSelectedId(active ? null : item.id)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.candidateRow,
                    { backgroundColor: active ? colors.accentLight : colors.bgCard },
                    index < candidates.length - 1 && {
                      borderBottomWidth: borderWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Avatar person={item} size={32} />
                  <Text
                    style={[styles.relName, styles.candidateName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {getDisplayName(item)}
                  </Text>
                  {active ? <Check size={18} color={colors.accent} /> : null}
                </TouchableOpacity>
              );
            }}
          />

          <Button
            label={t('relations.confirm')}
            onPress={confirm}
            loading={saving}
            disabled={!selectedId}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5 },
  empty: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    padding: spacing.md,
  },
  hint: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 0.3 },
  relRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  relText: { flex: 1, gap: 2 },
  relKind: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 0.5 },
  relName: { fontFamily: fonts.body, fontSize: fontSize.base },
  deleteAction: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: 2,
  },
  deleteActionText: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 0.5 },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopWidth: borderWidth,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sheetTitle: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 2 },
  closeBtn: { padding: spacing.xs },
  label: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1 },
  kindRow: { flexDirection: 'row', gap: spacing.sm },
  kindBtn: {
    flex: 1,
    borderWidth,
    paddingVertical: spacing.md - 4,
    alignItems: 'center',
  },
  kindLabel: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm },
  list: { borderWidth, minHeight: 120, maxHeight: 260 },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  candidateName: { flex: 1 },
});
