'use client';
import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Person, FamilyTree, Relationship, RelationType, FamilyEvent, EventType, Note, Citation, DnaOrigin } from '@/types';
import { getParents, getChildren, getSpouses, getSiblings, getAge, formatDate, formatYear, getDisplayName, generateId, safeHttpUrl } from '@/lib/treeUtils';
import PersonForm from './PersonForm';
import { X, Pencil, Trash2, User, Clock, Users, Calendar, StickyNote, BookOpen, Lightbulb, Link2, AlertCircle, Dna, FileText, Images, ScanFace } from 'lucide-react';

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
}

const EVENT_TYPES: EventType[] = ['birth','death','marriage','divorce','baptism','graduation','military','immigration','other'];
const EVENT_ICONS: Record<string, string> = { birth:'✦', death:'†', marriage:'💒', divorce:'⚡', baptism:'✟', graduation:'🎓', military:'⚔', immigration:'🌍', other:'📌' };
// Built-in event types we have translated labels for (others fall back to the raw type string).
const KNOWN_EVENT_TYPES = new Set<string>(EVENT_TYPES);
const REL_TYPES: RelationType[] = ['spouse', 'partner', 'parent', 'child', 'sibling'];
const REL_LABEL_KEYS: Record<RelationType, string> = { spouse: 'relSpouse', partner: 'relPartner', parent: 'relParent', child: 'relChild', sibling: 'relSibling' };

export default function PersonPanel({ person, tree, onClose, onUpdate, onDelete, onSelectPerson, onAddRelationship, onUpdateRelationship, onDeleteRelationship, onAnalyzePhoto }: Props) {
  const t = useTranslations('personPanel');
  const tp = useTranslations('photoAnalyzer');
  const locale = useLocale();
  const relLabel = (type: RelationType) => t(REL_LABEL_KEYS[type]);
  const eventTypeLabel = (type: string) =>
    KNOWN_EVENT_TYPES.has(type) ? t(`event_${type}`) : (type.charAt(0).toUpperCase() + type.slice(1));
  const [tab, setTab] = useState<'profile'|'life'|'family'|'events'|'notes'|'sources'|'gallery'|'edit'>('profile');
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
  // The panel is remounted per person (keyed by id in the parent), so transient UI resets naturally.

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
          { id:'edit', Icon:Pencil },
        ] as { id: typeof tab; Icon: typeof User; count?: number }[]).map(({ id, Icon, count }) => (
          <button key={id} onClick={() => setTab(id as typeof tab)} className={`tab ${tab===id?'active':''}`} style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'8px 10px', whiteSpace:'nowrap', fontSize:'13px' }} aria-label={t(`tab_${id}`)} title={t(`tab_${id}`)}>
            <Icon size={15} aria-hidden="true" />{count?<span className="mono" style={{ fontSize:'11px' }}>{count}</span>:null}
          </button>
        ))}
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
            <InfoBlock label={t('birth')} icon="✦">
              {formatDate(person.birthDate, person.birthDateApprox)||'—'}
              {person.birthPlace?.city&&<><br/><small>📍 {[person.birthPlace.city, person.birthPlace.country].filter(Boolean).join(', ')}</small></>}
            </InfoBlock>
            {!person.isAlive&&(
              <InfoBlock label={t('death')} icon="†">
                {formatDate(person.deathDate, person.deathDateApprox)||'—'}
                {person.deathPlace?.city&&<><br/><small>📍 {[person.deathPlace.city, person.deathPlace.country].filter(Boolean).join(', ')}</small></>}
              </InfoBlock>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              {person.occupation&&<InfoBlock label={t('occupation')} icon="💼">{person.occupation}</InfoBlock>}
              {person.nationality&&<InfoBlock label={t('nationality')} icon="🌍">{person.nationality}</InfoBlock>}
              {person.religion&&<InfoBlock label={t('religion')} icon="✟">{person.religion}</InfoBlock>}
              {person.education&&<InfoBlock label={t('education')} icon="🎓">{person.education}</InfoBlock>}
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
              <button onClick={()=>setShowAddRel(true)} className="btn btn-secondary btn-sm" style={{ alignSelf:'flex-start' }}>＋ {t('addRelation')}</button>
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
                  <button onClick={sortEventsByDate} className="btn btn-ghost btn-sm" style={{ fontSize:'11px' }}>📅 {t('sortByDate')}</button>
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
                            <span style={{ cursor:'grab', color:'var(--text-light)', fontSize:'13px', userSelect:'none' }}>⠿</span>
                            <div>
                              <div style={{ fontWeight:'700', fontSize:'13px' }}>
                                {EVENT_ICONS[event.type]||'📌'} {eventTypeLabel(event.type)}
                              </div>
                              {event.date&&<div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{formatDate(event.date, event.dateApprox)}</div>}
                              {event.place?.city&&<div style={{ fontSize:'12px', color:'var(--text-muted)' }}>📍 {[event.place.city, event.place.country].filter(Boolean).join(', ')}</div>}
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
              <button onClick={()=>setShowAddEvent(true)} className="btn btn-secondary btn-sm">＋ {t('addEvent')}</button>
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
              <button onClick={()=>setShowAddNote(true)} className="btn btn-secondary btn-sm">＋ {t('addNote')}</button>
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
            <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'12px' }}>
              {(!person.citations||person.citations.length===0) ? (
                <div style={{ textAlign:'center', padding:'20px', color:'var(--text-muted)' }}>{t('noSources')}</div>
              ) : (
                person.citations.map(citation=>(
                  <div key={citation.id} style={{ padding:'12px', background:'var(--bg-muted)', borderRadius:'var(--radius)', border:'1px solid var(--border)', borderLeft:'3px solid var(--accent)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:'700', fontSize:'13px', lineHeight:1.4 }}>📚 {citation.title}</div>
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
              <button onClick={()=>setShowAddCitation(true)} className="btn btn-secondary btn-sm">＋ {t('addSource')}</button>
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
    </aside>
  );
}

function InfoBlock({ label, icon, children }: { label: string; icon?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding:'10px', background:'var(--bg-muted)', borderRadius:'var(--radius)' }}>
      <div style={{ fontSize:'10px', color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'4px' }}>
        {icon&&<span style={{ marginRight:'4px' }}>{icon}</span>}{label}
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
  { labelKey: 'world_ww1', start: 1914, end: 1918, icon: '⚔️' },
  { labelKey: 'world_greatDepression', start: 1929, end: 1933, icon: '📉' },
  { labelKey: 'world_ww2', start: 1939, end: 1945, icon: '⚔️' },
  { labelKey: 'world_may68', start: 1968, icon: '✊' },
  { labelKey: 'world_moonLanding', start: 1969, icon: '🚀' },
  { labelKey: 'world_berlinWall', start: 1989, icon: '🧱' },
  { labelKey: 'world_publicWeb', start: 1991, icon: '🌐' },
  { labelKey: 'world_euro', start: 2002, icon: '💶' },
  { labelKey: 'world_covid', start: 2020, end: 2022, icon: '🦠' },
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
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
        🕰 {t('timelineRange', { start: startYear, end: (!person.isAlive && person.deathDate ? formatYear(person.deathDate) : t('today')) })}
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
                <text x={px} y={28} textAnchor="middle" fontSize={14}>{EVENT_ICONS[ev.type] || '📌'}</text>
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
