import { useState, useEffect, useCallback } from 'react';
import { usersAPI, shiftsAPI } from '../services/api';
import Navbar from '../components/Shared/Navbar';
import ShiftCalendar from '../components/Admin/ShiftCalendar';
import UserList from '../components/Admin/UserList';
import HoursWarning from '../components/Admin/HoursWarning';
import LoadingSpinner from '../components/Shared/LoadingSpinner';

const DE_MONTHS=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

const getMonday=(y,m)=>{
  const d=new Date(y,m-1,1),day=d.getDay(),diff=day===0?-6:1-day;
  d.setDate(d.getDate()+diff);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const TABS=['📅 Schichtplan','👥 Mitarbeiter'];

export default function AdminDashboard() {
  const now=new Date();
  const [tab,   setTab]   = useState(0);
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()+1);
  const [users, setUsers] = useState([]);
  const [summary,setSummary]=useState([]);
  const [notifying,setNotifying]=useState(false);
  const [notifyMsg,setNotifyMsg]=useState('');
  const [usersLoading,setUL]=useState(true);

  const fetchUsers=useCallback(async()=>{
    setUL(true);
    try {
      const [ur,sr]=await Promise.all([usersAPI.getAll(),shiftsAPI.hoursSummary(getMonday(year,month))]);
      setUsers(ur.data);setSummary(sr.data.summary||[]);
    } catch(e){console.error(e);}
    setUL(false);
  },[year,month]);

  useEffect(()=>{fetchUsers();},[fetchUsers]);

  const prevM=()=>{if(month===1){setYear(y=>y-1);setMonth(12);}else setMonth(m=>m-1);};
  const nextM=()=>{if(month===12){setYear(y=>y+1);setMonth(1);}else setMonth(m=>m+1);};

  const handleNotify=async()=>{
    setNotifying(true);setNotifyMsg('');
    try{const{data}=await shiftsAPI.notifyAll(getMonday(year,month));setNotifyMsg(data.message);}
    catch{setNotifyMsg('Fehler.');}
    setNotifying(false);
  };

  const exceeded=summary.filter(s=>s.exceeded);

  return (
    <div style={{minHeight:'100vh',background:'#f1f5f9'}}>
      <Navbar title="Admin – Schichtplan"/>
      <div style={{padding:'12px 8px',maxWidth:'100%'}}>

        {/* Tabs */}
        <div style={{display:'flex',gap:3,marginBottom:12,background:'#e2e8f0',
          borderRadius:10,padding:4,maxWidth:340}}>
          {TABS.map((t,i)=>(
            <button key={t} onClick={()=>setTab(i)} style={{
              flex:1,padding:'7px 0',border:'none',borderRadius:8,
              fontWeight:600,fontSize:13,cursor:'pointer',transition:'all 0.15s',
              background:tab===i?'#fff':'transparent',
              color:tab===i?'#1e293b':'#64748b',
              boxShadow:tab===i?'0 1px 4px rgba(0,0,0,0.1)':'none',
            }}>{t}</button>
          ))}
        </div>

        {tab===0&&(
          <>
            {/* Monats-Navigation */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
              background:'#fff',borderRadius:12,padding:'10px 14px',marginBottom:10,
              boxShadow:'0 1px 4px rgba(0,0,0,0.07)',flexWrap:'wrap',gap:8}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <button className="btn btn-outline btn-sm" onClick={prevM}>← Vormonat</button>
                <div style={{textAlign:'center',minWidth:130}}>
                  <div style={{fontSize:18,fontWeight:800,color:'#1e293b'}}>{DE_MONTHS[month-1]}</div>
                  <div style={{fontSize:12,color:'#64748b'}}>{year}</div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={nextM}>Nächster →</button>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                {notifyMsg&&<span style={{fontSize:12,color:'#059669',fontWeight:500}}>✅ {notifyMsg}</span>}
                <button className="btn btn-primary btn-sm" onClick={handleNotify} disabled={notifying}>
                  {notifying?'…':'📧 Alle benachrichtigen'}
                </button>
              </div>
            </div>

            {exceeded.length>0&&<HoursWarning summary={summary}/>}

            {usersLoading?<LoadingSpinner/>:(
              <div style={{background:'#fff',borderRadius:12,padding:'12px 8px',
                boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
                <ShiftCalendar users={users} year={year} month={month}
                  summary={summary} onRefresh={fetchUsers}/>
              </div>
            )}
          </>
        )}

        {tab===1&&(
          usersLoading?<LoadingSpinner/>:<UserList users={users} onRefresh={fetchUsers}/>
        )}
      </div>
    </div>
  );
}
