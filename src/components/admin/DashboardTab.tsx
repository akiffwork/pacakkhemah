"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";

type Vendor = {
  id: string; name: string; status: string; credits?: number;
  createdAt?: any; city?: string; is_vacation?: boolean; phone?: string;
  slug?: string; rating?: number; reviewCount?: number;
};

type Transaction = {
  id: string; vendorId: string; vendorName?: string;
  amount: number; credits: number; type: string; createdAt: any;
};

type Order = {
  vendorId: string; vendorName?: string;
  customerName?: string; customerPhone?: string;
  items: { name: string; qty: number; price: number }[];
  totalAmount: number; rentalAmount?: number; depositAmount?: number;
  bookingDates: { start: string; end: string };
  status: string; paymentStatus?: string;
  createdAt: any;
};

type View = "dashboard" | "vendors" | "orders" | "finance" | "content" | "campsites" | "settings";
type Props = { allVendors: Vendor[]; onNavigate?: (tab: View) => void };

const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function DashboardTab({ allVendors, onNavigate }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<{ rating: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d"|"30d"|"90d">("30d");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [tS,oS,rS] = await Promise.all([
        getDocs(query(collection(db,"transactions"),orderBy("createdAt","desc"),limit(200))),
        getDocs(query(collection(db,"orders"),orderBy("createdAt","desc"))),
        getDocs(query(collection(db,"reviews"),orderBy("createdAt","desc"),limit(100))),
      ]);
      setTransactions(tS.docs.map(d=>({id:d.id,...d.data()} as Transaction)));
      setOrders(oS.docs.map(d=>d.data() as Order).filter(o=>!(o as any).deleted));
      setReviews(rS.docs.map(d=>({rating:d.data().rating})));
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  const now = new Date();
  const daysAgo = (d:number) => new Date(now.getTime()-d*86400000);
  const rangeDays = timeRange==="7d"?7:timeRange==="30d"?30:90;
  const rangeStart = daysAgo(rangeDays);
  const prevStart = daysAgo(rangeDays*2);

  const approved = allVendors.filter(v=>v.status==="approved");
  const pending = allVendors.filter(v=>v.status==="pending");
  const active = approved.filter(v=>(v.credits||0)>0&&!v.is_vacation);
  const lowCredit = approved.filter(v=>(v.credits||0)<=5&&(v.credits||0)>0);
  const vacation = approved.filter(v=>v.is_vacation);
  const newVendors = allVendors.filter(v=>v.createdAt?.toDate?.()>=rangeStart);

  const recentTx = transactions.filter(t=>t.createdAt?.toDate?.()>=rangeStart);
  const prevTx = transactions.filter(t=>{const d=t.createdAt?.toDate?.();return d>=prevStart&&d<rangeStart;});
  const txRev = recentTx.reduce((s,t)=>s+(t.amount||0),0);
  const prevTxRev = prevTx.reduce((s,t)=>s+(t.amount||0),0);
  const txChange = prevTxRev>0?Math.round(((txRev-prevTxRev)/prevTxRev)*100):0;

  const getRev = (o:Order) => o.rentalAmount ?? o.totalAmount ?? 0;
  const valid = orders.filter(o=>o.status!=="cancelled");
  const completed = orders.filter(o=>o.status==="completed");
  const recentO = valid.filter(o=>o.createdAt?.toDate?.()>=rangeStart);
  const prevO = valid.filter(o=>{const d=o.createdAt?.toDate?.();return d>=prevStart&&d<rangeStart;});
  const totalGMV = completed.reduce((s,o)=>s+getRev(o),0);
  const recentGMV = recentO.filter(o=>o.status==="completed").reduce((s,o)=>s+getRev(o),0);
  const prevGMV = prevO.filter(o=>o.status==="completed").reduce((s,o)=>s+getRev(o),0);
  const gmvChange = prevGMV>0?Math.round(((recentGMV-prevGMV)/prevGMV)*100):0;
  const pendingO = orders.filter(o=>o.status==="pending").length;
  const confirmedO = orders.filter(o=>o.status==="confirmed").length;
  const customers = new Set(valid.map(o=>o.customerPhone).filter(Boolean)).size;
  const recentCust = new Set(recentO.map(o=>o.customerPhone).filter(Boolean)).size;
  const prevCust = new Set(prevO.map(o=>o.customerPhone).filter(Boolean)).size;
  const custChange = prevCust>0?Math.round(((recentCust-prevCust)/prevCust)*100):0;
  const avgRating = reviews.length>0?(reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1):"—";

  const monthly = Array.from({length:6},(_,i)=>{
    const d=new Date();d.setMonth(d.getMonth()-(5-i));
    const m=d.getMonth(),y=d.getFullYear(),label=MO[m];
    const mO=completed.filter(o=>{const t=o.createdAt?.toDate?.();return t&&t.getMonth()===m&&t.getFullYear()===y;});
    const mT=transactions.filter(t=>{const d=t.createdAt?.toDate?.();return d&&d.getMonth()===m&&d.getFullYear()===y;});
    return{label,gmv:mO.reduce((s,o)=>s+getRev(o),0),tx:mT.reduce((s,t)=>s+(t.amount||0),0),orders:mO.length};
  });

  const vGMV:Record<string,{name:string;gmv:number;orders:number}> = {};
  completed.forEach(o=>{const v=o.vendorId;if(!vGMV[v]){const vd=allVendors.find(x=>x.id===v);vGMV[v]={name:vd?.name||o.vendorName||"?",gmv:0,orders:0};}vGMV[v].gmv+=getRev(o);vGMV[v].orders++;});
  const topV = Object.entries(vGMV).sort((a,b)=>b[1].gmv-a[1].gmv).slice(0,5);

  const locCounts:Record<string,number>={};
  approved.forEach(v=>{const c=v.city||"Unknown";locCounts[c]=(locCounts[c]||0)+1;});
  const topLoc = Object.entries(locCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const funnel = [
    {label:"Total",count:valid.length,color:"bg-slate-400"},
    {label:"Confirmed",count:confirmedO,color:"bg-blue-400"},
    {label:"Completed",count:completed.length,color:"bg-emerald-500"},
    {label:"Cancelled",count:orders.filter(o=>o.status==="cancelled").length,color:"bg-red-400"},
  ];

  const payDist = {
    unpaid:valid.filter(o=>!o.paymentStatus||o.paymentStatus==="unpaid").length,
    deposit:valid.filter(o=>o.paymentStatus==="deposit_paid").length,
    full:valid.filter(o=>o.paymentStatus==="full_paid").length,
    refunded:valid.filter(o=>o.paymentStatus==="refunded").length,
  };

  const activity:{text:string;time:string;icon:string;color:string}[]=[];
  orders.slice(0,5).forEach(o=>{const t=o.createdAt?.toDate?.();if(t)activity.push({text:`${o.customerName||"Customer"} → ${o.vendorName||"vendor"}`,time:t.toLocaleDateString("en-MY",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}),icon:"fa-shopping-bag",color:"bg-emerald-100 text-emerald-600"});});
  allVendors.filter(v=>v.createdAt?.toDate?.()>=daysAgo(7)).slice(0,3).forEach(v=>{const t=v.createdAt?.toDate?.();if(t)activity.push({text:`${v.name} registered`,time:t.toLocaleDateString("en-MY",{day:"numeric",month:"short"}),icon:"fa-store",color:"bg-blue-100 text-blue-600"});});

  function CB({v}:{v:number}){if(!v)return null;return<span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${v>0?"bg-emerald-100 text-emerald-600":"bg-red-100 text-red-500"}`}><i className={`fas ${v>0?"fa-arrow-up":"fa-arrow-down"} mr-0.5`}></i>{v>0?"+":""}{v}%</span>;}

  if(loading)return<div className="flex items-center justify-center h-64"><i className="fas fa-spinner fa-spin text-2xl text-slate-300"></i></div>;

  return(
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex bg-white rounded-xl border border-slate-200 p-1">
          {(["7d","30d","90d"] as const).map(r=>(<button key={r} onClick={()=>setTimeRange(r)} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${timeRange===r?"bg-[#062c24] text-white":"text-slate-500 hover:bg-slate-100"}`}>{r}</button>))}
        </div>
        <button onClick={loadData} className="text-[9px] font-bold text-slate-400 hover:text-emerald-600"><i className="fas fa-sync-alt mr-1"></i>Refresh</button>
      </div>

      {(pending.length>0||pendingO>0||lowCredit.length>0)&&(
        <div className="flex flex-wrap gap-2">
          {pending.length>0&&<button onClick={()=>onNavigate?.("vendors")} className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2.5 rounded-xl text-[10px] font-black hover:bg-amber-100 transition-colors"><i className="fas fa-user-clock"></i>{pending.length} pending approval{pending.length>1?"s":""}</button>}
          {pendingO>0&&<button onClick={()=>onNavigate?.("orders")} className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2.5 rounded-xl text-[10px] font-black hover:bg-blue-100 transition-colors"><i className="fas fa-shopping-bag"></i>{pendingO} pending order{pendingO>1?"s":""}</button>}
          {lowCredit.length>0&&<div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-[10px] font-black"><i className="fas fa-battery-quarter"></i>{lowCredit.length} low credits</div>}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 p-5"><div className="flex items-start justify-between mb-3"><div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><i className="fas fa-coins"></i></div><CB v={txChange}/></div><p className="text-2xl font-black text-[#062c24]">RM{txRev.toLocaleString()}</p><p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Platform Revenue</p></div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5"><div className="flex items-start justify-between mb-3"><div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><i className="fas fa-chart-line"></i></div><CB v={gmvChange}/></div><p className="text-2xl font-black text-[#062c24]">RM{totalGMV.toLocaleString()}</p><p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Total GMV</p></div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5"><div className="flex items-start justify-between mb-3"><div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center"><i className="fas fa-users"></i></div><CB v={custChange}/></div><p className="text-2xl font-black text-[#062c24]">{customers}</p><p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Total Customers</p></div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5"><div className="flex items-start justify-between mb-3"><div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center"><i className="fas fa-star"></i></div></div><p className="text-2xl font-black text-[#062c24]">{avgRating}</p><p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Avg Rating ({reviews.length})</p></div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white rounded-xl border border-slate-100 p-3 text-center"><p className="text-lg font-black text-[#062c24]">{approved.length}</p><p className="text-[8px] font-bold text-slate-400 uppercase">Vendors</p></div>
        <div className="bg-white rounded-xl border border-slate-100 p-3 text-center"><p className="text-lg font-black text-emerald-600">{active.length}</p><p className="text-[8px] font-bold text-slate-400 uppercase">Active</p></div>
        <div className="bg-white rounded-xl border border-slate-100 p-3 text-center"><p className="text-lg font-black text-[#062c24]">{valid.length}</p><p className="text-[8px] font-bold text-slate-400 uppercase">Orders</p></div>
        <div className="bg-white rounded-xl border border-slate-100 p-3 text-center"><p className="text-lg font-black text-[#062c24]">{newVendors.length}</p><p className="text-[8px] font-bold text-slate-400 uppercase">New</p></div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-[9px] font-black text-slate-400 uppercase mb-4">Monthly Performance</p>
          <div className="flex items-end gap-2 h-36">
            {monthly.map((m,i)=>{const mx=Math.max(...monthly.map(x=>x.gmv+x.tx),1);const gH=(m.gmv/mx)*100;const tH=(m.tx/mx)*100;return(
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                {(m.gmv+m.tx)>0&&<p className="text-[6px] font-bold text-slate-400">RM{(m.gmv+m.tx).toLocaleString()}</p>}
                <div className="w-full flex-1 flex flex-col justify-end gap-0.5"><div className="w-full bg-emerald-400 rounded-t-sm" style={{height:`${gH}%`,minHeight:m.gmv>0?"2px":"0"}}></div><div className="w-full bg-blue-300 rounded-b-sm" style={{height:`${tH}%`,minHeight:m.tx>0?"2px":"0"}}></div></div>
                <p className="text-[7px] font-bold text-slate-400">{m.label}</p>
              </div>
            );})}
          </div>
          <div className="flex items-center justify-center gap-4 mt-3"><span className="flex items-center gap-1 text-[8px] font-bold text-slate-400"><span className="w-2 h-2 bg-emerald-400 rounded-sm"></span>GMV</span><span className="flex items-center gap-1 text-[8px] font-bold text-slate-400"><span className="w-2 h-2 bg-blue-300 rounded-sm"></span>Credits</span></div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-[9px] font-black text-slate-400 uppercase mb-4">Order Pipeline</p>
          <div className="space-y-3">
            {funnel.map(f=>{const pct=valid.length>0?(f.count/valid.length)*100:0;return(<div key={f.label}><div className="flex justify-between mb-1"><span className="text-[10px] font-bold text-slate-600">{f.label}</span><span className="text-[10px] font-black text-[#062c24]">{f.count} ({Math.round(pct)}%)</span></div><div className="bg-slate-100 rounded-full h-2.5 overflow-hidden"><div className={`h-full rounded-full ${f.color}`} style={{width:`${pct}%`}}></div></div></div>);})}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase mb-3">Payment Status</p><div className="grid grid-cols-4 gap-2"><div className="text-center"><p className="text-sm font-black text-red-500">{payDist.unpaid}</p><p className="text-[7px] text-slate-400 font-bold">Unpaid</p></div><div className="text-center"><p className="text-sm font-black text-amber-600">{payDist.deposit}</p><p className="text-[7px] text-slate-400 font-bold">Deposit</p></div><div className="text-center"><p className="text-sm font-black text-emerald-600">{payDist.full}</p><p className="text-[7px] text-slate-400 font-bold">Full</p></div><div className="text-center"><p className="text-sm font-black text-blue-600">{payDist.refunded}</p><p className="text-[7px] text-slate-400 font-bold">Refunded</p></div></div></div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4"><p className="text-[9px] font-black text-slate-400 uppercase">Top Vendors by GMV</p><button onClick={()=>onNavigate?.("vendors")} className="text-[8px] font-bold text-emerald-600 hover:underline">View all →</button></div>
          {topV.length===0?<p className="text-[10px] text-slate-300 text-center py-6">No data</p>:(
            <div className="space-y-2.5">{topV.map(([vid,v],i)=>{const mx=topV[0]?.[1].gmv||1;return(<div key={vid} className="flex items-center gap-3"><span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black ${i===0?"bg-amber-100 text-amber-600":i===1?"bg-slate-200 text-slate-600":"bg-slate-100 text-slate-400"}`}>{i+1}</span><div className="flex-1 min-w-0"><p className="text-[10px] font-black text-[#062c24] truncate">{v.name}</p><div className="bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden"><div className="h-full bg-emerald-400 rounded-full" style={{width:`${(v.gmv/mx)*100}%`}}></div></div></div><div className="text-right shrink-0"><p className="text-[10px] font-black text-emerald-600">RM{v.gmv.toLocaleString()}</p><p className="text-[7px] text-slate-400">{v.orders} orders</p></div></div>);})}</div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-[9px] font-black text-slate-400 uppercase mb-4">Vendor Locations</p>
          <div className="space-y-3">{topLoc.map(([city,count])=>(<div key={city} className="flex items-center gap-3"><div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0"><i className="fas fa-map-marker-alt text-xs"></i></div><div className="flex-1 min-w-0"><p className="text-[10px] font-bold text-[#062c24]">{city}</p><div className="bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden"><div className="h-full bg-blue-400 rounded-full" style={{width:`${(count/(topLoc[0]?.[1]||1))*100}%`}}></div></div></div><span className="text-[10px] font-black text-[#062c24] shrink-0">{count}</span></div>))}</div>
          <div className="mt-5 pt-4 border-t border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase mb-3">Vendor Health</p><div className="grid grid-cols-3 gap-2"><div className="text-center bg-emerald-50 rounded-lg py-2"><p className="text-sm font-black text-emerald-600">{active.length}</p><p className="text-[7px] text-emerald-700 font-bold">Active</p></div><div className="text-center bg-amber-50 rounded-lg py-2"><p className="text-sm font-black text-amber-600">{vacation.length}</p><p className="text-[7px] text-amber-700 font-bold">Vacation</p></div><div className="text-center bg-red-50 rounded-lg py-2"><p className="text-sm font-black text-red-500">{lowCredit.length}</p><p className="text-[7px] text-red-700 font-bold">Low Credits</p></div></div></div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-[9px] font-black text-slate-400 uppercase mb-4">Recent Activity</p>
          {activity.length===0?<p className="text-[10px] text-slate-300 text-center py-6">No activity</p>:(
            <div className="space-y-3">{activity.slice(0,6).map((a,i)=>(<div key={i} className="flex items-start gap-3"><div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${a.color}`}><i className={`fas ${a.icon} text-xs`}></i></div><div className="flex-1 min-w-0"><p className="text-[10px] font-bold text-[#062c24] leading-snug">{a.text}</p><p className="text-[8px] text-slate-400 mt-0.5">{a.time}</p></div></div>))}</div>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-br from-[#062c24] to-emerald-800 rounded-2xl p-5 text-white">
        <p className="text-[9px] font-black text-emerald-400 uppercase mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <button onClick={()=>onNavigate?.("vendors")} className="bg-white/10 hover:bg-white/20 px-4 py-3 rounded-xl text-[9px] font-black uppercase transition-colors"><i className="fas fa-user-check mr-1.5"></i>Approve Vendors</button>
          <button onClick={()=>onNavigate?.("orders")} className="bg-white/10 hover:bg-white/20 px-4 py-3 rounded-xl text-[9px] font-black uppercase transition-colors"><i className="fas fa-receipt mr-1.5"></i>View Orders</button>
          <button onClick={()=>onNavigate?.("finance")} className="bg-white/10 hover:bg-white/20 px-4 py-3 rounded-xl text-[9px] font-black uppercase transition-colors"><i className="fas fa-wallet mr-1.5"></i>Manage Credits</button>
          <button onClick={()=>onNavigate?.("content")} className="bg-white/10 hover:bg-white/20 px-4 py-3 rounded-xl text-[9px] font-black uppercase transition-colors"><i className="fas fa-edit mr-1.5"></i>Edit Content</button>
        </div>
      </div>
    </div>
  );
}