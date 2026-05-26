import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { shiftsAPI } from '../services/api';
import Navbar from '../components/Shared/Navbar';
import NextShift from '../components/Employee/NextShift';
import MyWeek from '../components/Employee/MyWeek';
import LoadingSpinner from '../components/Shared/LoadingSpinner';

const getMonday = (offset=0) => {
  const d=new Date(), day=d.getDay(), diff=(day===0?-6:1-day)+offset*7;
  d.setDate(d.getDate()+diff);
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
};
const fmtDate=s=>{if(!s)return '';const[y,m,d]=String(s).slice(0,10).split('-').map(Number);return `${String(d).padStart(2,'0')}.${String(m).padStart(2,'0')}.${y}`;};
const wkLabel=o=>o===0?'Diese Woche':o===1?'Nächste Woche':o===2?'Übernächste Woche':`In ${o} Wochen`;

export default function EmployeeDashboard() {
  const {user}=useAuth();
  const [wo,setWo]=useState(0);          // weekOffset: 0..3 only
  const [shifts,setShifts]=useState([]);
  const [wk,setWk]=useState({});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const fetch=async()=>{
    setLoading(true);setError('');
    try {
      const week=getMonday(wo);
      const {data}=await shiftsAPI.getByWeek(week);
      setShifts((data.shifts||[]).map(s=>({...s,shift_date:String(s.shift_date).slice(0,10)})));
      setWk({start:String(data.weekStart).slice(0,10),end:String(data.weekEnd).slice(0,10)});
    } catch{setError('Fehler beim Laden.');}
    setLoading(false);
  };
  useEffect(()=>{fetch();},[wo]);

  const EMP={minijob:'Minijob',teilzeit:'Teilzeit',vollzeit:'Vollzeit'};

  return (
    <div style={{minHeight:'100vh',background:'#f1f5f9'}}>
      <Navbar title="Mein Schichtplan"/>
      <div style={{maxWidth:680,margin:'0 auto',padding:'16px 14px'}}>

        {/* Begrüßung */}
        <div style={{background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:14,
          padding:'18px 20px',marginBottom:14,color:'#fff',
          boxShadow:'0 4px 16px rgba(37,99,235,0.3)'}}>
          <h2 style={{fontSize:20,fontWeight:700,marginBottom:6}}>Hallo, {user?.name} 👋</h2>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {[EMP[user?.employment_type], `${user?.weekly_hours} Std./Woche`].map(t=>(
              <span key={t} style={{background:'rgba(255,255,255,0.2)',borderRadius:20,
                padding:'2px 10px',fontSize:12,fontWeight:500}}>{t}</span>
            ))}
          </div>
        </div>

        {error&&<div className="alert alert-danger">{error}</div>}

        {wo===0&&!loading&&shifts.length>0&&(
          <div style={{marginBottom:14}}><NextShift shifts={shifts}/></div>
        )}

        {/* Navigation: nur 0-3 */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
          background:'#fff',borderRadius:12,padding:'12px 16px',marginBottom:12,
          boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
          <button className="btn btn-outline btn-sm"
            onClick={()=>setWo(w=>Math.max(0,w-1))}
            disabled={wo===0} style={{opacity:wo===0?0.3:1}}>← Zurück</button>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:14,fontWeight:700,color:'#1e293b'}}>{wkLabel(wo)}</div>
            {wk.start&&<div style={{fontSize:12,color:'#64748b',marginTop:1}}>
              {fmtDate(wk.start)} – {fmtDate(wk.end)}</div>}
          </div>
          {/* MAX 3 Wochen voraus */}
          <button className="btn btn-outline btn-sm"
            onClick={()=>setWo(w=>Math.min(3,w+1))}
            disabled={wo>=3} style={{opacity:wo>=3?0.3:1}}>Vor →</button>
        </div>

        {!loading&&shifts.length===0&&(
          <div className="card" style={{textAlign:'center',padding:'36px 0',color:'#94a3b8'}}>
            <div style={{fontSize:36,marginBottom:8}}>📭</div>
            <div style={{fontSize:14,fontWeight:500}}>Keine Schichten für diese Woche.</div>
            <div style={{fontSize:12,marginTop:4}}>Bitte überprüfe andere Wochen oder wende dich an deinen Vorgesetzten.</div>
          </div>
        )}

        {loading?<LoadingSpinner/>:<MyWeek shifts={shifts} weekStart={wk.start} weekEnd={wk.end}/>}
      </div>
    </div>
  );
}
