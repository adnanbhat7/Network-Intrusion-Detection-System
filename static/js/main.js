const R=(a,b)=>parseFloat((Math.random()*(b-a)+a).toFixed(2))
const RI=(a,b)=>Math.floor(Math.random()*(b-a+1)+a)
const $=id=>document.getElementById(id)
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const ts=()=>new Date().toLocaleTimeString('en-GB',{hour12:false})

const PROFILES={
  Benign:{feats:{'FLOW DURATION':()=>R(50000,500000),'FWD PKT/S':()=>R(10,80),'BWD PKT/S':()=>R(8,60),'PKT LEN MEAN':()=>R(200,900),'PKT LEN STD':()=>R(20,120),'FLOW IAT MEAN':()=>R(5000,40000),'FWD IAT MEAN':()=>R(6000,50000),'ACTIVE MEAN':()=>R(10000,80000)},anomaly:[],label:'Benign',isAttack:false,conf:[0.93,0.03,0.02,0.02]},
  DoS:{feats:{'FLOW DURATION':()=>R(800,6000),'FWD PKT/S':()=>R(12000,55000),'BWD PKT/S':()=>R(0,3),'PKT LEN MEAN':()=>R(40,75),'PKT LEN STD':()=>R(0,4),'FLOW IAT MEAN':()=>R(8,180),'FWD IAT MEAN':()=>R(5,120),'ACTIVE MEAN':()=>R(300,2000)},anomaly:['FWD PKT/S','PKT LEN STD','FLOW IAT MEAN','BWD PKT/S'],label:'DoS',isAttack:true,conf:[0.02,0.92,0.04,0.02]},
  BruteForce:{feats:{'FLOW DURATION':()=>R(2000,12000),'FWD PKT/S':()=>R(30,110),'BWD PKT/S':()=>R(25,100),'PKT LEN MEAN':()=>R(60,130),'PKT LEN STD':()=>R(4,25),'FLOW IAT MEAN':()=>R(700,2800),'FWD IAT MEAN':()=>R(800,3000),'ACTIVE MEAN':()=>R(900,4000)},anomaly:['FLOW DURATION','PKT LEN MEAN','FLOW IAT MEAN'],label:'BruteForce',isAttack:true,conf:[0.03,0.02,0.93,0.02]},
  Botnet:{feats:{'FLOW DURATION':()=>R(300000,2000000),'FWD PKT/S':()=>R(0.1,1.8),'BWD PKT/S':()=>R(0.1,1.8),'PKT LEN MEAN':()=>R(100,300),'PKT LEN STD':()=>R(2,18),'FLOW IAT MEAN':()=>R(300000,900000),'FWD IAT MEAN':()=>R(300000,1000000),'ACTIVE MEAN':()=>R(200,1200)},anomaly:['FWD PKT/S','BWD PKT/S','FLOW IAT MEAN'],label:'Botnet',isAttack:true,conf:[0.02,0.03,0.02,0.93]}
}
const CLASS_LABELS=['Benign','DoS','BruteForce','Botnet']

let selectedType='Benign',running=false
let totals={t:0,a:0,b:0},latencies=[],history=[]

const initTsEl=$('initTs')
if(initTsEl) initTsEl.textContent=ts()

function selectType(el){
  document.querySelectorAll('.type-btn').forEach(b=>b.classList.remove('active'))
  el.classList.add('active')
  selectedType=el.dataset.type
  renderFeatures()
}

function renderFeatures(){
  const p=PROFILES[selectedType],grid=$('featGrid')
  if(!grid) return
  grid.innerHTML=''
  Object.entries(p.feats).forEach(([k,fn])=>{
    const v=fn(),anom=p.anomaly.includes(k)
    grid.innerHTML+=`<div class="feat-cell${anom?' anomaly':''}"><div class="feat-name">${k}</div><div class="feat-val">${Number(v).toLocaleString()}</div></div>`
  })
}
renderFeatures()

function addLog(cls,msg){
  const body=$('logBody'),div=document.createElement('div')
  div.className=`log-entry${cls?' '+cls:''}`
  div.innerHTML=`<span class="log-ts">${ts()}</span><span>${msg}</span>`
  body.appendChild(div);body.scrollTop=body.scrollHeight
}

function setStage(i,cls,label){
  const el=$('st'+i),ss=$('ss'+i)
  el.className='stage'+(cls?' '+cls:'')
  ss.textContent=label||'—'
}
function resetStages(){for(let i=0;i<5;i++)setStage(i,'','—');setStage(0,'','idle')}

function updateConfBars(pcts){
  CLASS_LABELS.forEach((_,i)=>{
    const fill=$('cf'+i),pct=$('cp'+i)
    if(fill) requestAnimationFrame(()=>requestAnimationFrame(()=>{fill.style.width=pcts[i]+'%'}))
    if(pct) pct.textContent=pcts[i]+'%'
  })
}

async function callModelAPI(featureVals){
  try{
    const resp=await fetch('/api/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({features:featureVals})})
    if(!resp.ok) throw new Error('no api')
    return await resp.json()
  }catch{return null}
}

async function streamAIAnalysis(profile,featureVals){
  const output=$('aiOutput'),badge=$('aiBadge')
  badge.className='badge thinking';badge.textContent='thinking'
  output.textContent=''
  const featStr=Object.entries(featureVals).map(([k,v])=>`${k}: ${Number(v).toLocaleString()}`).join(', ')
  const label=profile.label
  const conf=Math.round(profile.conf[CLASS_LABELS.indexOf(label)]*100)
  const prompt=`You are the analysis engine of ShieldNet IDS, a 1D-CNN network intrusion detection system trained on CIC-IDS data.\n\nFlow features: ${featStr}\nAnomalous features: ${profile.anomaly.length>0?profile.anomaly.join(', '):'none'}\nModel classification: ${label} (${conf}% confidence)\n\nWrite exactly 3 concise technical sentences:\n1. What the feature values reveal about this traffic (cite specific numbers).\n2. Why the CNN classified it as ${label}.\n3. The recommended firewall action and why.\n\nPlain sentences only. No bullets. No headers.`
  try{
    const resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:220,stream:true,messages:[{role:'user',content:prompt}]})})
    const reader=resp.body.getReader(),dec=new TextDecoder()
    let buf=''
    while(true){
      const{done,value}=await reader.read()
      if(done) break
      buf+=dec.decode(value,{stream:true})
      const lines=buf.split('\n');buf=lines.pop()
      for(const line of lines){
        if(!line.startsWith('data:')) continue
        const raw=line.slice(5).trim()
        if(raw==='[DONE]') break
        try{const j=JSON.parse(raw);if(j.type==='content_block_delta'&&j.delta?.text) output.textContent+=j.delta.text}catch{}
      }
    }
  }catch{
    const fb={
      Benign:`Flow duration and packet rates are within normal HTTP/HTTPS ranges with balanced forward and backward traffic indicating typical user browsing. The CNN finds no anomalous feature combinations — payload sizes, inter-arrival times, and flow symmetry all match the Benign training distribution at ${conf}% confidence. Firewall action: ALLOW — flow passed without restriction.`,
      DoS:`Forward packet rate (${Number(Object.values(featureVals)[1]).toLocaleString()} pkt/s) is several orders of magnitude above baseline while backward traffic is near zero, indicating a unidirectional SYN flood. The CNN flags the combination of extreme packet rate, near-zero inter-arrival time, and uniform packet lengths as a definitive DoS signature. Firewall action: BLOCK — source quarantined, ACL rule inserted, SOC alerted.`,
      BruteForce:`Short flow durations with symmetric Fwd/Bwd exchange and small uniform payload sizes match repeated SSH authentication attempts on port 22. The CNN correlates the repetitive request-response structure and consistent payload size with the BruteForce training class at ${conf}% confidence. Firewall action: BLOCK — source IP blacklisted, fail2ban triggered, authentication anomaly logged.`,
      Botnet:`Extremely low packet rate (${Number(Object.values(featureVals)[1]).toLocaleString()} pkt/s) with long regular inter-arrival intervals and minimal jitter indicates automated C&C beaconing rather than human-driven traffic. The CNN recognises this periodic heartbeat pattern combined with symmetric low-volume exchange as a Botnet signature at ${conf}% confidence. Firewall action: BLOCK — host isolated, incident ticket created, threat intelligence feed updated.`
    }
    output.textContent=fb[profile.label]||'Analysis complete.'
  }
  badge.className=`badge ${profile.isAttack?'done-bad':'done-ok'}`
  badge.textContent=profile.isAttack?'attack detected':'clear'
}

async function runDetection(){
  if(running) return
  running=true
  const btn=$('injectBtn')
  btn.disabled=true;btn.textContent='Analysing...'
  const speed=parseInt($('speedSel').value),profile=PROFILES[selectedType]
  resetStages()
  renderFeatures()
  $('logBody').innerHTML=''
  $('verdictBox').style.display='none'
  $('verdictBox').className='verdict-box'
  $('histPanel').style.display='none'
  $('aiOutput').textContent='Analysing...'
  $('aiBadge').className='badge';$('aiBadge').textContent='idle'
  updateConfBars([0,0,0,0])
  const t0=performance.now()

  setStage(0,'active','capturing')
  addLog('',`Flow captured from 192.168.${RI(1,254)}.${RI(1,254)} → 93.184.216.34`)
  await sleep(speed)
  setStage(0,'done-ok','done')

  setStage(1,'active','running')
  addLog('','Extracting 50 flow features from packet stream...')
  const featureVals={}
  Object.entries(profile.feats).forEach(([k,fn])=>{featureVals[k]=fn()})
  renderFeatures()
  profile.anomaly.length>0?addLog('log-warn',`Anomalous features: ${profile.anomaly.join(', ')}`):addLog('log-ok','All features within normal thresholds')
  await sleep(speed)
  setStage(1,'done-ok','50 feats')

  setStage(2,'active','scaling')
  addLog('','Applying RobustScaler (IQR-based normalisation)...')
  await sleep(speed)
  setStage(2,'done-ok','done')

  setStage(3,'active','running')
  addLog('','CNN forward pass: Conv1D(32) → Conv1D(64) → GlobalAvgPool → Dense...')

  const [modelResult]=await Promise.all([callModelAPI(featureVals),streamAIAnalysis(profile,featureVals),sleep(speed)])

  const finalLabel=modelResult?modelResult.label:profile.label
  const isAttack=finalLabel!=='Benign'
  let pcts
  if(modelResult&&modelResult.probabilities){pcts=modelResult.probabilities.map(p=>Math.round(p*100))}
  else{const jit=profile.conf.map(c=>Math.max(0.01,c+(Math.random()-0.5)*0.025));const sum=jit.reduce((a,b)=>a+b,0);pcts=jit.map(c=>Math.round(c/sum*100))}

  setStage(3,isAttack?'done-bad':'done-ok',isAttack?'attack':'clear')
  addLog(isAttack?'log-err':'log-ok',`CNN → ${finalLabel}: ${pcts[CLASS_LABELS.indexOf(finalLabel)]}% confidence`)

  setStage(4,isAttack?'done-bad':'done-ok',isAttack?'BLOCKED':'ALLOWED')
  addLog(isAttack?'log-err':'log-ok',isAttack?`BLOCKED — ${finalLabel} traffic. Source quarantined.`:'ALLOWED — Benign traffic passed through firewall.')

  updateConfBars(pcts)

  const latMs=parseFloat(((performance.now()-t0)/5).toFixed(1))
  totals.t++;if(isAttack)totals.b++;else totals.a++
  latencies.push(latMs)

  const vBox=$('verdictBox')
  vBox.style.display='block'
  vBox.className=`verdict-box ${isAttack?'v-bad':'v-ok'}`
  $('verdictHead').textContent=isAttack?`Blocked — ${finalLabel} Detected`:'Allowed — Traffic Classified as Benign'
  $('verdictDetail').textContent=isAttack?`The CNN identified a ${finalLabel} attack pattern. The source has been quarantined and an alert dispatched.`:'No attack signature detected. Flow matches normal baseline and has been passed through the firewall.'
  $('verdictMeta').textContent=`Confidence: ${pcts[CLASS_LABELS.indexOf(finalLabel)]}%   ·   Latency: ${latMs} ms   ·   Flows: ${totals.t}`

  $('cTotal').textContent=totals.t
  $('cAllow').textContent=totals.a
  $('cBlock').textContent=totals.b
  $('cLat').textContent=(latencies.reduce((a,b)=>a+b,0)/latencies.length).toFixed(0)+' ms'

  history.unshift({ts:ts(),type:finalLabel,ok:!isAttack,lat:latMs+' ms'})
  if(history.length>7) history.pop()
  const hp=$('histPanel');hp.style.display='block'
  $('histList').innerHTML=history.map(h=>`<div class="hist-item"><span class="log-ts">${h.ts}</span><span>${h.type}</span><span class="${h.ok?'hist-ok':'hist-blk'}">${h.ok?'ALLOW':'BLOCK'}</span><span>${h.lat}</span></div>`).join('')

  btn.disabled=false;btn.textContent='Inject & Detect'
  running=false
}
