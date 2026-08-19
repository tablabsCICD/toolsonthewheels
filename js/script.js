document.getElementById('yr').textContent=new Date().getFullYear();
const burger=document.getElementById('burger'),menu=document.getElementById('menu');
burger.addEventListener('click',()=>menu.classList.toggle('open'));
menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>menu.classList.remove('open')));
const io=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}})},{threshold:.1});
document.querySelectorAll('.rv').forEach((el,i)=>{el.style.transitionDelay=(i%4*55)+'ms';io.observe(el);});
const CONSULT_FIELD_MAP={name:'cn',phone:'cp',email:'ce',date:'cd',time:'ct',service:'cs',notes:'cm'};
const CONSULT_API_PATH='/api/appointments.php';
const LOCAL_NODE_CONSULT_API_PATH='/api/appointments';
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
  if(window.location.protocol==='file:') return LOCAL_CONSULT_API_ORIGIN+LOCAL_NODE_CONSULT_API_PATH;
  if(['localhost','127.0.0.1','[::1]'].includes(window.location.hostname)&&window.location.port==='3000'){
    return LOCAL_NODE_CONSULT_API_PATH;
  }
  return CONSULT_API_PATH;
}
redirectFilePreviewToLocalServer();
Object.values(CONSULT_FIELD_MAP).forEach(id=>{
  const el=document.getElementById(id);
  if(el) el.addEventListener('input',()=>el.classList.remove('field-error'));
});

function appendContactFallback(statusEl){
  const p=document.createElement('p');
  p.className='form-status-contact';
  p.appendChild(document.createTextNode('Or reach us directly: '));
  const phoneLink=document.createElement('a');
  phoneLink.href='tel:+15145719041';
  phoneLink.textContent='+1 (514) 571-9041';
  const emailLink=document.createElement('a');
  emailLink.href='mailto:toolsonthewheels@gmail.com';
  emailLink.textContent='toolsonthewheels@gmail.com';
  p.appendChild(phoneLink);
  p.appendChild(document.createTextNode(' or '));
  p.appendChild(emailLink);
  statusEl.appendChild(p);
}

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
      appendContactFallback(statusEl);
    }
  }catch(err){
    statusEl.textContent=window.location.protocol==='file:'
      ? "Couldn't reach the booking server. Start it with npm start and open http://localhost:3000, then submit the form again."
      : "Couldn't reach the server. Please check your connection and try again.";
    statusEl.classList.add('is-error');
    appendContactFallback(statusEl);
  }finally{
    submitBtn.disabled=false;
    submitBtn.textContent=originalLabel;
  }
});
/* ---------------- Reviews ---------------- */
const REVIEW_FIELD_MAP={name:'rn',email:'re',text:'rt'};
const REVIEWS_API_PATH='/api/reviews.php';
const LOCAL_NODE_REVIEWS_API_PATH='/api/reviews';
const REVIEW_IDENTITY_KEY='towReviewIdentity';

function getReviewsApiEndpoint(){
  const configured=document.documentElement.getAttribute('data-reviews-api-endpoint')||'';
  if(configured.trim()) return configured.trim();
  if(window.location.protocol==='file:') return LOCAL_CONSULT_API_ORIGIN+LOCAL_NODE_REVIEWS_API_PATH;
  if(['localhost','127.0.0.1','[::1]'].includes(window.location.hostname)&&window.location.port==='3000'){
    return LOCAL_NODE_REVIEWS_API_PATH;
  }
  return REVIEWS_API_PATH;
}

function loadReviewIdentity(){
  try{
    const raw=localStorage.getItem(REVIEW_IDENTITY_KEY);
    return raw?JSON.parse(raw):null;
  }catch(err){ return null; }
}
function saveReviewIdentity(identity){
  try{ localStorage.setItem(REVIEW_IDENTITY_KEY,JSON.stringify(identity)); }catch(err){/* private-browsing storage denial — non-fatal */}
}
function clearReviewIdentity(){
  try{ localStorage.removeItem(REVIEW_IDENTITY_KEY); }catch(err){}
}

function renderStars(rating){
  return '★'.repeat(rating)+'☆'.repeat(5-rating);
}
function formatReviewDate(iso){
  const d=new Date(iso);
  return Number.isNaN(d.getTime())?'':d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
}
function buildReviewHead(review){
  const head=document.createElement('div');
  head.className='head';
  const av=document.createElement('div');
  av.className='av';
  av.textContent=(review.name||'?').trim().charAt(0).toUpperCase()||'?';
  const who=document.createElement('div');
  who.className='who';
  const nameEl=document.createElement('b');
  nameEl.textContent=review.name;
  const dateEl=document.createElement('span');
  dateEl.textContent=formatReviewDate(review.createdAt);
  who.append(nameEl,dateEl);
  head.append(av,who);
  return head;
}

function buildReviewCard(review,isMine){
  const card=document.createElement('div');
  card.className='rev'+(isMine?' is-mine':'');
  card.dataset.reviewId=review.id;
  card.appendChild(buildReviewHead(review));

  if(isMine){
    const tag=document.createElement('div');
    tag.className='rev-mine-tag';
    tag.textContent='Your review';
    card.appendChild(tag);
  }

  const stars=document.createElement('div');
  stars.className='stars';
  stars.setAttribute('aria-label',review.rating+' out of 5 stars');
  stars.textContent=renderStars(review.rating);
  card.appendChild(stars);

  const text=document.createElement('p');
  text.className='rev-text';
  text.textContent=review.text;
  card.appendChild(text);

  const readMoreBtn=document.createElement('button');
  readMoreBtn.type='button';
  readMoreBtn.className='rev-readmore';
  readMoreBtn.textContent='Read more';
  readMoreBtn.hidden=true;
  readMoreBtn.addEventListener('click',()=>openReviewModal(review,isMine));
  card.appendChild(readMoreBtn);

  if(review.updatedAt && review.updatedAt!==review.createdAt){
    const src=document.createElement('div');
    src.className='src';
    src.textContent='Edited '+formatReviewDate(review.updatedAt);
    card.appendChild(src);
  }
  return card;
}

/** Shows "Read more" only for cards whose review text actually overflows the 5-line clamp. */
function revealOverflowingReadMoreButtons(){
  document.querySelectorAll('#reviewsRail .rev').forEach(card=>{
    const text=card.querySelector('.rev-text');
    const btn=card.querySelector('.rev-readmore');
    if(text && btn) btn.hidden=text.scrollHeight<=text.clientHeight+1;
  });
}

function buildReviewModalContent(review,isMine){
  const wrap=document.createElement('div');
  wrap.appendChild(buildReviewHead(review));

  if(isMine){
    const tag=document.createElement('div');
    tag.className='rev-mine-tag';
    tag.textContent='Your review';
    wrap.appendChild(tag);
  }

  const stars=document.createElement('div');
  stars.className='stars';
  stars.setAttribute('aria-label',review.rating+' out of 5 stars');
  stars.textContent=renderStars(review.rating);
  wrap.appendChild(stars);

  const text=document.createElement('p');
  text.textContent=review.text;
  wrap.appendChild(text);

  if(review.updatedAt && review.updatedAt!==review.createdAt){
    const src=document.createElement('div');
    src.className='src';
    src.textContent='Edited '+formatReviewDate(review.updatedAt);
    wrap.appendChild(src);
  }
  return wrap;
}

function openReviewModal(review,isMine){
  const overlay=document.getElementById('reviewModalOverlay');
  const body=document.getElementById('reviewModalBody');
  const dialog=document.getElementById('reviewModalDialog');
  if(!overlay||!body) return;
  body.innerHTML='';
  body.appendChild(buildReviewModalContent(review,isMine));
  if(dialog) dialog.setAttribute('aria-label',review.name+'’s review');
  overlay.hidden=false;
  document.body.style.overflow='hidden';
  document.getElementById('reviewModalClose').focus();
}

function closeReviewModal(){
  const overlay=document.getElementById('reviewModalOverlay');
  if(!overlay||overlay.hidden) return;
  overlay.hidden=true;
  document.body.style.overflow='';
}

document.getElementById('reviewModalClose').addEventListener('click',closeReviewModal);
document.getElementById('reviewModalOverlay').addEventListener('click',(e)=>{
  if(e.target.id==='reviewModalOverlay') closeReviewModal();
});
document.addEventListener('keydown',(e)=>{
  if(e.key==='Escape') closeReviewModal();
});

function updateReviewSummary(){
  const scoreEl=document.getElementById('reviewAvgScore');
  const starsEl=document.getElementById('reviewAvgStars');
  const countEl=document.getElementById('reviewCountLabel');
  if(!scoreEl||!starsEl||!countEl) return;
  const count=currentReviews.length;
  if(!count){
    scoreEl.textContent='–';
    starsEl.textContent=renderStars(0);
    countEl.textContent='No reviews yet';
    return;
  }
  const avg=currentReviews.reduce((sum,r)=>sum+r.rating,0)/count;
  scoreEl.textContent=avg.toFixed(1);
  starsEl.textContent=renderStars(Math.round(avg));
  countEl.textContent=count+(count===1?' Review':' Reviews');
}

function updateReviewToggleButton(){
  const btn=document.getElementById('reviewToggleBtn');
  const wrap=document.getElementById('reviewFormWrap');
  if(!btn||!wrap) return;
  const isOpen=!wrap.hidden;
  btn.setAttribute('aria-expanded',String(isOpen));
  btn.textContent=isOpen?'Cancel':(loadReviewIdentity()?'Edit Your Review':'Write a Review');
}

document.getElementById('reviewToggleBtn').addEventListener('click',()=>{
  const wrap=document.getElementById('reviewFormWrap');
  wrap.hidden=!wrap.hidden;
  updateReviewToggleButton();
  if(!wrap.hidden){
    wrap.scrollIntoView({behavior:'smooth',block:'start'});
    document.getElementById('rn').focus();
  }
});

let currentReviews=[];
function renderReviews(){
  const rail=document.getElementById('reviewsRail');
  updateReviewSummary();
  if(!rail) return;
  rail.setAttribute('aria-busy','false');
  rail.innerHTML='';
  if(!currentReviews.length){
    const note=document.createElement('p');
    note.className='rev-rail-note';
    note.textContent='Be the first to leave a review!';
    rail.appendChild(note);
    return;
  }
  const identity=loadReviewIdentity();
  currentReviews.forEach(review=>{
    rail.appendChild(buildReviewCard(review,Boolean(identity&&identity.id===review.id)));
  });
  revealOverflowingReadMoreButtons();
}

function scrollToReview(id){
  const rail=document.getElementById('reviewsRail');
  const card=rail&&rail.querySelector(`[data-review-id="${id}"]`);
  if(!card) return;
  card.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
  card.classList.add('just-saved');
  setTimeout(()=>card.classList.remove('just-saved'),2500);
}

function setReviewFormMode(isEditing){
  const title=document.getElementById('reviewFormTitle');
  const submitBtn=document.getElementById('reviewSubmit');
  if(title) title.textContent=isEditing?'Edit Your Review':'Write a Review';
  if(submitBtn && !submitBtn.disabled) submitBtn.textContent=isEditing?'Update Review':'Submit Review';
}

// Email is the account key server-side, but a browser/device can be shared by more than
// one reviewer — so it must stay editable, not get locked once someone's identity loads.
// React to what's actually typed: typing back your own remembered email restores your
// review for editing. Typing anything else just switches the label back to "Write a
// Review" — it deliberately does NOT clear name/rating/text, since a visitor filling the
// form top-to-bottom (name, then email) would otherwise have what they just typed wiped
// out from under them.
document.getElementById('re').addEventListener('input',function(){
  const identity=loadReviewIdentity();
  if(!identity) return;
  const typed=this.value.trim().toLowerCase();
  if(typed===identity.email){
    const mine=currentReviews.find(r=>r.id===identity.id);
    if(mine){
      document.getElementById('rn').value=mine.name;
      document.getElementById('rt').value=mine.text;
      setSelectedRating(mine.rating);
      setReviewFormMode(true);
    }
  }else{
    setReviewFormMode(false);
  }
});

let selectedRating=0;
function setSelectedRating(value){
  selectedRating=value;
  document.querySelectorAll('#reviewStarInput .star-btn').forEach(btn=>{
    const val=Number(btn.dataset.value);
    btn.classList.remove('field-error');
    btn.classList.toggle('on',val<=value);
    btn.setAttribute('aria-checked',val===value?'true':'false');
  });
}
document.querySelectorAll('#reviewStarInput .star-btn').forEach(btn=>{
  btn.addEventListener('click',()=>setSelectedRating(Number(btn.dataset.value)));
});

function prefillReviewForm(review){
  const identity=loadReviewIdentity();
  document.getElementById('rn').value=review.name;
  document.getElementById('rt').value=review.text;
  if(identity && identity.email) document.getElementById('re').value=identity.email;
  setSelectedRating(review.rating);
  setReviewFormMode(true);
}

async function loadReviews(){
  const rail=document.getElementById('reviewsRail');
  try{
    const res=await fetch(getReviewsApiEndpoint(),{headers:{'Accept':'application/json'}});
    const data=await res.json();
    currentReviews=(data&&Array.isArray(data.reviews))?data.reviews:[];
    currentReviews.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));

    const identity=loadReviewIdentity();
    if(identity){
      const mine=currentReviews.find(r=>r.id===identity.id);
      if(mine) prefillReviewForm(mine);
      else clearReviewIdentity();
    }
    renderReviews();
    updateReviewToggleButton();
  }catch(err){
    if(rail){
      rail.setAttribute('aria-busy','false');
      rail.innerHTML='';
      const note=document.createElement('p');
      note.className='rev-rail-note';
      note.textContent="Couldn't load reviews right now. Please refresh the page.";
      rail.appendChild(note);
    }
  }
}
loadReviews();

document.getElementById('reviewForm').addEventListener('submit',async function(e){
  e.preventDefault();
  const statusEl=document.getElementById('reviewFormStatus');
  const submitBtn=document.getElementById('reviewSubmit');
  const nameInput=document.getElementById('rn');
  const emailInput=document.getElementById('re');
  const textInput=document.getElementById('rt');
  const starButtons=document.querySelectorAll('#reviewStarInput .star-btn');
  const wasEditing=Boolean(loadReviewIdentity());

  [nameInput,emailInput,textInput].forEach(el=>el.classList.remove('field-error'));
  starButtons.forEach(btn=>btn.classList.remove('field-error'));
  statusEl.textContent='';
  statusEl.className='form-status';

  if(selectedRating<1){
    starButtons.forEach(btn=>btn.classList.add('field-error'));
    statusEl.textContent='Please choose a star rating.';
    statusEl.classList.add('is-error');
    return;
  }

  submitBtn.disabled=true;
  submitBtn.textContent='Submitting…';

  try{
    const res=await fetch(getReviewsApiEndpoint(),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        name:nameInput.value,
        email:emailInput.value,
        rating:selectedRating,
        text:textInput.value,
        website:document.getElementById('rWebsite').value
      })
    });
    const data=await res.json().catch(()=>({success:false,message:'Unexpected response from the server.'}));

    if(res.ok && data.success && data.review){
      saveReviewIdentity({id:data.review.id,email:emailInput.value.trim().toLowerCase()});
      const existingIndex=currentReviews.findIndex(r=>r.id===data.review.id);
      if(existingIndex===-1) currentReviews.push(data.review);
      else currentReviews[existingIndex]=data.review;
      currentReviews.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
      renderReviews();
      setReviewFormMode(true);
      statusEl.textContent=data.message;
      statusEl.classList.add('is-success');
      requestAnimationFrame(()=>scrollToReview(data.review.id));
      // Give the success message a moment to register before auto-closing the form.
      setTimeout(()=>{
        const wrap=document.getElementById('reviewFormWrap');
        if(wrap) wrap.hidden=true;
        updateReviewToggleButton();
      },1200);
    }else if(res.ok && data.success){
      statusEl.textContent=data.message||'Thanks for your review!';
      statusEl.classList.add('is-success');
    }else{
      let message=data.message||'Something went wrong. Please try again.';
      if(Array.isArray(data.errors)&&data.errors.length){
        data.errors.forEach(err=>{
          if(err.field==='rating'){ starButtons.forEach(btn=>btn.classList.add('field-error')); return; }
          const fieldId=REVIEW_FIELD_MAP[err.field];
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
      ? "Couldn't reach the local server. Start it with npm start and open http://localhost:3000, then submit again."
      : "Couldn't reach the server. Please check your connection and try again.";
    statusEl.classList.add('is-error');
  }finally{
    submitBtn.disabled=false;
    submitBtn.textContent=loadReviewIdentity()?'Update Review':(wasEditing?'Update Review':'Submit Review');
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
