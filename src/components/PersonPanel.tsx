'use client';
import { useState } from 'react';
import { Person, FamilyTree, Relationship, RelationType, FamilyEvent, EventType, Note } from '@/types';
import { getParents, getChildren, getSpouses, getSiblings, getAge, formatDate, getDisplayName, generateId } from '@/lib/treeUtils';
import PersonForm from './PersonForm';

interface Props {
  person: Person;
  tree: FamilyTree;
  onClose: () => void;
  onUpdate: (updates: Partial<Person>) => void;
  onDelete: () => void;
  onSelectPerson: (id: string) => void;
  onAddRelationship: (rel: Omit<Relationship, 'id'>) => Relationship | null;
  onDeleteRelationship: (relId: string) => void;
}

const EVENT_TYPES: EventType[] = ['birth','death','marriage','divorce','baptism','graduation','military','immigration','other'];
const EVENT_ICONS: Record<string, string> = { birth:'✦', death:'✝', marriage:'💒', divorce:'⚡', baptism:'✟', graduation:'🎓', military:'⚔', immigration:'🌍', other:'📌' };

export default function PersonPanel({ person, tree, onClose, onUpdate, onDelete, onSelectPerson, onAddRelationship }: Props) {
  const [tab, setTab] = useState<'profile'|'family'|'events'|'notes'|'edit'>('profile');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAddRel, setShowAddRel] = useState(false);
  const [newRelType, setNewRelType] = useState<RelationType>('spouse');
  const [newRelPersonId, setNewRelPersonId] = useState('');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<FamilyEvent>>({ type: 'other' });
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editNoteId, setEditNoteId] = useState<string|null>(null);
  // The panel is remounted per person (keyed by id in the parent), so transient UI resets naturally.

  const parents = getParents(person.id, tree.relationships, tree.persons);
  const children = getChildren(person.id, tree.relationships, tree.persons);
  const spouses = getSpouses(person.id, tree.relationships, tree.persons);
  const siblings = getSiblings(person.id, tree.relationships, tree.persons);
  const age = getAge(person.birthDate, person.deathDate);

  const availablePersons = tree.persons.filter(p =>
    p.id !== person.id &&
    !tree.relationships.some(r =>
      (r.person1Id === person.id && r.person2Id === p.id) ||
      (r.person2Id === person.id && r.person1Id === p.id)
    )
  );

  function addEvent() {
    if (!newEvent.type) return;
    const events = [...(person.events || []), { ...newEvent, id: generateId() } as FamilyEvent];
    onUpdate({ events });
    setNewEvent({ type: 'other' });
    setShowAddEvent(false);
  }
  function removeEvent(eventId: string) {
    onUpdate({ events: (person.events || []).filter(e => e.id !== eventId) });
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

  function PersonLink({ p }: { p: Person }) {
    return (
      <button onClick={() => onSelectPerson(p.id)}
        style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px', border:'none', background:'var(--bg-muted)', borderRadius:'var(--radius)', cursor:'pointer', textAlign:'left', transition:'background 0.1s', width:'100%' }}
        onMouseEnter={e => e.currentTarget.style.background='var(--accent-light)'}
        onMouseLeave={e => e.currentTarget.style.background='var(--bg-muted)'}
      >
        <span style={{ fontSize:'16px' }}>{p.gender==='male'?'👨':p.gender==='female'?'👩':'🧑'}</span>
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
      {/* Header */}
      <div style={{ padding:'18px 18px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'flex-start', gap:'12px' }}>
        <div style={{ width:'56px', height:'56px', borderRadius:'50%', flexShrink:0, overflow:'hidden',
          background: person.gender==='male'?'#deeaf5':person.gender==='female'?'#f5dde8':'var(--bg-muted)',
          display:'flex', alignItems:'center', justifyContent:'center',
          border:`3px solid ${person.gender==='male'?'var(--male)':person.gender==='female'?'var(--female)':'var(--border)'}`,
          fontSize:'24px'
        }}>
          {person.profilePhoto
            ? <img src={person.profilePhoto} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : person.gender==='male'?'👨':person.gender==='female'?'👩':'🧑'}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <h2 className="serif" style={{ margin:'0 0 4px', fontSize:'1.2rem', lineHeight:1.25 }}>
            {person.firstName} {person.maidenName?`(${person.maidenName}) `:''}{person.lastName}
          </h2>
          {person.nickName && <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'4px', fontStyle:'italic' }}>«&nbsp;{person.nickName}&nbsp;»</div>}
          <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
            <span className={`badge badge-${person.gender==='male'?'male':person.gender==='female'?'female':'accent'}`}>
              {person.gender==='male'?'♂':person.gender==='female'?'♀':'⚧'}
            </span>
            <span className={`badge badge-${person.isAlive?'alive':'deceased'}`}>
              {person.isAlive?'💚 Vivant':'🕊 Décédé'}
            </span>
            {age!==null&&<span className="badge badge-accent">{age} ans</span>}
          </div>
        </div>
        <button onClick={onClose} className="btn btn-ghost btn-sm" title="Fermer" style={{ padding:'4px 8px', fontSize:'16px' }}>✕</button>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ margin:'0 14px', paddingTop:'4px', overflowX:'auto', flexShrink:0 }}>
        {[
          ['profile','👤'],['family','👨‍👩‍👧'],
          ['events',`📅${person.events?.length?` ${person.events.length}`:''}` ],
          ['notes',`📝${person.notes?.length?` ${person.notes.length}`:''}` ],
          ['edit','✏️']
        ].map(([t,label]) => (
          <button key={t} onClick={() => setTab(t as typeof tab)} className={`tab ${tab===t?'active':''}`} style={{ padding:'8px 10px', whiteSpace:'nowrap', fontSize:'13px' }}>{label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding:'14px 18px 24px', flex:1, overflowY:'auto' }}>

        {tab==='profile' && (
          <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <InfoBlock label="Naissance" icon="✦">
              {formatDate(person.birthDate, person.birthDateApprox)||'—'}
              {person.birthPlace?.city&&<><br/><small>📍 {[person.birthPlace.city, person.birthPlace.country].filter(Boolean).join(', ')}</small></>}
            </InfoBlock>
            {!person.isAlive&&(
              <InfoBlock label="Décès" icon="✝">
                {formatDate(person.deathDate, person.deathDateApprox)||'—'}
                {person.deathPlace?.city&&<><br/><small>📍 {[person.deathPlace.city, person.deathPlace.country].filter(Boolean).join(', ')}</small></>}
              </InfoBlock>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              {person.occupation&&<InfoBlock label="Profession" icon="💼">{person.occupation}</InfoBlock>}
              {person.nationality&&<InfoBlock label="Nationalité" icon="🌍">{person.nationality}</InfoBlock>}
              {person.religion&&<InfoBlock label="Religion" icon="✟">{person.religion}</InfoBlock>}
              {person.education&&<InfoBlock label="Éducation" icon="🎓">{person.education}</InfoBlock>}
            </div>
            {person.bio&&(
              <div style={{ padding:'12px', background:'var(--bg-muted)', borderRadius:'var(--radius)', borderLeft:'3px solid var(--accent)' }}>
                <div style={{ fontSize:'11px', color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>Biographie</div>
                <p style={{ margin:0, fontSize:'13px', lineHeight:'1.7' }}>{person.bio}</p>
              </div>
            )}
            {person.tags&&person.tags.length>0&&(
              <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                {person.tags.map(tag=><span key={tag} className="badge badge-accent">#{tag}</span>)}
              </div>
            )}
            {person.customFields&&Object.keys(person.customFields).length>0&&(
              <div>
                <div style={{ fontSize:'11px', color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>Champs personnalisés</div>
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

        {tab==='family' && (
          <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            {spouses.length>0&&<FamilySection title="Conjoints / Partenaires" items={spouses} PersonLink={PersonLink} />}
            {parents.length>0&&<FamilySection title="Parents" items={parents} PersonLink={PersonLink} />}
            {children.length>0&&<FamilySection title="Enfants" items={children} PersonLink={PersonLink} />}
            {siblings.length>0&&<FamilySection title="Frères & Sœurs" items={siblings} PersonLink={PersonLink} />}
            {spouses.length===0&&parents.length===0&&children.length===0&&siblings.length===0&&(
              <div style={{ textAlign:'center', padding:'20px', color:'var(--text-muted)' }}>Aucune relation enregistrée</div>
            )}
            {!showAddRel ? (
              <button onClick={()=>setShowAddRel(true)} className="btn btn-secondary btn-sm" style={{ alignSelf:'flex-start' }}>＋ Ajouter une relation</button>
            ) : (
              <div style={{ padding:'12px', background:'var(--bg-muted)', borderRadius:'var(--radius)' }} className="animate-fade-in">
                <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'8px' }}>
                  <select value={newRelType} onChange={e=>setNewRelType(e.target.value as RelationType)} className="input">
                    <option value="spouse">Conjoint(e)</option>
                    <option value="partner">Partenaire</option>
                    <option value="parent">Est parent de</option>
                    <option value="child">Est enfant de</option>
                    <option value="sibling">Frère/Sœur de</option>
                  </select>
                  <select value={newRelPersonId} onChange={e=>setNewRelPersonId(e.target.value)} className="input">
                    <option value="">Choisir une personne...</option>
                    {availablePersons.map(p=><option key={p.id} value={p.id}>{getDisplayName(p)}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  <button onClick={()=>{ if(newRelPersonId){onAddRelationship({type:newRelType,person1Id:person.id,person2Id:newRelPersonId}); setShowAddRel(false); setNewRelPersonId(''); }}} className="btn btn-primary btn-sm" disabled={!newRelPersonId}>Ajouter</button>
                  <button onClick={()=>setShowAddRel(false)} className="btn btn-ghost btn-sm">Annuler</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab==='events' && (
          <div className="animate-fade-in">
            {(!person.events||person.events.length===0) ? (
              <div style={{ textAlign:'center', padding:'20px', color:'var(--text-muted)' }}>Aucun événement enregistré</div>
            ) : (
              <div style={{ paddingLeft:'16px', borderLeft:'2px solid var(--border)', display:'flex', flexDirection:'column', marginBottom:'12px' }}>
                {[...(person.events||[])].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map((event)=>(
                  <div key={event.id} className="timeline-item">
                    <div className="timeline-dot" />
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div>
                        <div style={{ fontWeight:'700', fontSize:'13px' }}>
                          {EVENT_ICONS[event.type]||'📌'} {event.type.charAt(0).toUpperCase()+event.type.slice(1)}
                        </div>
                        {event.date&&<div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{formatDate(event.date, event.dateApprox)}</div>}
                        {event.place?.city&&<div style={{ fontSize:'12px', color:'var(--text-muted)' }}>📍 {[event.place.city, event.place.country].filter(Boolean).join(', ')}</div>}
                        {event.description&&<div style={{ fontSize:'13px', marginTop:'4px' }}>{event.description}</div>}
                      </div>
                      <button onClick={()=>removeEvent(event.id)} className="btn btn-ghost btn-sm" style={{ color:'var(--danger)', fontSize:'12px', flexShrink:0 }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!showAddEvent ? (
              <button onClick={()=>setShowAddEvent(true)} className="btn btn-secondary btn-sm">＋ Ajouter un événement</button>
            ) : (
              <div style={{ padding:'12px', background:'var(--bg-muted)', borderRadius:'var(--radius)' }} className="animate-fade-in">
                <h4 style={{ margin:'0 0 10px', fontSize:'13px' }}>Nouvel événement</h4>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
                  <select value={newEvent.type} onChange={e=>setNewEvent(v=>({...v,type:e.target.value as EventType}))} className="input">
                    {EVENT_TYPES.map(t=><option key={t} value={t}>{EVENT_ICONS[t]} {t}</option>)}
                  </select>
                  <input type="date" value={newEvent.date||''} onChange={e=>setNewEvent(v=>({...v,date:e.target.value||undefined}))} className="input" placeholder="Date"/>
                  <input value={newEvent.place?.city||''} onChange={e=>setNewEvent(v=>({...v,place:{...v.place,city:e.target.value}}))} className="input" placeholder="Ville"/>
                  <input value={newEvent.place?.country||''} onChange={e=>setNewEvent(v=>({...v,place:{...v.place,country:e.target.value}}))} className="input" placeholder="Pays"/>
                </div>
                <input value={newEvent.description||''} onChange={e=>setNewEvent(v=>({...v,description:e.target.value}))} className="input" placeholder="Description (optionnel)" style={{ marginBottom:'8px', width:'100%' }}/>
                <div style={{ display:'flex', gap:'6px' }}>
                  <button onClick={addEvent} className="btn btn-primary btn-sm">Ajouter</button>
                  <button onClick={()=>setShowAddEvent(false)} className="btn btn-ghost btn-sm">Annuler</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab==='notes' && (
          <div className="animate-fade-in">
            <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'12px' }}>
              {(!person.notes||person.notes.length===0) ? (
                <div style={{ textAlign:'center', padding:'20px', color:'var(--text-muted)' }}>Aucune note</div>
              ) : (
                person.notes.map(note=>(
                  <div key={note.id} style={{ padding:'12px', background:'var(--bg-muted)', borderRadius:'var(--radius)', border:'1px solid var(--border)' }}>
                    {editNoteId===note.id ? (
                      <div>
                        <textarea defaultValue={note.content} autoFocus id={`note-edit-${note.id}`} className="input" rows={3} style={{ resize:'vertical', marginBottom:'6px', width:'100%' }} />
                        <div style={{ display:'flex', gap:'6px' }}>
                          <button onClick={()=>{ const ta = document.getElementById(`note-edit-${note.id}`) as HTMLTextAreaElement; updateNote(note.id, ta.value); }} className="btn btn-primary btn-sm">Sauvegarder</button>
                          <button onClick={()=>setEditNoteId(null)} className="btn btn-ghost btn-sm">Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p style={{ margin:'0 0 8px', fontSize:'13px', lineHeight:'1.6' }}>{note.content}</p>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <div style={{ fontSize:'11px', color:'var(--text-light)' }}>
                            {new Date(note.updatedAt).toLocaleDateString('fr-FR', {day:'numeric',month:'short',year:'numeric'})}
                          </div>
                          <div style={{ display:'flex', gap:'4px' }}>
                            <button onClick={()=>setEditNoteId(note.id)} className="btn btn-ghost btn-sm" style={{ fontSize:'11px' }}>✏️</button>
                            <button onClick={()=>removeNote(note.id)} className="btn btn-ghost btn-sm" style={{ fontSize:'11px', color:'var(--danger)' }}>🗑</button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
            {!showAddNote ? (
              <button onClick={()=>setShowAddNote(true)} className="btn btn-secondary btn-sm">＋ Ajouter une note</button>
            ) : (
              <div style={{ padding:'12px', background:'var(--bg-muted)', borderRadius:'var(--radius)' }} className="animate-fade-in">
                <textarea autoFocus value={newNoteContent} onChange={e=>setNewNoteContent(e.target.value)} className="input" rows={3} style={{ resize:'vertical', marginBottom:'8px', width:'100%' }} placeholder="Écrivez votre note ici..." />
                <div style={{ display:'flex', gap:'6px' }}>
                  <button onClick={addNote} className="btn btn-primary btn-sm" disabled={!newNoteContent.trim()}>Ajouter</button>
                  <button onClick={()=>{setShowAddNote(false);setNewNoteContent('');}} className="btn btn-ghost btn-sm">Annuler</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab==='edit' && (
          <div className="animate-fade-in">
            <PersonForm initial={person} onSave={(updates)=>{onUpdate(updates);setTab('profile');}} onCancel={()=>setTab('profile')} />
            <hr className="divider"/>
            {!confirmDelete ? (
              <button onClick={()=>setConfirmDelete(true)} className="btn btn-danger btn-sm">🗑 Supprimer cette personne</button>
            ) : (
              <div style={{ padding:'12px', background:'#fdf2f2', border:'1px solid #f5c6c6', borderRadius:'var(--radius)' }}>
                <p style={{ margin:'0 0 10px', fontSize:'13px', color:'#1a1612' }}>⚠️ Supprimer définitivement <strong>{getDisplayName(person)}</strong> et toutes ses relations ?</p>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={onDelete} className="btn btn-danger btn-sm">Oui, supprimer</button>
                  <button onClick={()=>setConfirmDelete(false)} className="btn btn-ghost btn-sm">Annuler</button>
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
