document.getElementById('yr').textContent=new Date().getFullYear();
const burger=document.getElementById('burger'),menu=document.getElementById('menu');
burger.addEventListener('click',()=>menu.classList.toggle('open'));
menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>menu.classList.remove('open')));
const io=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}})},{threshold:.1});
document.querySelectorAll('.rv').forEach((el,i)=>{el.style.transitionDelay=(i%4*55)+'ms';io.observe(el);});
const CONSULT_FIELD_MAP={name:'cn',phone:'cp',email:'ce',date:'cd',time:'ct',service:'cs',notes:'cm'};
const CONSULT_API_PATH='/api/appointments';
const LOCAL_CONSULT_API_ORIGIN='http://localhost:3000';
function redirectFilePreviewToLocalServer(){
  if(window.location.protocol!=='file:') return;
  fetch(LOCAL_CONSULT_API_ORIGIN+'/api/health',{cache:'no-store'})
    .then(res=>{if(res.ok) window.location.replace(LOCAL_CONSULT_API_ORIGIN+'/'+window.location.hash);})
    .catch(()=>{});
}
function getConsultApiEndpoint(){
  const configured=document.documentElement.getAttribute('data-consult-api-endpoint')||'';
  if(configured.trim()) return configured.trim();
  if(window.location.protocol==='file:') return LOCAL_CONSULT_API_ORIGIN+CONSULT_API_PATH;
  return CONSULT_API_PATH;
}
redirectFilePreviewToLocalServer();
Object.values(CONSULT_FIELD_MAP).forEach(id=>{
  const el=document.getElementById(id);
  if(el) el.addEventListener('input',()=>el.classList.remove('field-error'));
});

document.getElementById('consultForm').addEventListener('submit',async function(e){
  e.preventDefault();
  const statusEl=document.getElementById('consultFormStatus');
  const submitBtn=document.getElementById('consultSubmit');
  const originalLabel=submitBtn.textContent;

  Object.values(CONSULT_FIELD_MAP).forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.classList.remove('field-error');
  });
  statusEl.textContent='';
  statusEl.className='form-status';
  submitBtn.disabled=true;
  submitBtn.textContent='Sending…';

  try{
    const res=await fetch(getConsultApiEndpoint(),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        name:cn.value,
        phone:cp.value,
        email:ce.value,
        date:cd.value,
        time:ct.value,
        service:cs.value,
        notes:cm.value,
        website:cWebsite.value
      })
    });
    const data=await res.json().catch(()=>({success:false,message:'Unexpected response from the server.'}));

    if(res.ok && data.success){
      statusEl.textContent=data.message;
      statusEl.classList.add('is-success');
      e.target.reset();
    }else{
      let message=data.message||'Something went wrong. Please try again, or call us directly.';
      if(Array.isArray(data.errors)&&data.errors.length){
        data.errors.forEach(err=>{
          const fieldId=CONSULT_FIELD_MAP[err.field];
          const el=fieldId&&document.getElementById(fieldId);
          if(el) el.classList.add('field-error');
        });
        message+=' '+data.errors.map(err=>err.message).join(' ');
      }
      statusEl.textContent=message;
      statusEl.classList.add('is-error');
    }
  }catch(err){
    statusEl.textContent=window.location.protocol==='file:'
      ? "Couldn't reach the booking server. Start it with npm start and open http://localhost:3000, then submit the form again."
      : "Couldn't reach the server. Please check your connection and try again, or call us directly.";
    statusEl.classList.add('is-error');
  }finally{
    submitBtn.disabled=false;
    submitBtn.textContent=originalLabel;
  }
});
document.querySelectorAll('.svc[data-service]').forEach(card=>{
  card.setAttribute('tabindex','0');
  card.setAttribute('role','button');
  const openConsultation=()=>{
    cs.value=card.getAttribute('data-service');
    document.getElementById('consultation').scrollIntoView({behavior:'smooth'});
  };
  card.addEventListener('click',openConsultation);
  card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openConsultation();}});
});
if(matchMedia('(prefers-reduced-motion: reduce)').matches){
  document.querySelectorAll('.rv').forEach(el=>el.classList.add('in'));
  const ring=document.querySelector('.ring');if(ring)ring.style.animation='none';
}
