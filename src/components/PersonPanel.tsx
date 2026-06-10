'use client';
import { useState, useEffect, useRef, useMemo, useId } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Person, FamilyTree, Relationship, RelationType, FamilyEvent, EventType, Note, Citation, DnaOrigin, AiNarrative } from '@/types';
import { getParents, getChildren, getSpouses, getSiblings, getAge, formatDate, formatYear, getDisplayName, generateId, safeHttpUrl } from '@/lib/treeUtils';
import { personEras, type HistoricalEvent } from '@/lib/history';
import { fetchComments, addComment, subscribeComments, collaborationEnabled, type PersonComment, fetchPendingSuggestions, addSuggestion, resolveSuggestion, type PersonSuggestion } from '@/lib/collaboration';
import { useAuth } from '@/hooks/useAuth';
import ReactMarkdown from 'react-markdown';
import PersonForm from './PersonForm';
import { X, Pencil, Trash2, User, Clock, Users, Calendar, StickyNote, BookOpen, Lightbulb, Link2, AlertCircle, Dna, FileText, Images, ScanFace, ScanLine, Landmark, MessageSquare, MapPin, Briefcase, Globe, GraduationCap, Church, Baby, Skull, Heart, Swords, Plane, GripVertical, CalendarDays } from 'lucide-react';

interface Props {
  person: Person;
  tree: FamilyTree;
  onClose: () => void;
  onUpdate: (updates: Partial<Person>) => void;
  onDelete: () => void;
  onSelectPerson: (id: string) => void;
  onAddRelationship: (rel: Omit<Relationship, 'id'>) => Relationship | null;
  onUpdateRelationship: (relId: string, updates: Partial<Relationship>) => void;
  onDeleteRelationship: (relId: string) => void;
  /** Open the AI face-recognition analyzer, pre-selecting this person. */
  onAnalyzePhoto?: () => void;
  /** Open the document scanner pre-associated to this person (#5C). */
  onScanDocument?: () => void;
  /** Surface a transient toast (passed by the parent). */
  onToast?: (msg: string, type?: string) => void;
}

// Visually-hidden but screen-reader-accessible (no .sr-only utility in globals.css).
const SR_ONLY: React.CSSProperties = { position:'absolute', width:'1px', height:'1px', padding:0, margin:'-1px', overflow:'hidden', clip:'rect(0,0,0,0)', whiteSpace:'nowrap', border:0 };

const EVENT_TYPES: EventType[] = ['birth','death','marriage','divorce','baptism','graduation','military','immigration','other'];
/** Emoji icons kept for SVG timeline text nodes (cannot render React components in SVG text). */
const EVENT_ICONS: Record<string, string> = { birth:'✦', death:'†', marriage:'♡', divorce:'↔', baptism:'✟', graduation:'✎', military:'⚔', immigration:'↗', other:'·' };
/** Returns the Lucide icon component for an event type (for use in React JSX, not SVG text). */
function EventIcon({ type, size = 13 }: { type: string; size?: number }) {
  const icons: Record<string, typeof Calendar> = {
    birth: Baby, death: Skull, marriage: Heart, divorce: X, baptism: Church,
    graduation: GraduationCap, military: Swords, immigration: Plane, other: Calendar,
  };
  const Icon = icons[type] ?? Calendar;
  return <Icon size={size} aria-hidden="true" />;
}

// Built-in event types we have translated labels for (others fall back to the raw type string).
const KNOWN_EVENT_TYPES = new Set<string>(EVENT_TYPES);
const REL_TYPES: RelationType[] = ['spouse', 'partner', 'parent', 'child', 'sibling'];
const REL_LABEL_KEYS: Record<RelationType, string> = { spouse: 'relSpouse', partner: 'relPartner', parent: 'relParent', child: 'relChild', sibling: 'relSibling' };

// Person fields a member can suggest editing (must have a `suggestions.fields.<f>` label).
const SUGGESTABLE_FIELDS = ['firstName','lastName','maidenName','birthDate','deathDate','birthPlace','occupation','nationality','religion','education','bio'] as const;
type SuggestableField = typeof SUGGESTABLE_FIELDS[number];

// Atelier-styled Markdown renderers for AI récits (display-font headings,
// terracotta uppercase sub-labels, --font-body paragraphs). Inline styles only.
const MD_COMPONENTS = {
  h1: (props: { children?: React.ReactNode }) => (
    <h2 className="serif" style={{ margin:'0 0 10px', fontSize:'1.1rem', lineHeight:1.3, color:'var(--text)' }}>{props.children}</h2>
  ),
  h2: (props: { children?: React.ReactNode }) => (
    <div className="label" style={{ color:'var(--accent)', margin:'16px 0 6px' }}>{props.children}</div>
  ),
  h3: (props: { children?: React.ReactNode }) => (
    <div className="label" style={{ color:'var(--accent)', margin:'14px 0 6px' }}>{props.children}</div>
  ),
  p: (props: { children?: React.ReactNode }) => (
    <p style={{ margin:'0 0 12px', fontFamily:'var(--font-body)', fontSize:'14px', lineHeight:1.7, color:'var(--text)' }}>{props.children}</p>
  ),
  strong: (props: { children?: React.ReactNode }) => (
    <strong style={{ fontWeight:700, color:'var(--ink, var(--text))' }}>{props.children}</strong>
  ),
  em: (props: { children?: React.ReactNode }) => (
    <em style={{ fontStyle:'italic' }}>{props.children}</em>
  ),
  ul: (props: { children?: React.ReactNode }) => (
    <ul style={{ margin:'0 0 12px', paddingLeft:'20px', fontFamily:'var(--font-body)', fontSize:'14px', lineHeight:1.7, color:'var(--text)' }}>{props.children}</ul>
  ),
  ol: (props: { children?: React.ReactNode }) => (
    <ol style={{ margin:'0 0 12px', paddingLeft:'20px', fontFamily:'var(--font-body)', fontSize:'14px', lineHeight:1.7, color:'var(--text)' }}>{props.children}</ol>
  ),
  li: (props: { children?: React.ReactNode }) => (
    <li style={{ marginBottom:'4px' }}>{props.children}</li>
  ),
};

export default function PersonPanel({ person, tree, onClose, onUpdate, onDelete, onSelectPerson, onAddRelationship, onUpdateRelationship, onDeleteRelationship, onAnalyzePhoto, onScanDocument, onToast }: Props) {
  const t = useTranslations('personPanel');
  const tp = useTranslations('photoAnalyzer');
  const tn = useTranslations('narrative');
  const tc = useTranslations('collaboration');
  const ts = useTranslations('suggestions');
  const to = useTranslations('ocr');
  const locale = useLocale();
  const { user } = useAuth();
  const relLabel = (type: RelationType) => t(REL_LABEL_KEYS[type]);
  const eventTypeLabel = (type: string) =>
    KNOWN_EVENT_TYPES.has(type) ? t(`event_${type}`) : (type.charAt(0).toUpperCase() + type.slice(1));
  const [tab, setTab] = useState<'profile'|'life'|'family'|'events'|'notes'|'sources'|'gallery'|'narrative'|'discussion'|'edit'>('profile');
  const [eraEvent, setEraEvent] = useState<HistoricalEvent | null>(null);
  const eras = personEras(person);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAddRel, setShowAddRel] = useState(false);
  const [newRelType, setNewRelType] = useState<RelationType>('spouse');
  const [newRelPersonId, setNewRelPersonId] = useState('');
  const [editRelId, setEditRelId] = useState<string|null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<FamilyEvent>>({ type: 'other' });
  const [editEventId, setEditEventId] = useState<string|null>(null);
  const [customEventType, setCustomEventType] = useState('');
  const [dragIndex, setDragIndex] = useState<number|null>(null);
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editNoteId, setEditNoteId] = useState<string|null>(null);
  const [showAddCitation, setShowAddCitation] = useState(false);
  const [newCitation, setNewCitation] = useState<Partial<Citation>>({});
  // --- Narrative tab (#3B/#3C) ---
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState(false);
  const [comparePersonId, setComparePersonId] = useState('');
  const [compareNarrative, setCompareNarrative] = useState<string | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  // --- Discussion tab (#4B) ---
  const [comments, setComments] = useState<PersonComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  // --- Edit suggestions (Discussion tab) ---
  const [suggestions, setSuggestions] = useState<PersonSuggestion[]>([]);
  const [showSuggestForm, setShowSuggestForm] = useState(false);
  const [suggestField, setSuggestField] = useState<SuggestableField>('firstName');
  const [suggestValue, setSuggestValue] = useState('');
  const [sendingSuggestion, setSendingSuggestion] = useState(false);
  // The panel is remounted per person (keyed by id in the parent), so transient UI resets naturally.

  // Stable ids for associating labels with the Discussion inputs (accessibility).
  const baseId = useId();
  const commentFieldId = `${baseId}-comment`;
  const suggestFieldId = `${baseId}-suggest-field`;
  const suggestValueId = `${baseId}-suggest-value`;

  const reducedMotion = useReducedMotion();

  const commentsEnabled = collaborationEnabled() && !!user;
  const commentAuthor = user
    ? { id: user.id, name: (user.user_metadata?.display_name as string) || user.email || 'Anonyme' }
    : null;

  // Load + subscribe to comments when the Discussion tab is active for this person.
  useEffect(() => {
    if (tab !== 'discussion' || !commentsEnabled) return;
    let active = true;
    fetchComments(tree.id, person.id).then(rows => { if (active) setComments(rows); });
    const unsubscribe = subscribeComments(person.id, c =>
      setComments(prev => prev.some(x => x.id === c.id) ? prev : [...prev, c]),
    );
    return () => { active = false; unsubscribe(); };
  }, [tab, commentsEnabled, tree.id, person.id]);

  // Load pending edit suggestions when the Discussion tab is active for this person.
  useEffect(() => {
    if (tab !== 'discussion' || !commentsEnabled) return;
    let active = true;
    fetchPendingSuggestions(tree.id, person.id).then(rows => { if (active) setSuggestions(rows); });
    return () => { active = false; };
  }, [tab, commentsEnabled, tree.id, person.id]);

  // Resolve a key into a translated field label; fall back to the raw field name.
  function fieldLabel(field: string): string {
    const known = (SUGGESTABLE_FIELDS as readonly string[]).includes(field);
    return known ? ts(`fields.${field}`) : field;
  }

  // Current value of a Person field as a string (or null) for diffing in a suggestion.
  function currentFieldValue(field: SuggestableField): string | null {
    if (field === 'birthPlace') return person.birthPlace?.city || null;
    const v = person[field];
    return typeof v === 'string' && v ? v : null;
  }

  async function acceptSuggestion(s: PersonSuggestion) {
    const f = s.field;
    if (f === 'birthPlace') {
      onUpdate({ birthPlace: { ...person.birthPlace, city: s.suggestedValue } });
    } else if ((SUGGESTABLE_FIELDS as readonly string[]).includes(f)) {
      onUpdate({ [f]: s.suggestedValue } as Partial<Person>);
    }
    // Unknown fields: skip the person update but still resolve below.
    const ok = await resolveSuggestion(s.id, 'accepted');
    if (ok) {
      setSuggestions(prev => prev.filter(x => x.id !== s.id));
      onToast?.(ts('accepted'));
    }
  }

  async function rejectSuggestion(s: PersonSuggestion) {
    const ok = await resolveSuggestion(s.id, 'rejected');
    if (ok) {
      setSuggestions(prev => prev.filter(x => x.id !== s.id));
      onToast?.(ts('rejected'), 'info');
    }
  }

  async function submitSuggestion() {
    if (!commentAuthor || !suggestValue.trim() || sendingSuggestion) return;
    setSendingSuggestion(true);
    const saved = await addSuggestion({
      treeId: tree.id,
      personId: person.id,
      field: suggestField,
      currentValue: currentFieldValue(suggestField),
      suggestedValue: suggestValue.trim(),
      author: commentAuthor,
    });
    if (saved) {
      setSuggestValue('');
      setShowSuggestForm(false);
      const rows = await fetchPendingSuggestions(tree.id, person.id);
      setSuggestions(rows);
      onToast?.(ts('sent'));
    }
    setSendingSuggestion(false);
  }

  async function generateNarrative(force = false) {
    if (narrativeLoading) return;
    if (!force && person.aiNarrative) return; // never regenerate when already present
    setNarrativeLoading(true);
    setNarrativeError(false);
    try {
      const res = await fetch('/api/narrative-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person, tree, type: 'biography' }),
      });
      if (!res.ok) throw new Error('request failed');
      const data = (await res.json()) as { narrative: string; questions: string[] };
      const narrative: AiNarrative = { text: data.narrative, questions: data.questions || [], generatedAt: new Date().toISOString() };
      onUpdate({ aiNarrative: narrative });
    } catch {
      setNarrativeError(true);
    } finally {
      setNarrativeLoading(false);
    }
  }

  async function runCompare(otherId: string) {
    setComparePersonId(otherId);
    setCompareNarrative(null);
    if (!otherId) return;
    const comparePerson = tree.persons.find(p => p.id === otherId);
    if (!comparePerson) return;
    setCompareLoading(true);
    try {
      const res = await fetch('/api/narrative-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person, tree, type: 'compare', comparePerson }),
      });
      if (!res.ok) throw new Error('request failed');
      const data = (await res.json()) as { narrative: string; questions?: string[] };
      setCompareNarrative(data.narrative); // transient — not persisted to aiNarrative
    } catch {
      setCompareNarrative(null);
      setNarrativeError(true);
    } finally {
      setCompareLoading(false);
    }
  }

  async function copyNarrative() {
    if (!person.aiNarrative?.text) return;
    try {
      await navigator.clipboard.writeText(person.aiNarrative.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  }

  async function submitComment() {
    if (!commentAuthor || !newComment.trim() || sendingComment) return;
    setSendingComment(true);
    const saved = await addComment(tree.id, person.id, newComment, commentAuthor);
    if (saved) {
      // Realtime INSERT may also echo this — dedupe by id.
      setComments(prev => prev.some(x => x.id === saved.id) ? prev : [...prev, saved]);
      setNewComment('');
    }
    setSendingComment(false);
  }

  const parents = getParents(person.id, tree.relationships, tree.persons);
  const children = getChildren(person.id, tree.relationships, tree.persons);
  const spouses = getSpouses(person.id, tree.relationships, tree.persons);
  const siblings = getSiblings(person.id, tree.relationships, tree.persons);
  const age = getAge(person.birthDate, person.deathDate);

  // --- Profile completeness (smart completion) ---
  const completionChecks = [
    { label: t('completionProfilePhoto'), has: !!person.profilePhoto, impact: t('completionProfilePhotoImpact') },
    { label: t('completionBirthDate'), has: !!person.birthDate, impact: t('completionBirthDateImpact') },
    { label: t('completionBirthPlace'), has: !!person.birthPlace?.city, impact: t('completionBirthPlaceImpact') },
    { label: t('completionDeathDate'), has: person.isAlive || !!person.deathDate, impact: t('completionDeathDateImpact') },
    { label: t('completionOccupation'), has: !!person.occupation, impact: t('completionOccupationImpact') },
    { label: t('completionBio'), has: !!(person.bio && person.bio.trim()), impact: t('completionBioImpact') },
  ];
  const completionMissing = completionChecks.filter(c => !c.has);
  const completionScore = Math.round((completionChecks.length - completionMissing.length) / completionChecks.length * 100);
  const completionColor = completionScore < 40 ? 'var(--danger)' : completionScore < 70 ? 'var(--warning)' : 'var(--success)';

  const availablePersons = tree.persons.filter(p =>
    p.id !== person.id &&
    !tree.relationships.some(r =>
      (r.person1Id === person.id && r.person2Id === p.id) ||
      (r.person2Id === person.id && r.person1Id === p.id)
    )
  );

  // Other tree members available for the comparative narrative (#3C).
  const availableComparePersons = useMemo(
    () => tree.persons.filter(p => p.id !== person.id),
    [tree.persons, person.id],
  );
  const comparePerson = useMemo(
    () => tree.persons.find(p => p.id === comparePersonId) || null,
    [tree.persons, comparePersonId],
  );

  // --- All raw relationships involving this person (for management) ---
  const myRelationships = tree.relationships.filter(r => r.person1Id === person.id || r.person2Id === person.id);
  const relCount = myRelationships.length;
  const personById = (id: string) => tree.persons.find(p => p.id === id);

  // Inconsistency detection: self-links + simple ancestor loops.
  const inconsistencies: string[] = [];
  myRelationships.forEach(r => {
    if (r.person1Id === r.person2Id) {
      inconsistencies.push(t('inconsistencySelfRel', { name: person.firstName, rel: relLabel(r.type) }));
    }
  });
  // Detect an ancestor cycle (person is its own ancestor) — iterative to stay render-pure.
  const ancestorLoop = (() => {
    const seen = new Set<string>();
    const stack = getParents(person.id, tree.relationships, tree.persons).map(p => p.id);
    while (stack.length) {
      const id = stack.pop()!;
      if (id === person.id) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      getParents(id, tree.relationships, tree.persons).forEach(p => stack.push(p.id));
    }
    return false;
  })();
  if (ancestorLoop) inconsistencies.push(t('inconsistencyAncestorLoop', { name: person.firstName }));

  function addEvent() {
    const type = (customEventType.trim() ? customEventType.trim() : newEvent.type) as EventType;
    if (!type) return;
    const events = [...(person.events || []), { ...newEvent, type, id: generateId() } as FamilyEvent];
    onUpdate({ events });
    setNewEvent({ type: 'other' });
    setCustomEventType('');
    setShowAddEvent(false);
  }
  function updateEvent(eventId: string, updates: Partial<FamilyEvent>) {
    onUpdate({ events: (person.events || []).map(e => e.id === eventId ? { ...e, ...updates } : e) });
  }
  function removeEvent(eventId: string) {
    onUpdate({ events: (person.events || []).filter(e => e.id !== eventId) });
  }
  function reorderEvents(from: number, to: number) {
    const arr = [...(person.events || [])];
    if (from < 0 || to < 0 || from >= arr.length || to >= arr.length || from === to) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    onUpdate({ events: arr });
  }
  function sortEventsByDate() {
    const arr = [...(person.events || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    onUpdate({ events: arr });
  }
  function addNote() {
    if (!newNoteContent.trim()) return;
    const now = new Date().toISOString();
    const notes = [...(person.notes || []), { id: generateId(), content: newNoteContent.trim(), createdAt: now, updatedAt: now } as Note];
    onUpdate({ notes });
    setNewNoteContent('');
    setShowAddNote(false);
  }
  function updateNote(noteId: string, content: string) {
    const notes = (person.notes || []).map(n => n.id === noteId ? { ...n, content, updatedAt: new Date().toISOString() } : n);
    onUpdate({ notes });
    setEditNoteId(null);
  }
  function removeNote(noteId: string) {
    onUpdate({ notes: (person.notes || []).filter(n => n.id !== noteId) });
  }

  function addCitation() {
    if (!newCitation.title?.trim()) return;
    const citations = [...(person.citations || []), {
      id: generateId(),
      title: newCitation.title.trim(),
      author: newCitation.author?.trim() || undefined,
      year: newCitation.year?.trim() || undefined,
      // Only persist safe http(s) URLs (blocks javascript:/data: schemes).
      url: safeHttpUrl(newCitation.url),
    } as Citation];
    onUpdate({ citations });
    setNewCitation({});
    setShowAddCitation(false);
  }
  function removeCitation(citationId: string) {
    onUpdate({ citations: (person.citations || []).filter(c => c.id !== citationId) });
  }

  function PersonLink({ p }: { p: Person }) {
    return (
      <button onClick={() => onSelectPerson(p.id)}
        style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px', border:'none', background:'var(--bg-muted)', borderRadius:'var(--radius)', cursor:'pointer', textAlign:'left', transition:'background 0.1s', width:'100%' }}
        onMouseEnter={e => e.currentTarget.style.background='var(--accent-light)'}
        onMouseLeave={e => e.currentTarget.style.background='var(--bg-muted)'}
      >
        <span style={{ flexShrink:0, color: p.gender==='male'?'var(--male)':p.gender==='female'?'var(--female)':'var(--text-muted)' }}><User size={16} aria-hidden="true" /></span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:'13px', fontWeight:'700', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{getDisplayName(p)}</div>
          <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>
            {p.birthDate?new Date(p.birthDate).getFullYear():''}
            {!p.isAlive&&p.deathDate?` – ${new Date(p.deathDate).getFullYear()}`:''}
            {p.occupation?` · ${p.occupation}`:''}
          </div>
        </div>
        <span style={{ fontSize:'12px', color:'var(--text-light)' }}>→</span>
      </button>
    );
  }

  return (
    <aside className="person-panel" style={{
      width:'360px', flexShrink:0, height:'100%', background:'var(--bg-card)',
      borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column',
      boxShadow:'var(--shadow-lg)', zIndex:60,
    }}>
      {/* Header (sticky) */}
      <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', flexShrink:0, position:'sticky', top:0, background:'var(--bg-card)', zIndex:2 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
          <CompletionDonut score={completionScore} color={completionColor} />
          <div style={{ flex:1 }} />
          <button onClick={()=>setTab('edit')} className="icon-btn" aria-label={t('edit')} title={t('edit')}><Pencil size={16} /></button>
          <button onClick={()=>{ setTab('edit'); setConfirmDelete(true); }} className="icon-btn" aria-label={t('delete')} title={t('delete')} style={{ color:'var(--danger)' }}><Trash2 size={16} /></button>
          <button onClick={onClose} className="icon-btn" aria-label={t('closePanel')} title={t('close')}><X size={18} /></button>
        </div>
        <div style={{ display:'flex', alignItems:'flex-start', gap:'12px' }}>
          <div style={{ width:'56px', height:'56px', borderRadius:'50%', flexShrink:0, overflow:'hidden',
            background: person.gender==='male'?'color-mix(in srgb, var(--male) 16%, var(--bg-card))':person.gender==='female'?'color-mix(in srgb, var(--female) 16%, var(--bg-card))':'var(--bg-muted)',
            display:'flex', alignItems:'center', justifyContent:'center',
            border:`3px solid ${person.gender==='male'?'var(--male)':person.gender==='female'?'var(--female)':'var(--border)'}`,
            fontSize:'18px', fontWeight:700, color: person.gender==='male'?'var(--male)':person.gender==='female'?'var(--female)':'var(--text-muted)'
          }}>
            {person.profilePhoto
              ? <img src={person.profilePhoto} alt={t('profilePhotoAlt', { name: getDisplayName(person) })} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : `${(person.firstName[0]||'').toUpperCase()}${(person.lastName[0]||'').toUpperCase()}`}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <h2 className="serif" style={{ margin:'0 0 4px', fontSize:'1.2rem', lineHeight:1.25 }}>
              {person.firstName} {person.maidenName?`(${person.maidenName}) `:''}{person.lastName}
            </h2>
            {person.nickName && <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'4px', fontStyle:'italic' }}>«&nbsp;{person.nickName}&nbsp;»</div>}
            <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
              <span className={`badge badge-${person.gender==='male'?'male':person.gender==='female'?'female':'accent'}`}>
                {person.gender==='male'?t('genderMale'):person.gender==='female'?t('genderFemale'):person.gender==='other'?t('genderOther'):'—'}
              </span>
              <span className={`badge badge-${person.isAlive?'alive':'deceased'}`}>
                {person.isAlive?t('alive'):t('deceased')}
              </span>
              {age!==null&&<span className="badge badge-accent">{t('ageYears', { age })}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ margin:'0 14px', paddingTop:'4px', overflowX:'auto', flexShrink:0 }}>
        {([
          { id:'profile', Icon:User },
          { id:'life', Icon:Clock },
          { id:'family', Icon:Users },
          { id:'events', Icon:Calendar, count:person.events?.length },
          { id:'notes', Icon:StickyNote, count:person.notes?.length },
          { id:'sources', Icon:BookOpen, count:person.citations?.length },
          { id:'gallery', Icon:Images, count:person.photos?.length },
          { id:'narrative', Icon:BookOpen },
          { id:'discussion', Icon:MessageSquare },
          { id:'edit', Icon:Pencil },
        ] as { id: typeof tab; Icon: typeof User; count?: number }[]).map(({ id, Icon, count }) => {
          const tabLabel = id==='narrative' ? tn('tab') : id==='discussion' ? tc('tab') : t(`tab_${id}`);
          return (
          <button key={id} onClick={() => setTab(id as typeof tab)} className={`tab ${tab===id?'active':''}`} style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'8px 10px', whiteSpace:'nowrap', fontSize:'13px' }} aria-label={tabLabel} title={tabLabel}>
            <Icon size={15} aria-hidden="true" />{count?<span className="mono" style={{ fontSize:'11px' }}>{count}</span>:null}
          </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ padding:'14px 18px 24px', flex:1, overflowY:'auto' }}>

        {tab==='profile' && (
          <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {/* Smart completion banner */}
            {completionMissing.length > 0 && (
              <div style={{ padding:'12px', background:'var(--accent-light)', border:'1px solid var(--border)', borderRadius:'var(--radius)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                  <span style={{ fontSize:'13px', fontWeight:700, display:'inline-flex', alignItems:'center', gap:'5px' }}><Lightbulb size={14} aria-hidden="true" /> {t('suggestions')}</span>
                  <span style={{ fontSize:'13px', fontWeight:700, color:completionColor }}>{completionScore}%</span>
                </div>
                <div style={{ height:'7px', background:'var(--bg-muted)', borderRadius:'100px', overflow:'hidden', marginBottom:'10px' }}>
                  <div style={{ width:`${completionScore}%`, height:'100%', background:completionColor, transition:'width 0.3s' }} />
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                  {completionMissing.map(c => (
                    <div key={c.label} style={{ fontSize:'12px', display:'flex', gap:'6px', lineHeight:1.4 }}>
                      <span style={{ color:'var(--danger)', flexShrink:0 }}>○</span>
                      <span><strong>{c.label}</strong> <span style={{ color:'var(--text-muted)' }}>— {c.impact}</span></span>
                    </div>
                  ))}
                </div>
                <button onClick={()=>setTab('edit')} className="btn btn-primary btn-sm" style={{ marginTop:'10px' }}><Pencil size={13} /> {t('completeProfile')}</button>
              </div>
            )}
            <InfoBlock label={t('birth')} Icon={Baby}>
              {formatDate(person.birthDate, person.birthDateApprox)||'—'}
              {person.birthPlace?.city&&<><br/><small style={{ display:'inline-flex', alignItems:'center', gap:'3px' }}><MapPin size={10} aria-hidden="true" /> {[person.birthPlace.city, person.birthPlace.country].filter(Boolean).join(', ')}</small></>}
            </InfoBlock>
            {!person.isAlive&&(
              <InfoBlock label={t('death')} Icon={Skull}>
                {formatDate(person.deathDate, person.deathDateApprox)||'—'}
                {person.deathPlace?.city&&<><br/><small style={{ display:'inline-flex', alignItems:'center', gap:'3px' }}><MapPin size={10} aria-hidden="true" /> {[person.deathPlace.city, person.deathPlace.country].filter(Boolean).join(', ')}</small></>}
              </InfoBlock>
            )}
            {/* Historical context — eras this person lived through (clickable) */}
            {eras.length>0&&(
              <div>
                <div className="label" style={{ color:'var(--text-light)', marginBottom:'6px', display:'inline-flex', alignItems:'center', gap:'5px' }}>
                  <Landmark size={12} aria-hidden="true" /> {t('historicalContext')}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                  {eras.map(ev=>(
                    <button
                      key={ev.id}
                      onClick={()=>setEraEvent(ev)}
                      title={ev[locale==='en'?'en':'fr'].context}
                      style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'4px 10px', background:'var(--bg-card)', border:'1.5px solid var(--border-strong)', borderRadius:'var(--radius)', cursor:'pointer', font:'inherit', fontSize:'12px', fontWeight:700, color:'var(--text)', transition:'transform 0.12s, box-shadow 0.12s' }}
                      onMouseEnter={e=>{e.currentTarget.style.transform='translate(-1px,-1px)';e.currentTarget.style.boxShadow='var(--shadow-sm)';}}
                      onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}}
                    >
                      {ev[locale==='en'?'en':'fr'].label}
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:'10px', color:'var(--accent)' }}>{ev[locale==='en'?'en':'fr'].short}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              {person.occupation&&<InfoBlock label={t('occupation')} Icon={Briefcase}>{person.occupation}</InfoBlock>}
              {person.nationality&&<InfoBlock label={t('nationality')} Icon={Globe}>{person.nationality}</InfoBlock>}
              {person.religion&&<InfoBlock label={t('religion')} Icon={Church}>{person.religion}</InfoBlock>}
              {person.education&&<InfoBlock label={t('education')} Icon={GraduationCap}>{person.education}</InfoBlock>}
            </div>
            {person.bio&&(
              <div style={{ padding:'12px', background:'var(--bg-muted)', borderRadius:'var(--radius)', borderLeft:'3px solid var(--accent)' }}>
                <div style={{ fontSize:'11px', color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>{t('biography')}</div>
                <p style={{ margin:0, fontSize:'13px', lineHeight:'1.7' }}>{person.bio}</p>
              </div>
            )}
            {person.tags&&person.tags.length>0&&(
              <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                {person.tags.map(tag=><span key={tag} className="badge badge-accent">#{tag}</span>)}
              </div>
            )}
            {person.dnaOrigins&&person.dnaOrigins.length>0&&(
              <div style={{ padding:'12px', background:'var(--bg-muted)', borderRadius:'var(--radius)' }}>
                <div style={{ fontSize:'11px', color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'10px', display:'flex', alignItems:'center', gap:'5px' }}><Dna size={12} aria-hidden="true" /> {t('originsAndDna')}</div>
                <DnaPie origins={person.dnaOrigins} />
              </div>
            )}
            {person.customFields&&Object.keys(person.customFields).length>0&&(
              <div>
                <div style={{ fontSize:'11px', color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>{t('customFields')}</div>
                {Object.entries(person.customFields).map(([k,v])=>(
                  <div key={k} style={{ display:'flex', gap:'8px', marginBottom:'4px', fontSize:'13px' }}>
                    <span style={{ fontWeight:'700', minWidth:'100px' }}>{k}:</span>
                    <span style={{ color:'var(--text-muted)' }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab==='life' && (
          <div className="animate-fade-in">
            <LifeTimeline person={person} />
          </div>
        )}

        {tab==='family' && (
          <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            {spouses.length>0&&<FamilySection title={t('spousesPartners')} items={spouses} PersonLink={PersonLink} />}
            {parents.length>0&&<FamilySection title={t('parents')} items={parents} PersonLink={PersonLink} />}
            {children.length>0&&<FamilySection title={t('childrenSection')} items={children} PersonLink={PersonLink} />}
            {siblings.length>0&&<FamilySection title={t('siblings')} items={siblings} PersonLink={PersonLink} />}
            {spouses.length===0&&parents.length===0&&children.length===0&&siblings.length===0&&(
              <div style={{ textAlign:'center', padding:'20px', color:'var(--text-muted)' }}>{t('noRelationships')}</div>
            )}

            {/* Inconsistency warnings */}
            {inconsistencies.length>0 && (
              <div style={{ padding:'10px 12px', background:'var(--bg-muted)', border:'1.5px solid var(--danger)', borderRadius:'var(--radius)' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:'var(--danger)', marginBottom:'4px', display:'flex', alignItems:'center', gap:'5px' }}><AlertCircle size={13} aria-hidden="true" /> {t('inconsistentRelations')}</div>
                {inconsistencies.map((msg,i)=>(
                  <div key={i} style={{ fontSize:'12px', color:'var(--text)', lineHeight:1.4 }}>• {msg}</div>
                ))}
              </div>
            )}

            {/* Manage raw relationships */}
            {myRelationships.length>0 && (
              <div>
                <div style={{ fontSize:'12px', fontWeight:'700', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>
                  {t('manageRelations', { count: myRelationships.length })}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                  {myRelationships.map(rel => {
                    const otherId = rel.person1Id === person.id ? rel.person2Id : rel.person1Id;
                    const other = personById(otherId);
                    const self = rel.person1Id === rel.person2Id;
                    const dates = [rel.startDate && t('relSince', { date: formatDate(rel.startDate) }), rel.endDate && t('relUntil', { date: formatDate(rel.endDate) })].filter(Boolean).join(' · ');
                    return (
                      <div key={rel.id} style={{ padding:'10px', background:'var(--bg-muted)', borderRadius:'var(--radius)', border:`1px solid ${self?'var(--danger)':'var(--border)'}` }}>
                        {editRelId===rel.id ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                            <select defaultValue={rel.type} id={`rel-type-${rel.id}`} className="input">
                              {REL_TYPES.map(rt=><option key={rt} value={rt}>{relLabel(rt)}</option>)}
                            </select>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}>
                              <input type="date" defaultValue={rel.startDate||''} id={`rel-start-${rel.id}`} className="input" title={t('start')} />
                              <input type="date" defaultValue={rel.endDate||''} id={`rel-end-${rel.id}`} className="input" title={t('end')} />
                            </div>
                            <input defaultValue={rel.notes||''} id={`rel-notes-${rel.id}`} className="input" placeholder={t('notesOptional')} />
                            <div style={{ display:'flex', gap:'6px' }}>
                              <button onClick={()=>{
                                const type=(document.getElementById(`rel-type-${rel.id}`) as HTMLSelectElement).value as RelationType;
                                const startDate=(document.getElementById(`rel-start-${rel.id}`) as HTMLInputElement).value||undefined;
                                const endDate=(document.getElementById(`rel-end-${rel.id}`) as HTMLInputElement).value||undefined;
                                const notes=(document.getElementById(`rel-notes-${rel.id}`) as HTMLInputElement).value||undefined;
                                onUpdateRelationship(rel.id,{type,startDate,endDate,notes});
                                setEditRelId(null);
                              }} className="btn btn-primary btn-sm">{t('save')}</button>
                              <button onClick={()=>setEditRelId(null)} className="btn btn-ghost btn-sm">{t('cancel')}</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:'13px', fontWeight:700 }}>
                                {relLabel(rel.type)} <span style={{ color:'var(--text-muted)', fontWeight:400 }}>{other?getDisplayName(other):t('unknownPerson')}</span>
                              </div>
                              {dates && <div style={{ fontSize:'11px', color:'var(--text-light)' }}>{dates}</div>}
                              {rel.notes && <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'2px', display:'flex', alignItems:'center', gap:'5px' }}><FileText size={11} aria-hidden="true" /> {rel.notes}</div>}
                            </div>
                            <button onClick={()=>setEditRelId(rel.id)} className="btn btn-ghost btn-sm" style={{ fontSize:'12px' }}><Pencil size={13} /></button>
                            <button onClick={()=>onDeleteRelationship(rel.id)} className="btn btn-ghost btn-sm" style={{ fontSize:'12px', color:'var(--danger)' }}><Trash2 size={13} /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!showAddRel ? (
              <button onClick={()=>setShowAddRel(true)} className="btn btn-secondary btn-sm" style={{ alignSelf:'flex-start' }}>+ {t('addRelation')}</button>
            ) : (
              <div style={{ padding:'12px', background:'var(--bg-muted)', borderRadius:'var(--radius)' }} className="animate-fade-in">
                <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'8px' }}>
                  <select value={newRelType} onChange={e=>setNewRelType(e.target.value as RelationType)} className="input">
                    <option value="spouse">{t('relSpouse')}</option>
                    <option value="partner">{t('relPartner')}</option>
                    <option value="parent">{t('relIsParentOf')}</option>
                    <option value="child">{t('relIsChildOf')}</option>
                    <option value="sibling">{t('relSibling')}</option>
                  </select>
                  <select value={newRelPersonId} onChange={e=>setNewRelPersonId(e.target.value)} className="input">
                    <option value="">{t('choosePerson')}</option>
                    {availablePersons.map(p=><option key={p.id} value={p.id}>{getDisplayName(p)}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  <button onClick={()=>{ if(newRelPersonId){onAddRelationship({type:newRelType,person1Id:person.id,person2Id:newRelPersonId}); setShowAddRel(false); setNewRelPersonId(''); }}} className="btn btn-primary btn-sm" disabled={!newRelPersonId}>{t('add')}</button>
                  <button onClick={()=>setShowAddRel(false)} className="btn btn-ghost btn-sm">{t('cancel')}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab==='events' && (
          <div className="animate-fade-in">
            {(!person.events||person.events.length===0) ? (
              <div style={{ textAlign:'center', padding:'20px', color:'var(--text-muted)' }}>{t('noEvents')}</div>
            ) : (
              <>
                <div style={{ fontSize:'11px', color:'var(--text-light)', marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span>↕ {t('dragToReorder')}</span>
                  <button onClick={sortEventsByDate} className="btn btn-ghost btn-sm" style={{ fontSize:'11px', gap:'5px' }}><CalendarDays size={13} aria-hidden="true" /> {t('sortByDate')}</button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'12px' }}>
                  {(person.events||[]).map((event, idx)=>(
                    <div key={event.id}
                      draggable={editEventId!==event.id}
                      onDragStart={()=>setDragIndex(idx)}
                      onDragOver={e=>e.preventDefault()}
                      onDrop={()=>{ if(dragIndex!==null) reorderEvents(dragIndex, idx); setDragIndex(null); }}
                      style={{ padding:'10px', background:'var(--bg-muted)', borderRadius:'var(--radius)', border:'1px solid var(--border)', opacity: dragIndex===idx?0.5:1 }}
                    >
                      {editEventId===event.id ? (
                        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}>
                            <input defaultValue={event.type} id={`ev-type-${event.id}`} className="input" placeholder={t('type')} list="event-types-list" />
                            <input type="date" defaultValue={event.date||''} id={`ev-date-${event.id}`} className="input" />
                            <input defaultValue={event.place?.city||''} id={`ev-city-${event.id}`} className="input" placeholder={t('city')} />
                            <input defaultValue={event.place?.country||''} id={`ev-country-${event.id}`} className="input" placeholder={t('country')} />
                          </div>
                          <input defaultValue={event.description||''} id={`ev-desc-${event.id}`} className="input" placeholder={t('description')} />
                          <div style={{ display:'flex', gap:'6px' }}>
                            <button onClick={()=>{
                              const type=((document.getElementById(`ev-type-${event.id}`) as HTMLInputElement).value.trim()||'other') as EventType;
                              const date=(document.getElementById(`ev-date-${event.id}`) as HTMLInputElement).value||undefined;
                              const city=(document.getElementById(`ev-city-${event.id}`) as HTMLInputElement).value;
                              const country=(document.getElementById(`ev-country-${event.id}`) as HTMLInputElement).value;
                              const description=(document.getElementById(`ev-desc-${event.id}`) as HTMLInputElement).value||undefined;
                              updateEvent(event.id,{type,date,description,place:(city||country)?{city,country}:undefined});
                              setEditEventId(null);
                            }} className="btn btn-primary btn-sm">{t('save')}</button>
                            <button onClick={()=>setEditEventId(null)} className="btn btn-ghost btn-sm">{t('cancel')}</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
                          <div style={{ display:'flex', gap:'8px', alignItems:'flex-start' }}>
                            <GripVertical size={14} aria-hidden="true" style={{ cursor:'grab', color:'var(--text-light)', flexShrink:0 }} />
                            <div>
                              <div style={{ fontWeight:'700', fontSize:'13px', display:'flex', alignItems:'center', gap:'5px' }}>
                                <EventIcon type={event.type} /> {eventTypeLabel(event.type)}
                              </div>
                              {event.date&&<div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{formatDate(event.date, event.dateApprox)}</div>}
                              {event.place?.city&&<div style={{ fontSize:'12px', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:'3px' }}><MapPin size={10} aria-hidden="true" /> {[event.place.city, event.place.country].filter(Boolean).join(', ')}</div>}
                              {event.description&&<div style={{ fontSize:'13px', marginTop:'4px' }}>{event.description}</div>}
                            </div>
                          </div>
                          <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
                            <button onClick={()=>setEditEventId(event.id)} className="btn btn-ghost btn-sm" style={{ fontSize:'12px' }}><Pencil size={13} /></button>
                            <button onClick={()=>removeEvent(event.id)} className="btn btn-ghost btn-sm" style={{ color:'var(--danger)', fontSize:'12px' }}><Trash2 size={13} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <datalist id="event-types-list">
                  {EVENT_TYPES.map(et=><option key={et} value={et}>{eventTypeLabel(et)}</option>)}
                </datalist>
              </>
            )}
            {!showAddEvent ? (
              <button onClick={()=>setShowAddEvent(true)} className="btn btn-secondary btn-sm">+ {t('addEvent')}</button>
            ) : (
              <div style={{ padding:'12px', background:'var(--bg-muted)', borderRadius:'var(--radius)' }} className="animate-fade-in">
                <h4 style={{ margin:'0 0 10px', fontSize:'13px' }}>{t('newEvent')}</h4>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
                  <select value={customEventType ? '__custom__' : newEvent.type} onChange={e=>{ if(e.target.value==='__custom__'){ setCustomEventType(' '); } else { setCustomEventType(''); setNewEvent(v=>({...v,type:e.target.value as EventType})); } }} className="input">
                    {EVENT_TYPES.map(et=><option key={et} value={et}>{EVENT_ICONS[et]} {eventTypeLabel(et)}</option>)}
                    <option value="__custom__">✎ {t('customType')}</option>
                  </select>
                  <input type="date" value={newEvent.date||''} onChange={e=>setNewEvent(v=>({...v,date:e.target.value||undefined}))} className="input" placeholder={t('dateLabel')}/>
                  <input value={newEvent.place?.city||''} onChange={e=>setNewEvent(v=>({...v,place:{...v.place,city:e.target.value}}))} className="input" placeholder={t('city')}/>
                  <input value={newEvent.place?.country||''} onChange={e=>setNewEvent(v=>({...v,place:{...v.place,country:e.target.value}}))} className="input" placeholder={t('country')}/>
                </div>
                {customEventType!=='' && (
                  <input autoFocus value={customEventType.trim()===''?'':customEventType} onChange={e=>setCustomEventType(e.target.value||' ')} className="input" placeholder={t('customTypePlaceholder')} style={{ marginBottom:'8px', width:'100%' }}/>
                )}
                <input value={newEvent.description||''} onChange={e=>setNewEvent(v=>({...v,description:e.target.value}))} className="input" placeholder={t('descriptionOptional')} style={{ marginBottom:'8px', width:'100%' }}/>
                <div style={{ display:'flex', gap:'6px' }}>
                  <button onClick={addEvent} className="btn btn-primary btn-sm">{t('add')}</button>
                  <button onClick={()=>{setShowAddEvent(false);setCustomEventType('');}} className="btn btn-ghost btn-sm">{t('cancel')}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab==='notes' && (
          <div className="animate-fade-in">
            <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'12px' }}>
              {(!person.notes||person.notes.length===0) ? (
                <div style={{ textAlign:'center', padding:'20px', color:'var(--text-muted)' }}>{t('noNotes')}</div>
              ) : (
                person.notes.map(note=>(
                  <div key={note.id} style={{ padding:'12px', background:'var(--bg-muted)', borderRadius:'var(--radius)', border:'1px solid var(--border)' }}>
                    {editNoteId===note.id ? (
                      <div>
                        <textarea defaultValue={note.content} autoFocus id={`note-edit-${note.id}`} className="input" rows={3} style={{ resize:'vertical', marginBottom:'6px', width:'100%' }} />
                        <div style={{ display:'flex', gap:'6px' }}>
                          <button onClick={()=>{ const ta = document.getElementById(`note-edit-${note.id}`) as HTMLTextAreaElement; updateNote(note.id, ta.value); }} className="btn btn-primary btn-sm">{t('save')}</button>
                          <button onClick={()=>setEditNoteId(null)} className="btn btn-ghost btn-sm">{t('cancel')}</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p style={{ margin:'0 0 8px', fontSize:'13px', lineHeight:'1.6' }}>{note.content}</p>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <div style={{ fontSize:'11px', color:'var(--text-light)' }}>
                            {new Date(note.updatedAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', {day:'numeric',month:'short',year:'numeric'})}
                          </div>
                          <div style={{ display:'flex', gap:'4px' }}>
                            <button onClick={()=>setEditNoteId(note.id)} className="btn btn-ghost btn-sm" style={{ fontSize:'11px' }}><Pencil size={13} /></button>
                            <button onClick={()=>removeNote(note.id)} className="btn btn-ghost btn-sm" style={{ fontSize:'11px', color:'var(--danger)' }}><Trash2 size={13} /></button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
            {!showAddNote ? (
              <button onClick={()=>setShowAddNote(true)} className="btn btn-secondary btn-sm">+ {t('addNote')}</button>
            ) : (
              <div style={{ padding:'12px', background:'var(--bg-muted)', borderRadius:'var(--radius)' }} className="animate-fade-in">
                <textarea autoFocus value={newNoteContent} onChange={e=>setNewNoteContent(e.target.value)} className="input" rows={3} style={{ resize:'vertical', marginBottom:'8px', width:'100%' }} placeholder={t('noteplaceholder')} />
                <div style={{ display:'flex', gap:'6px' }}>
                  <button onClick={addNote} className="btn btn-primary btn-sm" disabled={!newNoteContent.trim()}>{t('add')}</button>
                  <button onClick={()=>{setShowAddNote(false);setNewNoteContent('');}} className="btn btn-ghost btn-sm">{t('cancel')}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab==='sources' && (
          <div className="animate-fade-in">
            {onScanDocument && (
              <button onClick={onScanDocument} className="btn btn-secondary btn-sm" style={{ width:'100%', justifyContent:'center', gap:'7px', marginBottom:'12px' }}>
                <ScanLine size={14} aria-hidden="true" /> {to('scanButton')}
              </button>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'12px' }}>
              {(!person.citations||person.citations.length===0) ? (
                <div style={{ textAlign:'center', padding:'20px', color:'var(--text-muted)' }}>{t('noSources')}</div>
              ) : (
                person.citations.map(citation=>(
                  <div key={citation.id} style={{ padding:'12px', background:'var(--bg-muted)', borderRadius:'var(--radius)', border:'1px solid var(--border)', borderLeft:'3px solid var(--accent)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:'700', fontSize:'13px', lineHeight:1.4, display:'flex', alignItems:'center', gap:'5px' }}><BookOpen size={13} aria-hidden="true" /> {citation.title}</div>
                        <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'2px' }}>
                          {[citation.author, citation.year].filter(Boolean).join(' · ')}
                        </div>
                        {safeHttpUrl(citation.url) && (
                          <a href={safeHttpUrl(citation.url)} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize:'12px', color:'var(--accent)', wordBreak:'break-all', display:'inline-flex', alignItems:'center', gap:'5px', marginTop:'4px' }}>
                            <Link2 size={12} aria-hidden="true" /> {citation.url}
                          </a>
                        )}
                      </div>
                      <button onClick={()=>removeCitation(citation.id)} className="btn btn-ghost btn-sm" style={{ fontSize:'11px', color:'var(--danger)', flexShrink:0 }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {!showAddCitation ? (
              <button onClick={()=>setShowAddCitation(true)} className="btn btn-secondary btn-sm">+ {t('addSource')}</button>
            ) : (
              <div style={{ padding:'12px', background:'var(--bg-muted)', borderRadius:'var(--radius)' }} className="animate-fade-in">
                <h4 style={{ margin:'0 0 10px', fontSize:'13px' }}>{t('newSource')}</h4>
                <input autoFocus value={newCitation.title||''} onChange={e=>setNewCitation(v=>({...v,title:e.target.value}))} className="input" placeholder={t('sourceTitlePlaceholder')} style={{ marginBottom:'8px', width:'100%' }} />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
                  <input value={newCitation.author||''} onChange={e=>setNewCitation(v=>({...v,author:e.target.value}))} className="input" placeholder={t('authorRepository')} />
                  <input value={newCitation.year||''} onChange={e=>setNewCitation(v=>({...v,year:e.target.value}))} className="input" placeholder={t('year')} />
                </div>
                <input value={newCitation.url||''} onChange={e=>setNewCitation(v=>({...v,url:e.target.value}))} className="input" placeholder={t('urlPlaceholder')} style={{ marginBottom:'8px', width:'100%' }} />
                <div style={{ display:'flex', gap:'6px' }}>
                  <button onClick={addCitation} className="btn btn-primary btn-sm" disabled={!newCitation.title?.trim()}>{t('add')}</button>
                  <button onClick={()=>{setShowAddCitation(false);setNewCitation({});}} className="btn btn-ghost btn-sm">{t('cancel')}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab==='gallery' && (
          <div className="animate-fade-in">
            {onAnalyzePhoto && (
              <button onClick={onAnalyzePhoto} className="btn btn-secondary btn-sm" style={{ width:'100%', justifyContent:'center', gap:'7px', marginBottom:'12px' }}>
                <ScanFace size={14} aria-hidden="true" /> {tp('analyzeAPhoto')}
              </button>
            )}
            {(person.photos && person.photos.length > 0) ? (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'8px' }}>
                {person.photos.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt={t('galleryPhotoAlt', { name: person.firstName, index: i+1 })}
                    style={{ width:'100%', aspectRatio:'1', objectFit:'cover', border:'1.5px solid var(--border-strong)', borderRadius:'var(--radius)' }} />
                ))}
              </div>
            ) : (
              <div style={{ textAlign:'center', padding:'40px 16px', color:'var(--text-muted)', display:'flex', flexDirection:'column', alignItems:'center', gap:'10px' }}>
                <Images size={40} strokeWidth={1.2} aria-hidden="true" />
                <p style={{ margin:0, fontSize:'13px' }}>{t('noPhotos')}</p>
                <button onClick={()=>setTab('edit')} className="btn btn-secondary btn-sm"><Pencil size={13} /> {t('addPhotos')}</button>
              </div>
            )}
          </div>
        )}

        {tab==='narrative' && (
          <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            {/* Header action */}
            <div>
              {!person.aiNarrative && !narrativeLoading ? (
                <button onClick={()=>generateNarrative(false)} className="btn btn-primary btn-sm" style={{ width:'100%', justifyContent:'center', gap:'7px' }}>
                  <BookOpen size={14} aria-hidden="true" /> {tn('generate', { name: person.firstName })}
                </button>
              ) : person.aiNarrative ? (
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', minWidth:0 }}>
                  <button onClick={()=>generateNarrative(true)} className="btn btn-secondary btn-sm" disabled={narrativeLoading} aria-label={tn('regenerate')}>
                    {tn('regenerate')}
                  </button>
                  <button onClick={copyNarrative} className="btn btn-ghost btn-sm" aria-label={tn('copy')}>
                    {copied ? tn('copied') : tn('copy')}
                  </button>
                  {/* Announce the copy result to screen readers without a visual change. */}
                  <span aria-live="polite" style={SR_ONLY}>{copied ? tn('copied') : ''}</span>
                </div>
              ) : null}
            </div>

            {/* Loading */}
            {narrativeLoading && (
              <div role="status" aria-live="polite" style={{ display:'flex', alignItems:'center', gap:'10px', padding:'14px', background:'var(--bg-muted)', borderRadius:'var(--radius)', color:'var(--text-muted)', fontSize:'13px' }}>
                <Spinner /> {tn('generating')}
              </div>
            )}

            {/* Error */}
            {narrativeError && !narrativeLoading && (
              <div role="alert" style={{ padding:'10px 12px', background:'var(--bg-muted)', border:'1.5px solid var(--danger)', borderRadius:'var(--radius)', fontSize:'12px', color:'var(--danger)', display:'flex', alignItems:'center', gap:'6px' }}>
                <AlertCircle size={13} aria-hidden="true" /> {tn('error')}
              </div>
            )}

            {/* Narrative text (Markdown) */}
            {person.aiNarrative && !narrativeLoading && (
              <div>
                <ReactMarkdown components={MD_COMPONENTS}>{person.aiNarrative.text}</ReactMarkdown>
              </div>
            )}

            {/* Questions to go deeper */}
            {person.aiNarrative && person.aiNarrative.questions.length > 0 && !narrativeLoading && (
              <div>
                <div className="label" style={{ color:'var(--text-light)', marginBottom:'8px' }}>{tn('questions')}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {person.aiNarrative.questions.map((q, i) => (
                    <button key={i} type="button" onClick={()=>setTab('edit')}
                      aria-label={`${q} · ${t('tab_edit')}`}
                      style={{ textAlign:'left', padding:'10px 12px', background:'var(--bg-card)', border:'1.5px solid var(--border-strong)', borderRadius:'var(--radius)', boxShadow:'var(--shadow-sm)', cursor:'pointer', font:'inherit', fontSize:'13px', lineHeight:1.5, color:'var(--text)', display:'flex', gap:'8px', alignItems:'flex-start', minWidth:0, transition: reducedMotion ? 'none' : 'transform 0.12s' }}
                      onMouseEnter={e=>{ if(!reducedMotion) e.currentTarget.style.transform='translate(-1px,-1px)'; }}
                      onMouseLeave={e=>{ e.currentTarget.style.transform='none'; }}
                    >
                      <Lightbulb size={14} aria-hidden="true" style={{ color:'var(--accent)', flexShrink:0, marginTop:'2px' }} />
                      <span style={{ minWidth:0, overflowWrap:'anywhere' }}>{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Comparative narrative (#3C) */}
            {person.aiNarrative && !narrativeLoading && availableComparePersons.length > 0 && (
              <div>
                <select value={comparePersonId} onChange={e=>runCompare(e.target.value)} className="input" aria-label={tn('compareWith')}>
                  <option value="">{tn('compareWith')}</option>
                  {availableComparePersons.map(p => <option key={p.id} value={p.id}>{getDisplayName(p)}</option>)}
                </select>
                {compareLoading && (
                  <div role="status" aria-live="polite" style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 0', color:'var(--text-muted)', fontSize:'13px' }}>
                    <Spinner /> {tn('generating')}
                  </div>
                )}
                {compareNarrative && !compareLoading && comparePerson && (
                  <div style={{ marginTop:'12px' }}>
                    <div className="label" style={{ color:'var(--accent)', marginBottom:'8px' }}>
                      {tn('compare', { a: person.firstName, b: comparePerson.firstName })}
                    </div>
                    <ReactMarkdown components={MD_COMPONENTS}>{compareNarrative}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {!person.aiNarrative && !narrativeLoading && !narrativeError && (
              <div style={{ textAlign:'center', padding:'12px 16px', color:'var(--text-muted)', fontSize:'13px' }}>{tn('empty')}</div>
            )}
          </div>
        )}

        {tab==='discussion' && (
          <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:'12px', height:'100%' }}>
            {!commentsEnabled ? (
              <div style={{ textAlign:'center', padding:'24px 16px', color:'var(--text-muted)', fontSize:'13px' }}>{tc('loginToComment')}</div>
            ) : (
              <>
                <div style={{ display:'flex', flexDirection:'column', gap:'10px', flex:1, overflowY:'auto' }}>
                  {comments.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'20px', color:'var(--text-muted)', fontSize:'13px' }}>{tc('noComments')}</div>
                  ) : (
                    comments.map(c => {
                      const name = c.authorName || 'Anonyme';
                      const initials = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
                      return (
                        <div key={c.id} style={{ display:'flex', gap:'8px', alignItems:'flex-start' }}>
                          <div style={{ width:'30px', height:'30px', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--accent-light)', color:'var(--accent)', border:'1.5px solid var(--border-strong)', borderRadius:'var(--radius)', fontSize:'11px', fontWeight:700 }}>
                            {initials || '?'}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', gap:'6px', alignItems:'baseline', flexWrap:'wrap' }}>
                              <span style={{ fontSize:'12.5px', fontWeight:700 }}>{name}</span>
                              <span style={{ fontSize:'11px', color:'var(--text-light)' }}>
                                {new Date(c.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                              </span>
                            </div>
                            <p style={{ margin:'2px 0 0', fontSize:'13px', lineHeight:1.5, color:'var(--text)', wordBreak:'break-word' }}>{c.content}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div style={{ flexShrink:0, borderTop:'1px solid var(--border)', paddingTop:'10px' }}>
                  <label htmlFor={commentFieldId} style={SR_ONLY}>{tc('placeholder')}</label>
                  <textarea id={commentFieldId} value={newComment} onChange={e=>setNewComment(e.target.value)} className="input" rows={2} style={{ resize:'vertical', width:'100%', marginBottom:'8px' }} placeholder={tc('placeholder')} />
                  <button onClick={submitComment} className="btn btn-primary btn-sm" disabled={!newComment.trim() || sendingComment} aria-label={tc('comment')}>
                    {sendingComment ? tc('sending') : tc('comment')}
                  </button>
                  <span aria-live="polite" style={SR_ONLY}>{sendingComment ? tc('sending') : ''}</span>
                </div>

                {/* Edit suggestions (accept / reject + suggest form) */}
                <div style={{ flexShrink:0, borderTop:'1px solid var(--border)', paddingTop:'12px', display:'flex', flexDirection:'column', gap:'10px' }}>
                  <div className="label" style={{ color:'var(--text-light)' }}>{ts('title')}</div>
                  {suggestions.length === 0 ? (
                    <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{ts('none')}</div>
                  ) : (
                    suggestions.map(s => (
                      <div key={s.id} style={{ padding:'10px 12px', background:'var(--bg-card)', border:'1.5px solid var(--border-strong)', borderRadius:'var(--radius)', boxShadow:'var(--shadow-sm)' }}>
                        <div style={{ fontSize:'12px', fontWeight:700, color:'var(--text)', marginBottom:'4px' }}>
                          {ts('suggestsBy', { author: s.authorName || '?' })}
                        </div>
                        <div style={{ fontSize:'13px', lineHeight:1.5, color:'var(--text)', marginBottom:'8px' }}>
                          <strong>{fieldLabel(s.field)}</strong> : <span style={{ color:'var(--text-muted)' }}>{s.currentValue || ts('empty')}</span> → <span style={{ color:'var(--accent)', fontWeight:700 }}>{s.suggestedValue}</span>
                        </div>
                        <div style={{ display:'flex', gap:'6px' }}>
                          <button onClick={()=>acceptSuggestion(s)} className="btn btn-primary btn-sm">{ts('accept')}</button>
                          <button onClick={()=>rejectSuggestion(s)} className="btn btn-ghost btn-sm">{ts('reject')}</button>
                        </div>
                      </div>
                    ))
                  )}

                  {!showSuggestForm ? (
                    <button onClick={()=>setShowSuggestForm(true)} className="btn btn-secondary btn-sm" style={{ alignSelf:'flex-start' }}>
                      <Pencil size={13} aria-hidden="true" /> {ts('suggest')}
                    </button>
                  ) : (
                    <div className="animate-fade-in" style={{ padding:'12px', background:'var(--bg-muted)', borderRadius:'var(--radius)', display:'flex', flexDirection:'column', gap:'8px' }}>
                      <select value={suggestField} onChange={e=>setSuggestField(e.target.value as SuggestableField)} className="input" aria-label={ts('field')}>
                        {SUGGESTABLE_FIELDS.map(f => <option key={f} value={f}>{ts(`fields.${f}`)}</option>)}
                      </select>
                      <input value={suggestValue} onChange={e=>setSuggestValue(e.target.value)} className="input" placeholder={ts('newValue')} />
                      <div style={{ display:'flex', gap:'6px' }}>
                        <button onClick={submitSuggestion} className="btn btn-primary btn-sm" disabled={!suggestValue.trim() || sendingSuggestion}>{ts('send')}</button>
                        <button onClick={()=>{ setShowSuggestForm(false); setSuggestValue(''); }} className="btn btn-ghost btn-sm">{ts('cancel')}</button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {tab==='edit' && (
          <div className="animate-fade-in">
            <PersonForm initial={person} onSave={(updates)=>{onUpdate(updates);setTab('profile');}} onCancel={()=>setTab('profile')} />
            <hr className="divider"/>
            {!confirmDelete ? (
              <button onClick={()=>setConfirmDelete(true)} className="btn btn-danger btn-sm"><Trash2 size={14} /> {t('deletePerson')}</button>
            ) : (
              <div style={{ padding:'12px', background:'var(--bg-muted)', border:'1.5px solid var(--danger)', borderRadius:'var(--radius)' }}>
                <p style={{ margin:'0 0 10px', fontSize:'13px', color:'var(--text)', display:'flex', alignItems:'flex-start', gap:'6px' }}>
                  <AlertCircle size={15} style={{ color:'var(--danger)', flexShrink:0, marginTop:'2px' }} aria-hidden="true" /> <span>{t.rich('deleteConfirm', { name: getDisplayName(person), strong: (c) => <strong>{c}</strong> })}
                  {relCount > 0
                    ? <> {t.rich('deleteConfirmRelations', { count: relCount, strong: (c) => <strong>{c}</strong> })}</>
                    : <> {t('deleteConfirmNoRelations')}</>}</span>
                </p>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={onDelete} className="btn btn-danger btn-sm">{t('confirmDelete')}</button>
                  <button onClick={()=>setConfirmDelete(false)} className="btn btn-ghost btn-sm">{t('cancel')}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Historical context popup (#3C) */}
      {eraEvent && (
        <div
          onMouseDown={e=>{ if(e.target===e.currentTarget) setEraEvent(null); }}
          style={{ position:'fixed', inset:0, zIndex:2100, background:'var(--scrim, rgba(27,22,18,0.55))', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}
          role="dialog" aria-modal="true" aria-label={eraEvent[locale==='en'?'en':'fr'].label}
        >
          <div className="card animate-scale-in" style={{ maxWidth:'420px', padding:'22px' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', marginBottom:'10px' }}>
              <h3 className="serif" style={{ margin:0, fontSize:'1.15rem', display:'flex', alignItems:'center', gap:'8px' }}>
                <Landmark size={18} aria-hidden="true" style={{ color:'var(--accent)', flexShrink:0 }} />
                {eraEvent[locale==='en'?'en':'fr'].label}
              </h3>
              <button onClick={()=>setEraEvent(null)} className="icon-btn" aria-label={t('close')}><X size={18} /></button>
            </div>
            <div className="label" style={{ color:'var(--accent)', marginBottom:'10px' }}>
              {eraEvent.start}{eraEvent.end?`–${eraEvent.end}`:''}
            </div>
            <p style={{ margin:0, fontSize:'14px', lineHeight:1.7, color:'var(--text)' }}>
              {eraEvent[locale==='en'?'en':'fr'].context}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}

// Tracks the user's reduced-motion preference (SSR-safe; updates on change).
function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setReduce(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduce;
}

function Spinner() {
  // Respects prefers-reduced-motion: falls back to a static dot, no spin.
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return (
    <span aria-hidden="true" style={{
      width:'15px', height:'15px', flexShrink:0, display:'inline-block', borderRadius:'50%',
      border:'2px solid var(--border)', borderTopColor:'var(--accent)',
      animation: reduce ? 'none' : 'spin 0.7s linear infinite',
    }} />
  );
}

function InfoBlock({ label, Icon, children }: { label: string; Icon?: typeof MapPin; children: React.ReactNode }) {
  return (
    <div style={{ padding:'10px', background:'var(--bg-muted)', borderRadius:'var(--radius)' }}>
      <div style={{ fontSize:'10px', color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'4px', display:'flex', alignItems:'center', gap:'4px' }}>
        {Icon&&<Icon size={11} aria-hidden="true" />}{label}
      </div>
      <div style={{ fontSize:'13px', fontWeight:'600', lineHeight:'1.4' }}>{children}</div>
    </div>
  );
}

function FamilySection({ title, items, PersonLink }: { title: string; items: Person[]; PersonLink: React.FC<{ p: Person }> }) {
  return (
    <div>
      <div style={{ fontSize:'12px', fontWeight:'700', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>
        {title} ({items.length})
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
        {items.map(p=><PersonLink key={p.id} p={p}/>)}
      </div>
    </div>
  );
}

interface WorldEvent { labelKey: string; start: number; end?: number; icon: string; }
const WORLD_EVENTS: WorldEvent[] = [
  { labelKey: 'world_ww1', start: 1914, end: 1918, icon: '⚔' },
  { labelKey: 'world_greatDepression', start: 1929, end: 1933, icon: '↓' },
  { labelKey: 'world_ww2', start: 1939, end: 1945, icon: '⚔' },
  { labelKey: 'world_may68', start: 1968, icon: '✊' },
  { labelKey: 'world_moonLanding', start: 1969, icon: '↗' },
  { labelKey: 'world_berlinWall', start: 1989, icon: '▦' },
  { labelKey: 'world_publicWeb', start: 1991, icon: '◎' },
  { labelKey: 'world_euro', start: 2002, icon: '€' },
  { labelKey: 'world_covid', start: 2020, end: 2022, icon: '✕' },
];

function yearFloat(dateStr?: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear() + d.getMonth() / 12;
}

function LifeTimeline({ person }: { person: Person }) {
  const t = useTranslations('personPanel');
  const eventTypeLabel = (type: string) =>
    KNOWN_EVENT_TYPES.has(type) ? t(`event_${type}`) : (type.charAt(0).toUpperCase() + type.slice(1));
  const PAD = 46;
  const PX = 26; // pixels per year
  const dotY = 64;
  const nowYear = new Date().getFullYear();

  const events = (person.events || []).filter(e => e.date) as { id: string; type: string; date: string; description?: string }[];

  const startYf = yearFloat(person.birthDate) ?? (events.length ? Math.min(...events.map(e => yearFloat(e.date)!)) : null);
  const endYf = (!person.isAlive ? yearFloat(person.deathDate) : null)
    ?? (events.length ? Math.max(...events.map(e => yearFloat(e.date)!)) : null)
    ?? (startYf !== null ? Math.max(startYf, nowYear) : null);

  if (startYf === null || endYf === null) {
    return <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>{t('timelineEmpty')}</div>;
  }

  const startYear = Math.floor(startYf);
  const endYear = Math.max(Math.ceil(endYf), startYear + 1);
  const span = endYear - startYear;
  const x = (yf: number) => PAD + (yf - startYear) * PX;
  const width = x(endYear) + PAD;
  const HEIGHT = 168;

  // Point list (synthesize birth/death if not present as events)
  const points = [...events];
  if (person.birthDate && !events.some(e => e.type === 'birth')) points.push({ id: 'syn-birth', type: 'birth', date: person.birthDate });
  if (!person.isAlive && person.deathDate && !events.some(e => e.type === 'death')) points.push({ id: 'syn-death', type: 'death', date: person.deathDate });
  points.sort((a, b) => a.date.localeCompare(b.date));

  const worldInRange = WORLD_EVENTS.filter(w => (w.end ?? w.start) >= startYear && w.start <= endYear);

  // Decade ticks
  const ticks: number[] = [];
  for (let y = Math.ceil(startYear / 10) * 10; y <= endYear; y += 10) ticks.push(y);

  return (
    <div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', display:'flex', alignItems:'center', gap:'5px' }}>
        <Clock size={12} aria-hidden="true" /> {t('timelineRange', { start: startYear, end: (!person.isAlive && person.deathDate ? formatYear(person.deathDate) : t('today')) })}
        {span > 0 && <> · {t('ageYears', { age: span })}</>}
      </div>
      <div style={{ overflowX: 'auto', overflowY: 'hidden', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-muted)' }}>
        <svg width={width} height={HEIGHT} style={{ display: 'block' }}>
          {/* Decade ticks */}
          {ticks.map(y => (
            <g key={y}>
              <line x1={x(y)} y1={dotY - 4} x2={x(y)} y2={dotY + 4} stroke="var(--border)" strokeWidth={1} />
              <text x={x(y)} y={dotY + 18} textAnchor="middle" fontSize={9} fill="var(--text-light)" fontFamily="var(--font-body)">{y}</text>
            </g>
          ))}

          {/* Life line */}
          <line x1={x(startYf)} y1={dotY} x2={x(endYf)} y2={dotY} stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" opacity={0.5} />

          {/* World events (below) */}
          {worldInRange.map((w, i) => {
            const x0 = x(Math.max(w.start, startYear));
            const x1 = x(Math.min(w.end ?? w.start, endYear));
            const wy = 112;
            return (
              <g key={i}>
                <title>{t(w.labelKey)} ({w.start}{w.end ? `–${w.end}` : ''})</title>
                {w.end
                  ? <rect x={x0} y={wy} width={Math.max(3, x1 - x0)} height={16} rx={4} fill="var(--deceased)" opacity={0.55} />
                  : <circle cx={x0} cy={wy + 8} r={6} fill="var(--deceased)" opacity={0.7} />}
                <text x={w.end ? (x0 + x1) / 2 : x0} y={wy + 34} textAnchor="middle" fontSize={9} fill="var(--text-muted)" fontFamily="var(--font-body)">
                  {w.icon} {t(w.labelKey).length > 18 ? t(w.labelKey).slice(0, 17) + '…' : t(w.labelKey)}
                </text>
              </g>
            );
          })}

          {/* Person events (above the line) */}
          {points.map(ev => {
            const yf = yearFloat(ev.date)!;
            const px = x(yf);
            return (
              <g key={ev.id} style={{ cursor: 'default' }}>
                <title>{`${eventTypeLabel(ev.type)} — ${formatDate(ev.date)}${ev.description ? `\n${ev.description}` : ''}`}</title>
                <line x1={px} y1={dotY} x2={px} y2={36} stroke="var(--border)" strokeWidth={1} />
                <text x={px} y={28} textAnchor="middle" fontSize={14}>{EVENT_ICONS[ev.type] || '·'}</text>
                <circle cx={px} cy={dotY} r={5} fill="var(--accent)" stroke="var(--bg-card)" strokeWidth={1.5} />
                <text x={px} y={48} textAnchor="middle" fontSize={9} fill="var(--text-muted)" fontFamily="var(--font-body)">{formatYear(ev.date)}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '6px', textAlign: 'center' }}>
        {t('timelineHint')}
      </div>
    </div>
  );
}

function CompletionDonut({ score, color }: { score: number; color: string }) {
  const t = useTranslations('personPanel');
  const r = 13, circ = 2 * Math.PI * r;
  const label = t('profileCompletion', { score });
  return (
    <svg width={34} height={34} viewBox="0 0 34 34" role="img" aria-label={label}>
      <title>{label}</title>
      <circle cx={17} cy={17} r={r} fill="none" stroke="var(--bg-muted)" strokeWidth={4} />
      <circle cx={17} cy={17} r={r} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)} transform="rotate(-90 17 17)"
        style={{ transition: 'stroke-dashoffset 0.4s ease' }} />
      <text x={17} y={18} textAnchor="middle" dominantBaseline="middle" fontSize={9.5} fontWeight={700} fontFamily="var(--font-body)" fill="var(--text)">{score}</text>
    </svg>
  );
}

const DNA_COLORS = ['#bf4b2c','#2c5f8a','#0e6e63','#a8456b','#c77d1a','#4a5a66','#7a4a6a','#4338ca'];

function DnaPie({ origins }: { origins: DnaOrigin[] }) {
  const total = origins.reduce((s, o) => s + (o.percent || 0), 0) || 1;
  const R = 60, cx = 70, cy = 70;
  // Build cumulative slices (normalised against the actual total for display robustness).
  const slices: { o: DnaOrigin; i: number; start: number; end: number; frac: number }[] = [];
  let angle = -Math.PI / 2; // start at top
  for (let i = 0; i < origins.length; i++) {
    const frac = (origins[i].percent || 0) / total;
    const start = angle;
    const end = angle + frac * Math.PI * 2;
    slices.push({ o: origins[i], i, start, end, frac });
    angle = end;
  }

  function arc(start: number, end: number): string {
    const x0 = cx + R * Math.cos(start), y0 = cy + R * Math.sin(start);
    const x1 = cx + R * Math.cos(end), y1 = cy + R * Math.sin(end);
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
  }

  const single = slices.length === 1;

  return (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={140} height={140} viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
        {single ? (
          <circle cx={cx} cy={cy} r={R} fill={DNA_COLORS[0]} stroke="var(--bg-card)" strokeWidth={2} />
        ) : (
          slices.map(s => (
            <path key={s.i} d={arc(s.start, s.end)} fill={DNA_COLORS[s.i % DNA_COLORS.length]} stroke="var(--bg-card)" strokeWidth={1.5} />
          ))
        )}
        <circle cx={cx} cy={cy} r={24} fill="var(--bg-card)" />
        <Dna x={cx - 9} y={cy - 9} width={18} height={18} color="var(--accent)" aria-hidden="true" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: '140px' }}>
        {origins.map((o, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
            <span style={{ width: '11px', height: '11px', borderRadius: '3px', background: DNA_COLORS[i % DNA_COLORS.length], flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.region}</span>
            <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{Math.round(o.percent)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
