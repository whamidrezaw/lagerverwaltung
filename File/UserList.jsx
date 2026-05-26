import { useState } from 'react';
import { usersAPI } from '../../services/api';

const EL={minijob:'Minijob',teilzeit:'Teilzeit',vollzeit:'Vollzeit'};
const EB={minijob:'badge-amber',teilzeit:'badge-green',vollzeit:'badge-blue'};
const EMPTY={name:'',username:'',password:'',employment_type:'teilzeit',weekly_hours:20,email:'',phone:'',notes:''};

export default function UserList({users, onRefresh}) {
  const [showAdd, setShowAdd] = useState(false);
  const [form,    setForm]    = useState(EMPTY);
  const [editId,  setEditId]  = useState(null);
  const [editF,   setEditF]   = useState({});
  const [pwdId,   setPwdId]   = useState(null);
  const [newPwd,  setNewPwd]  = useState('');
  const [delUser, setDelUser] = useState(null);  // Löschen-Bestätigung
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState({t:'',x:''});

  const set  = (k,v)=>setForm(f=>({...f,[k]:v}));
  const sete = (k,v)=>setEditF(f=>({...f,[k]:v}));
  const flash= (t,x)=>{setMsg({t,x});setTimeout(()=>setMsg({t:'',x:''}),3500);};

  const handleAdd = async e=>{
    e.preventDefault(); setLoading(true);
    try {
      await usersAPI.create(form);
      flash('success','✅ Mitarbeiter angelegt.');
      setForm(EMPTY); setShowAdd(false); onRefresh();
    } catch(err){flash('danger',err.response?.data?.message||'Fehler.');}
    setLoading(false);
  };

  const startEdit = u=>{
    setEditId(u.id);
    setEditF({name:u.name,username:u.username,employment_type:u.employment_type,
      weekly_hours:u.weekly_hours,email:u.email||'',phone:u.phone||'',notes:u.notes||''});
    setPwdId(null);setNewPwd('');
  };

  const saveEdit = async id=>{
    setLoading(true);
    try {
      await usersAPI.update(id,editF);
      flash('success','✅ Daten aktualisiert.');
      setEditId(null); onRefresh();
    } catch(err){flash('danger',err.response?.data?.message||'Fehler.');}
    setLoading(false);
  };

  const changePwd = async id=>{
    if(newPwd.length<6){flash('danger','Min. 6 Zeichen.');return;}
    setLoading(true);
    try { await usersAPI.changePassword(id,{newPassword:newPwd}); flash('success','✅ Passwort geändert.'); setPwdId(null);setNewPwd(''); }
    catch{flash('danger','Fehler.');}
    setLoading(false);
  };

  const toggleActive = async u=>{
    setLoading(true);
    await usersAPI.update(u.id,{is_active:!u.is_active});
    onRefresh(); setLoading(false);
  };

  const confirmDelete = async()=>{
    if(!delUser) return;
    setLoading(true);
    try {
      await usersAPI.deleteUser(delUser.id);
      flash('success',`✅ ${delUser.name} wurde gelöscht.`);
      setDelUser(null); onRefresh();
    } catch(err){flash('danger',err.response?.data?.message||'Fehler.');}
    setLoading(false);
  };

  return (
    <div className="card">
      {/* Löschen-Dialog */}
      {delUser&&(
        <div style={DLG.ov} onClick={()=>setDelUser(null)}>
          <div style={DLG.box} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:26,textAlign:'center',marginBottom:8}}>⚠️</div>
            <h3 style={{textAlign:'center',marginBottom:14,fontSize:16,fontWeight:700}}>Mitarbeiter löschen?</h3>
            <div style={{background:'#fff7ed',border:'1px solid #fdba74',borderRadius:10,padding:'12px 16px',marginBottom:16}}>
              <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:'4px 12px',fontSize:13}}>
                <span style={{color:'#94a3b8'}}>Name</span><span style={{fontWeight:700}}>{delUser.name}</span>
                <span style={{color:'#94a3b8'}}>Typ</span><span style={{fontWeight:600}}>{EL[delUser.employment_type]}</span>
                <span style={{color:'#94a3b8'}}>Stunden</span><span style={{fontWeight:600}}>{delUser.weekly_hours}h/Woche</span>
                {delUser.email&&<><span style={{color:'#94a3b8'}}>E-Mail</span><span>{delUser.email}</span></>}
              </div>
              <div style={{fontSize:12,color:'#ef4444',marginTop:10,fontWeight:500}}>
                ⚠️ Alle Schichten dieses Mitarbeiters werden ebenfalls gelöscht!
              </div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-outline" style={{flex:1}} onClick={()=>setDelUser(null)}>Abbrechen</button>
              <button className="btn btn-danger" style={{flex:1}} onClick={confirmDelete} disabled={loading}>
                {loading?'…':'Ja, endgültig löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <h3 style={{fontSize:16,fontWeight:600}}>Mitarbeiter ({users.filter(u=>u.is_active).length} aktiv)</h3>
        <button className="btn btn-primary btn-sm" onClick={()=>{setShowAdd(s=>!s);setEditId(null);}}>
          {showAdd?'✕ Abbrechen':'+ Neu anlegen'}
        </button>
      </div>

      {msg.x&&<div className={`alert alert-${msg.t}`}>{msg.x}</div>}

      {/* Neu-Formular */}
      {showAdd&&(
        <form onSubmit={handleAdd} style={S.formBox}>
          <h4 style={{marginBottom:12,fontSize:14,fontWeight:600}}>Neuer Mitarbeiter</h4>
          <div style={S.g2}>
            {[['Name *','name','text'],['Benutzername *','username','text'],
              ['Passwort *','password','password'],['E-Mail','email','email'],['Telefon','phone','tel']
            ].map(([l,k,t])=>(
              <div key={k} className="form-group" style={{marginBottom:8}}>
                <label className="form-label">{l}</label>
                <input className="form-input" type={t} value={form[k]} required={l.includes('*')}
                  minLength={k==='password'?6:undefined}
                  onChange={e=>set(k,e.target.value)}/>
              </div>
            ))}
            <div className="form-group" style={{marginBottom:8}}>
              <label className="form-label">Vertragstyp *</label>
              <select className="form-input form-select" value={form.employment_type} onChange={e=>set('employment_type',e.target.value)}>
                <option value="minijob">Minijob</option><option value="teilzeit">Teilzeit</option><option value="vollzeit">Vollzeit</option>
              </select>
            </div>
            <div className="form-group" style={{marginBottom:8}}>
              <label className="form-label">Wochenstunden *</label>
              <input className="form-input" type="number" min="1" max="48" step="0.5" value={form.weekly_hours} onChange={e=>set('weekly_hours',e.target.value)} required/>
            </div>
          </div>
          <div className="form-group" style={{marginBottom:12}}>
            <label className="form-label">Notiz (intern)</label>
            <input className="form-input" value={form.notes} onChange={e=>set('notes',e.target.value)} maxLength={500} placeholder="Interne Notiz..."/>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading?'…':'Mitarbeiter anlegen'}</button>
        </form>
      )}

      {/* Mitarbeiterliste */}
      <div style={{display:'flex',flexDirection:'column',gap:2}}>
        {users.map(u=>{
          const isEdit=editId===u.id, isPwd=pwdId===u.id;
          return (
            <div key={u.id} style={{...S.row,opacity:u.is_active?1:0.45}}>
              {!isEdit?(
                <>
                  <div style={S.info}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <span style={S.name}>{u.name}</span>
                      <span style={{fontSize:12,color:'#94a3b8'}}>@{u.username}</span>
                      {!u.is_active&&<span className="badge badge-gray">inaktiv</span>}
                    </div>
                    <div style={{display:'flex',gap:6,marginTop:3,flexWrap:'wrap',alignItems:'center'}}>
                      <span className={`badge ${EB[u.employment_type]}`}>{EL[u.employment_type]}</span>
                      <span className="badge badge-gray">{u.weekly_hours}h/W</span>
                      {u.email&&<span style={{fontSize:11,color:'#64748b'}}>✉ {u.email}</span>}
                      {u.phone&&<span style={{fontSize:11,color:'#64748b'}}>📞 {u.phone}</span>}
                    </div>
                    {u.notes&&<div style={{fontSize:11,color:'#94a3b8',marginTop:3,fontStyle:'italic'}}>📝 {u.notes}</div>}
                  </div>
                  <div style={{display:'flex',gap:5,flexWrap:'wrap',flexShrink:0}}>
                    <button className="btn btn-outline btn-sm" onClick={()=>startEdit(u)}>✏️ Bearbeiten</button>
                    <button className="btn btn-outline btn-sm" onClick={()=>{setPwdId(p=>p===u.id?null:u.id);setNewPwd('');setEditId(null);}}>🔑</button>
                    <button className="btn btn-outline btn-sm" onClick={()=>toggleActive(u)}>{u.is_active?'Deaktivieren':'Aktivieren'}</button>
                    <button className="btn btn-danger btn-sm" onClick={()=>setDelUser(u)}>🗑️</button>
                  </div>
                </>
              ):(
                <div style={{width:'100%'}}>
                  <div style={S.g2}>
                    {[['Name','name','text'],['Benutzername','username','text'],
                      ['E-Mail','email','email'],['Telefon','phone','tel']
                    ].map(([l,k,t])=>(
                      <div key={k} className="form-group" style={{marginBottom:8}}>
                        <label className="form-label">{l}</label>
                        <input className="form-input" type={t} value={editF[k]||''} onChange={e=>sete(k,e.target.value)}/>
                      </div>
                    ))}
                    <div className="form-group" style={{marginBottom:8}}>
                      <label className="form-label">Vertragstyp</label>
                      <select className="form-input form-select" value={editF.employment_type} onChange={e=>sete('employment_type',e.target.value)}>
                        <option value="minijob">Minijob</option><option value="teilzeit">Teilzeit</option><option value="vollzeit">Vollzeit</option>
                      </select>
                    </div>
                    <div className="form-group" style={{marginBottom:8}}>
                      <label className="form-label">Wochenstunden</label>
                      <input className="form-input" type="number" min="1" max="48" step="0.5" value={editF.weekly_hours} onChange={e=>sete('weekly_hours',e.target.value)}/>
                    </div>
                  </div>
                  <div className="form-group" style={{marginBottom:10}}>
                    <label className="form-label">Notiz (intern)</label>
                    <input className="form-input" value={editF.notes||''} onChange={e=>sete('notes',e.target.value)} maxLength={500} placeholder="Interne Notiz..."/>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button className="btn btn-primary btn-sm" onClick={()=>saveEdit(u.id)} disabled={loading}>{loading?'…':'💾 Speichern'}</button>
                    <button className="btn btn-outline btn-sm" onClick={()=>setEditId(null)}>Abbrechen</button>
                  </div>
                </div>
              )}

              {isPwd&&!isEdit&&(
                <div style={{width:'100%',marginTop:10,paddingTop:10,borderTop:'1px solid #f3f4f6'}}>
                  <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                    <input className="form-input" type="password" placeholder="Neues Passwort (min. 6 Zeichen)"
                      value={newPwd} onChange={e=>setNewPwd(e.target.value)} style={{maxWidth:260}}/>
                    <button className="btn btn-primary btn-sm" onClick={()=>changePwd(u.id)} disabled={loading||newPwd.length<6}>Ändern</button>
                    <button className="btn btn-outline btn-sm" onClick={()=>setPwdId(null)}>✕</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DLG={
  ov:{position:'fixed',inset:0,background:'rgba(15,23,42,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16,backdropFilter:'blur(2px)'},
  box:{background:'#fff',borderRadius:14,padding:24,width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'},
};
const S={
  formBox:{background:'#f8fafc',borderRadius:8,padding:16,marginBottom:16,border:'1px solid #e5e7eb'},
  g2:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10},
  row:{display:'flex',flexWrap:'wrap',justifyContent:'space-between',alignItems:'flex-start',
    padding:'12px 4px',borderBottom:'1px solid #f3f4f6',gap:8},
  info:{flex:1,minWidth:200},
  name:{fontWeight:700,fontSize:14},
};
