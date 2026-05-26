import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { shiftsAPI, usersAPI } from '../../services/api';

// ══ Datum lokal formatieren (kein UTC-Shift) ══════════════
const fmtLocal = d => {
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
};
const normD = v => (v ? String(v).slice(0,10) : '');

// ══ NRW Feiertage ════════════════════════════════════════
const calcEaster = y => {
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25);
  const g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7;
  const m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),dy=((h+l-7*m+114)%31)+1;
  return new Date(y,mo-1,dy);
};
const addD=(d,n)=>{const r=new Date(d);r.setDate(r.getDate()+n);return r;};
const nrwH=y=>new Set([`${y}-01-01`,fmtLocal(addD(calcEaster(y),-2)),fmtLocal(addD(calcEaster(y),1)),
  `${y}-05-01`,fmtLocal(addD(calcEaster(y),39)),fmtLocal(addD(calcEaster(y),50)),
  fmtLocal(addD(calcEaster(y),60)),`${y}-10-03`,`${y}-11-01`,`${y}-12-25`,`${y}-12-26`]);

// ══ Konstanten ════════════════════════════════════════════
const CELL_W  = 58;
const BAR_H   = 22;
const START_H = 6, END_H = 21, SPAN_H = 15;
const timeToPx = t => ((t-START_H)/SPAN_H)*CELL_W;

const COLORS=['#3b82f6','#8b5cf6','#0ea5e9','#10b981','#f59e0b',
              '#ef4444','#ec4899','#84cc16','#14b8a6','#a855f7',
              '#6366f1','#f97316','#06b6d4','#22c55e','#e11d48'];
const DE_DOW=['So','Mo','Di','Mi','Do','Fr','Sa'];
const DE_MON=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const DOW_BG =['#f3f4f6','#eff6ff','#f5f3ff','#f0fdfa','#f0fdf4','#fffbeb','#fff7ed'];
const DOW_HDR=['#d1d5db','#bfdbfe','#ddd6fe','#99f6e4','#bbf7d0','#fde68a','#fed7aa'];
const DOW_TXT=['#6b7280','#1e40af','#5b21b6','#0f766e','#15803d','#b45309','#c2410c'];

const shiftH=s=>{
  const [sh,sm]=s.start_time.split(':').map(Number),[eh,em]=s.end_time.split(':').map(Number);
  return Math.max(0,((eh*60+em)-(sh*60+sm)-(s.break_minutes||0))/60);
};

// ══ Delete-Bestätigungsdialog ═════════════════════════════
function DeleteShiftModal({shift, userName, onConfirm, onCancel}) {
  const d=new Date(normD(shift.shift_date)+'T12:00:00');
  const dateStr=`${DE_DOW[d.getDay()]}, ${d.getDate()}.${d.getMonth()+1}.${d.getFullYear()}`;
  return (
    <div style={OV.overlay} onClick={onCancel}>
      <div style={{...OV.box,maxWidth:360}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:24,textAlign:'center',marginBottom:8}}>🗑️</div>
        <h3 style={{textAlign:'center',marginBottom:16,fontSize:16,fontWeight:700,color:'#1e293b'}}>Schicht löschen?</h3>
        <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:'12px 16px',marginBottom:16}}>
          <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:'4px 12px',fontSize:13}}>
            <span style={{color:'#94a3b8',fontWeight:500}}>Mitarbeiter</span>
            <span style={{fontWeight:700,color:'#1e293b'}}>{userName}</span>
            <span style={{color:'#94a3b8',fontWeight:500}}>Datum</span>
            <span style={{fontWeight:600,color:'#1e293b'}}>{dateStr}</span>
            <span style={{color:'#94a3b8',fontWeight:500}}>Uhrzeit</span>
            <span style={{fontWeight:600,color:'#dc2626'}}>
              {shift.start_time.slice(0,5)} – {shift.end_time.slice(0,5)} Uhr
            </span>
            {shift.notes&&<><span style={{color:'#94a3b8',fontWeight:500}}>Notiz</span>
              <span style={{color:'#4b5563'}}>"{shift.notes}"</span></>}
          </div>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className="btn btn-outline" style={{flex:1}} onClick={onCancel}>Abbrechen</button>
          <button className="btn btn-danger" style={{flex:1}} onClick={onConfirm}>
            Ja, löschen
          </button>
        </div>
      </div>
    </div>
  );
}

// ══ CellModal ════════════════════════════════════════════
function CellModal({userId,userName,date,existing,onSave,onRequestDelete,onClose}) {
  const [st,setSt]=useState(existing?.start_time?.slice(0,5)||'06:00');
  const [et,setEt]=useState(existing?.end_time?.slice(0,5)||'14:00');
  const [br,setBr]=useState(String(existing?.break_minutes||0));
  const [no,setNo]=useState(existing?.notes||'');
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState('');

  const fmtDate=s=>{const d=new Date(s+'T12:00:00');return `${DE_DOW[d.getDay()]}, ${d.getDate()}.${d.getMonth()+1}.${d.getFullYear()}`;};

  const save=async()=>{
    if(st>=et){setErr('Ende muss nach Beginn liegen.');return;}
    setLoading(true);
    const r=await onSave({start_time:st+':00',end_time:et+':00',break_minutes:parseInt(br)||0,notes:no});
    if(r?.warning)setErr(r.warning); else onClose();
    setLoading(false);
  };

  return (
    <div style={OV.overlay} onClick={onClose}>
      <div style={OV.box} onClick={e=>e.stopPropagation()}>
        <div style={OV.head}>
          <div>
            <div style={{fontWeight:700,fontSize:15,color:'#1f2937'}}>{userName}</div>
            <div style={{fontSize:13,color:'#6b7280',marginTop:2}}>{fmtDate(date)}</div>
          </div>
          <button style={OV.close} onClick={onClose}>✕</button>
        </div>
        {err&&<div className="alert alert-warn" style={{marginBottom:10,fontSize:13}}>{err}</div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Beginn ⏰</label>
            <input className="form-input" type="time" value={st} step="1800"
              onChange={e=>setSt(e.target.value)} style={{fontSize:16,fontWeight:600}}/>
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Ende ⏰</label>
            <input className="form-input" type="time" value={et} step="1800"
              onChange={e=>setEt(e.target.value)} style={{fontSize:16,fontWeight:600}}/>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:10,marginBottom:10}}>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Pause (Min.)</label>
            <input className="form-input" type="number" min="0" max="120" step="5" value={br} onChange={e=>setBr(e.target.value)}/>
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Notiz (wird im Kalender angezeigt)</label>
            <input className="form-input" type="text" value={no} onChange={e=>setNo(e.target.value)} maxLength={40} placeholder="z.B. Kasse, Lager..."/>
          </div>
        </div>
        {st&&et&&st<et&&(
          <div style={{background:'#f0f9ff',borderRadius:8,padding:'7px 12px',marginBottom:12}}>
            <div style={{position:'relative',height:10,background:'#dbeafe',borderRadius:6,overflow:'hidden'}}>
              {(()=>{const[sh,sm]=st.split(':').map(Number),[eh,em]=et.split(':').map(Number);
                const s=sh+sm/60,e=eh+em/60,l=Math.max(0,(s-6)/15*100),w=Math.min(100-l,(e-s)/15*100);
                return <div style={{position:'absolute',left:`${l}%`,width:`${w}%`,height:'100%',background:'#2563eb',borderRadius:6}}/>;
              })()}
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#94a3b8',marginTop:2}}>
              <span>06</span><span>10</span><span>14</span><span>18</span><span>21</span>
            </div>
          </div>
        )}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>{existing&&<button className="btn btn-danger btn-sm" onClick={onRequestDelete}>🗑️ Löschen</button>}</div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-outline btn-sm" onClick={onClose}>Abbrechen</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={loading}>
              {loading?'…':existing?'💾 Aktualisieren':'✅ Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const OV={
  overlay:{position:'fixed',inset:0,background:'rgba(15,23,42,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16,backdropFilter:'blur(2px)'},
  box:{background:'#fff',borderRadius:14,padding:22,width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'},
  head:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16},
  close:{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#9ca3af',lineHeight:1,padding:2},
};

// ══ EmployeeMonthPopup ════════════════════════════════════
function EmpMonthPopup({user,shifts,color,onClose}) {
  const total=shifts.reduce((s,sh)=>s+shiftH(sh),0);
  const DE=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  return (
    <div style={OV.overlay} onClick={onClose}>
      <div style={{...OV.box,maxWidth:460,maxHeight:'80vh',overflowY:'auto',padding:24}} onClick={e=>e.stopPropagation()}>
        <div style={OV.head}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:14,height:14,borderRadius:'50%',background:color}}/>
            <div>
              <div style={{fontWeight:700,fontSize:16}}>{user.name}</div>
              <div style={{fontSize:12,color:'#6b7280'}}>{user.employment_type} · {user.weekly_hours}h/W</div>
            </div>
          </div>
          <button style={OV.close} onClick={onClose}>✕</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:16}}>
          {[{l:'Arbeitstage',v:shifts.length},{l:'Gesamt Std.',v:total.toFixed(1)+'h'}].map(x=>(
            <div key={x.l} style={{background:'#f0f9ff',borderRadius:10,padding:'10px',textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:800,color:'#1e40af'}}>{x.v}</div>
              <div style={{fontSize:11,color:'#94a3b8'}}>{x.l}</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:5}}>
          {shifts.sort((a,b)=>normD(a.shift_date).localeCompare(normD(b.shift_date))).map(s=>{
            const d=new Date(normD(s.shift_date)+'T12:00:00'),h=shiftH(s);
            return (
              <div key={s.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:'9px 12px',background:'#fafafa',borderRadius:8,borderLeft:`3px solid ${color}`}}>
                <div>
                  <span style={{fontWeight:600,fontSize:13}}>{DE[d.getDay()]}</span>
                  <span style={{fontSize:12,color:'#6b7280',marginLeft:8}}>{d.getDate()}.{d.getMonth()+1}.{d.getFullYear()}</span>
                  {s.notes&&<span style={{fontSize:11,color:'#64748b',marginLeft:8,fontStyle:'italic'}}>"{s.notes}"</span>}
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontWeight:700,fontSize:14,color}}>{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</div>
                  <div style={{fontSize:11,color:'#94a3b8'}}>{h.toFixed(1)}h</div>
                </div>
              </div>
            );
          })}
          {!shifts.length&&<p style={{color:'#94a3b8',textAlign:'center',padding:'20px 0'}}>Keine Schichten.</p>}
        </div>
      </div>
    </div>
  );
}

// ══ BalanceEditor ══════════════════════════════════════════
function BalEd({userId,value,onSave,onClose}) {
  const [v,setV]=useState(String(value));
  const save=()=>{onSave(userId,parseFloat(v)||0);onClose();};
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:3,background:'#eff6ff',border:'1px solid #93c5fd',borderRadius:6,padding:'1px 5px'}}>
      <input type="number" step="0.5" value={v} autoFocus
        onChange={e=>setV(e.target.value)}
        onKeyDown={e=>{if(e.key==='Enter')save();if(e.key==='Escape')onClose();}}
        style={{width:50,border:'none',outline:'none',fontSize:11,background:'transparent',textAlign:'center'}}/>
      <span style={{fontSize:10,color:'#6b7280'}}>h</span>
      <button onClick={save} style={{background:'none',border:'none',cursor:'pointer',color:'#2563eb',fontSize:13,padding:0}}>✓</button>
      <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:13,padding:0}}>✕</button>
    </span>
  );
}

// ══════════════════════════════════════════════════════════
//  HAUPTKOMPONENTE
// ══════════════════════════════════════════════════════════
export default function ShiftCalendar({users, year, month, summary=[], onRefresh}) {
  const [shifts,  setShifts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [cell,    setCell]    = useState(null);
  const [delShift,setDelShift]= useState(null);   // Löschen-Bestätigung
  const [empPop,  setEmpPop]  = useState(null);
  const [editBal, setEditBal] = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [order,   setOrder]   = useState(null);   // null = DB-Reihenfolge
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOver,setDragOver]= useState(null);
  const [isMobile, setIsMobile]= useState(window.innerWidth<640);

  const holidays = nrwH(year);

  useEffect(()=>{
    const h=()=>setIsMobile(window.innerWidth<640);
    window.addEventListener('resize',h);
    return ()=>window.removeEventListener('resize',h);
  },[]);

  const NAME_W = isMobile ? 110 : 210;

  const uColor = uid => COLORS[users.findIndex(u=>u.id===uid)%COLORS.length];

  // Tage des Monats – LOKAL
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = useMemo(()=>Array.from({length:daysInMonth},(_,i)=>{
    const d=new Date(year,month-1,i+1);
    return {n:i+1, date:fmtLocal(d), dow:d.getDay()};
  }),[year,month]);

  // Schichten laden
  const loadShifts = useCallback(async()=>{
    setLoading(true);
    try {
      const {data}=await shiftsAPI.getByMonth(year,month);
      setShifts((data.shifts||[]).map(s=>({...s,shift_date:normD(s.shift_date)})));
    } catch(e){console.error(e);}
    setLoading(false);
  },[year,month]);
  useEffect(()=>{loadShifts();},[loadShifts]);

  const sMap={};
  shifts.forEach(s=>{sMap[`${s.shift_date}_${s.user_id}`]=s;});

  const monthH={};
  shifts.forEach(s=>{monthH[s.user_id]=(monthH[s.user_id]||0)+shiftH(s);});

  // Mitarbeiter in Anzeigereihenfolge
  const activeUsers = users.filter(u=>u.role==='employee'&&u.is_active);
  const orderedUsers = useMemo(()=>{
    if(!order) return activeUsers;
    const m=new Map(activeUsers.map(u=>[u.id,u]));
    const res=order.filter(id=>m.has(id)).map(id=>m.get(id));
    activeUsers.forEach(u=>{if(!order.includes(u.id))res.push(u);});
    return res;
  },[order,activeUsers]);

  const isGray=d=>d.dow===0||holidays.has(d.date);
  const isHoliday=d=>holidays.has(d.date);

  // ── Drag-to-Reorder ───
  const handleDragStart=(e,ui)=>{setDragIdx(ui);e.dataTransfer.effectAllowed='move';};
  const handleDragOver=(e,ui)=>{e.preventDefault();setDragOver(ui);};
  const handleDrop=(e,ui)=>{
    e.preventDefault();
    if(dragIdx===null||dragIdx===ui){setDragIdx(null);setDragOver(null);return;}
    const arr=[...orderedUsers];
    const [moved]=arr.splice(dragIdx,1);
    arr.splice(ui,0,moved);
    const newOrder=arr.map(u=>u.id);
    setOrder(newOrder);
    setDragIdx(null);setDragOver(null);
    usersAPI.updateSortOrder(newOrder).catch(()=>{});
  };

  // ── Shift speichern ───
  const handleSave=async({start_time,end_time,break_minutes,notes})=>{
    setSaving(true);
    let warning=null;
    try {
      if(cell.existing) await shiftsAPI.delete(cell.existing.id);
      const {data}=await shiftsAPI.create({user_id:cell.userId,shift_date:cell.date,
        start_time,end_time,break_minutes,notes});
      warning=data.warning||null;
      await loadShifts();onRefresh?.();
    } catch(e){console.error(e);}
    setSaving(false);
    return {warning};
  };

  // ── Shift löschen (nach Bestätigung) ───
  const confirmDelete=async()=>{
    if(!delShift) return;
    setSaving(true);
    await shiftsAPI.delete(delShift.id);
    setDelShift(null);setCell(null);
    await loadShifts();onRefresh?.();
    setSaving(false);
  };

  const saveBalance=async(userId,value)=>{
    await usersAPI.updateBalance(userId,value);onRefresh?.();
  };

  // Wochen-Summary Map: userId → worked/contract
  const wkMap={};
  summary.forEach(s=>{wkMap[s.user_id]=s;});

  return (
    <div style={{position:'relative'}}>
      {loading&&(
        <div style={{position:'absolute',inset:0,background:'rgba(255,255,255,0.82)',zIndex:50,
          display:'flex',alignItems:'center',justifyContent:'center',borderRadius:10}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
            <div style={{width:34,height:34,border:'3px solid #dbeafe',borderTopColor:'#2563eb',
              borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
            <span style={{color:'#6b7280',fontSize:13}}>Wird geladen…</span>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {cell&&!delShift&&(
        <CellModal userId={cell.userId} userName={users.find(u=>u.id===cell.userId)?.name||''}
          date={cell.date} existing={cell.existing} onSave={handleSave}
          onRequestDelete={()=>setDelShift(cell.existing)}
          onClose={()=>setCell(null)}/>
      )}

      {delShift&&(
        <DeleteShiftModal
          shift={delShift}
          userName={users.find(u=>u.id===delShift.user_id)?.name||''}
          onConfirm={confirmDelete}
          onCancel={()=>setDelShift(null)}/>
      )}

      {empPop&&(
        <EmpMonthPopup user={empPop}
          shifts={shifts.filter(s=>s.user_id===empPop.id)}
          color={uColor(empPop.id)} onClose={()=>setEmpPop(null)}/>
      )}

      {/* ══ TABELLE ══ */}
      <div style={{overflowX:'auto',borderRadius:10,border:'2px solid #334155',
        boxShadow:'0 4px 16px rgba(0,0,0,0.1)'}}>
        <table style={{borderCollapse:'collapse',minWidth:NAME_W+daysInMonth*CELL_W,width:'100%'}}>
          <thead>
            <tr>
              {/* Ecke */}
              <th style={{...TH,width:NAME_W,minWidth:NAME_W,position:'sticky',left:0,zIndex:7,
                background:'linear-gradient(135deg,#1e3a8a,#2563eb)',color:'#fff',
                textAlign:'left',padding:'10px 10px',fontSize:isMobile?11:14,fontWeight:700,
                borderRight:'2px solid #334155'}}>
                {DE_MON[month-1]} {year}
              </th>
              {days.map(d=>{
                const bg=isGray(d)?'#d1d5db':d.dow===6?DOW_HDR[6]:DOW_HDR[d.dow];
                const col=isHoliday(d)?'#dc2626':isGray(d)?'#64748b':DOW_TXT[d.dow];
                return (
                  <th key={d.n} style={{...TH,width:CELL_W,minWidth:CELL_W,background:bg,color:col,
                    borderLeft:'2px solid #334155',padding:'3px 1px'}}>
                    <div style={{fontSize:9,fontWeight:600,opacity:0.8}}>{DE_DOW[d.dow]}</div>
                    <div style={{fontSize:13,fontWeight:800,lineHeight:1.2}}>{d.n}</div>
                    {isHoliday(d)&&<div style={{fontSize:7,color:'#ef4444',fontWeight:700}}>★</div>}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {orderedUsers.map((user,ui)=>{
              const workedH   = monthH[user.id]||0;
              const weeks     = daysInMonth/7;
              const contractH = parseFloat(user.weekly_hours)*weeks;
              const diffH     = workedH-contractH;
              const storedBal = parseFloat(user.hour_balance||0);
              const wk        = wkMap[user.id];
              const color     = uColor(user.id);
              const rowBg     = ui%2===0?'#ffffff':'#f8fafc';
              const isDragOver= dragOver===ui;

              return (
                <tr key={user.id}
                  draggable
                  onDragStart={e=>handleDragStart(e,ui)}
                  onDragOver={e=>handleDragOver(e,ui)}
                  onDrop={e=>handleDrop(e,ui)}
                  onDragEnd={()=>{setDragIdx(null);setDragOver(null);}}
                  style={{
                    background:isDragOver?'#dbeafe':rowBg,
                    boxShadow:isDragOver?'0 0 0 2px #3b82f6 inset':'none',
                    opacity:dragIdx===ui?0.5:1,
                    transition:'background 0.1s',
                  }}
                >
                  {/* ── Namensspalte ── */}
                  <td style={{...TD,position:'sticky',left:0,zIndex:4,
                    background:isDragOver?'#dbeafe':rowBg,
                    borderRight:'2px solid #334155',
                    borderBottom:'2px solid #334155',
                    minWidth:NAME_W,maxWidth:NAME_W,padding:isMobile?'5px 6px':'7px 10px',
                    cursor:'grab'}}>

                    <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                      {/* Drag-Handle */}
                      <span style={{color:'#cbd5e1',fontSize:14,userSelect:'none',flexShrink:0}}>⠿</span>
                      <div style={{width:9,height:9,borderRadius:'50%',background:color,flexShrink:0,boxShadow:`0 0 0 2px ${color}33`}}/>
                      <span onClick={()=>setEmpPop(user)}
                        style={{fontWeight:700,fontSize:isMobile?11:13,color:'#1e293b',cursor:'pointer',
                          textDecoration:'underline dotted',textUnderlineOffset:2,
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {isMobile?user.name.split(' ')[0]:user.name}
                      </span>
                    </div>

                    {!isMobile&&(
                      <>
                        {/* Monatliche Stunden */}
                        <div style={{fontSize:10,color:'#475569',lineHeight:1.6,marginBottom:1}}>
                          <span style={{color:'#94a3b8'}}>Monat: </span>
                          <span style={{fontWeight:700,color:'#1e293b'}}>{workedH.toFixed(1)}h</span>
                          <span style={{color:'#94a3b8'}}>/{contractH.toFixed(0)}h</span>
                        </div>
                        {/* Wochenstunden aus Summary */}
                        {wk&&(
                          <div style={{fontSize:10,color:'#475569',lineHeight:1.4}}>
                            <span style={{color:'#94a3b8'}}>Woche: </span>
                            <span style={{fontWeight:600}}>{wk.worked_hours}h/{wk.contract_hours}h</span>
                          </div>
                        )}
                        {/* Balance */}
                        <div style={{display:'flex',alignItems:'center',gap:3,marginTop:2,flexWrap:'wrap'}}>
                          <span style={{fontSize:10,fontWeight:700,
                            color:diffH>=0?'#059669':'#dc2626',
                            background:diffH>=0?'#d1fae5':'#fee2e2',
                            borderRadius:4,padding:'0 5px'}}>
                            {diffH>=0?'+':''}{diffH.toFixed(1)}h
                          </span>
                          {storedBal!==0&&<span style={{fontSize:9,color:'#64748b'}}>🏦{storedBal>=0?'+':''}{storedBal}</span>}
                          {editBal===user.id
                            ?<BalEd userId={user.id} value={storedBal} onSave={saveBalance} onClose={()=>setEditBal(null)}/>
                            :<button onClick={()=>setEditBal(user.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:10,padding:0}}>✏️</button>
                          }
                        </div>
                      </>
                    )}
                    {isMobile&&(
                      <div style={{fontSize:9,color:diffH>=0?'#059669':'#dc2626',fontWeight:700}}>
                        {diffH>=0?'+':''}{diffH.toFixed(1)}h
                      </div>
                    )}
                  </td>

                  {/* ── Tageszellen ── */}
                  {days.map(day=>{
                    const gray  = isGray(day);
                    const shift = sMap[`${day.date}_${user.id}`];
                    const bg    = gray?(isHoliday(day)?'#fef2f2':DOW_BG[0]):day.dow===6?DOW_BG[6]:DOW_BG[day.dow];

                    let barLeft=0,barW=0;
                    if(shift){
                      const [sh,sm]=shift.start_time.split(':').map(Number),[eh,em]=shift.end_time.split(':').map(Number);
                      const st=sh+sm/60,et=eh+em/60;
                      barLeft=timeToPx(Math.max(st,START_H));
                      barW=timeToPx(Math.min(et,END_H))-barLeft;
                    }

                    return (
                      <td key={day.n}
                        onClick={()=>!gray&&setCell({userId:user.id,date:day.date,existing:shift||null})}
                        style={{...TD,padding:0,
                          borderLeft:'2px solid #334155',
                          borderBottom:'2px solid #334155',
                          background:bg,cursor:gray?'default':'pointer',position:'relative'}}>
                        <div style={{width:CELL_W,height:BAR_H+12,display:'flex',
                          alignItems:'center',padding:'2px 3px',position:'relative'}}>

                          {!gray&&(
                            <div style={{position:'absolute',left:3,right:3,top:'50%',
                              transform:'translateY(-50%)',height:3,
                              background:'rgba(0,0,0,0.07)',borderRadius:2}}/>
                          )}

                          {shift&&(
                            <div style={{
                              position:'absolute',
                              left:3+barLeft*(CELL_W-6)/CELL_W,
                              width:Math.max(barW*(CELL_W-6)/CELL_W,6),
                              top:'50%',transform:'translateY(-50%)',
                              height:BAR_H,background:color,
                              borderRadius:4,zIndex:2,
                              boxShadow:`0 2px 5px ${color}55`,
                              display:'flex',alignItems:'center',justifyContent:'center',
                              overflow:'hidden',cursor:'pointer',
                            }}>
                              {barW*(CELL_W-6)/CELL_W>18&&(
                                <span style={{color:'#fff',fontSize:8,fontWeight:700,
                                  lineHeight:1.2,textAlign:'center',padding:'0 2px',
                                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                                  maxWidth:'100%'}}>
                                  {/* Notiz anzeigen wenn vorhanden, sonst Uhrzeit */}
                                  {shift.notes ? shift.notes : `${shift.start_time.slice(0,5)}–${shift.end_time.slice(0,5)}`}
                                </span>
                              )}
                            </div>
                          )}

                          {!shift&&!gray&&(
                            <div style={{position:'absolute',inset:0,display:'flex',
                              alignItems:'center',justifyContent:'center',
                              color:'#cbd5e1',fontSize:16,fontWeight:300,
                              opacity:0,transition:'opacity 0.12s'}} className="add-hint">+</div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legende */}
      <div style={{display:'flex',gap:12,marginTop:10,flexWrap:'wrap',fontSize:11,color:'#64748b',
        background:'#f8fafc',borderRadius:8,padding:'8px 12px'}}>
        <span>💡 <b>Klick</b> → Schicht eintragen</span>
        <span>📊 <b>Name</b> → Monatsübersicht</span>
        <span>⠿ <b>Ziehen</b> → Reihenfolge ändern</span>
        <span style={{display:'flex',alignItems:'center',gap:3}}>
          <span style={{width:12,height:8,background:'#d1d5db',borderRadius:2,display:'inline-block'}}/>So/Feiertag
        </span>
        <span style={{display:'flex',alignItems:'center',gap:3}}>
          <span style={{width:12,height:8,background:'#fed7aa',borderRadius:2,display:'inline-block'}}/>Samstag
        </span>
      </div>
      <style>{`tbody td:hover .add-hint{opacity:1!important}`}</style>
    </div>
  );
}

const TH={padding:'4px 2px',textAlign:'center',whiteSpace:'nowrap',top:0,zIndex:3,position:'sticky'};
const TD={verticalAlign:'middle',whiteSpace:'nowrap'};
