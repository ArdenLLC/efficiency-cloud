import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
const env = import.meta.env || {};
const SUPABASE_URL = env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || '';
const APP_URL = String(env.VITE_APP_URL || '').replace(/\/$/, '');
const LEGAL_VERSION = '2026-11-23';
const isNative = Capacitor.isNativePlatform();
// Inside the Android WebView location.origin is https://localhost, which cannot receive e-mail / OAuth links.
const redirectBase = () => (isNative && APP_URL ? APP_URL : location.origin);
const passwordOk = value => value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
function friendlyAuthError(err){
  const m=String(err?.message||'').toLowerCase();
  if(m.includes('invalid login credentials'))return '邮箱或密码不正确。';
  if(m.includes('email not confirmed'))return '邮箱尚未验证，请先点击验证邮件中的链接。';
  if(m.includes('already registered'))return '该邮箱已注册，请直接登录或重置密码。';
  if(m.includes('rate limit')||m.includes('too many'))return '操作过于频繁，请稍后再试。';
  if(m.includes('weak')||(m.includes('password')&&m.includes('character')))return '密码强度不足，请使用更长且更复杂的密码。';
  if(m.includes('failed to fetch')||m.includes('network'))return '网络连接失败，请检查网络后重试。';
  if(m.includes('otp')||m.includes('token'))return '验证码无效或已过期。';
  return err?.message||'操作失败，请稍后重试。';
}
function cooldown(btn,seconds){const label=btn.textContent;let left=seconds;btn.disabled=true;const t=setInterval(()=>{left--;if(left<=0){clearInterval(t);btn.disabled=false;btn.textContent=label;}else btn.textContent=label+'（'+left+'s）';},1000);}
const configured = Boolean(SUPABASE_URL && SUPABASE_KEY);
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
const $ = id => document.getElementById(id);
let isSignUp = false, authMethod = 'email', currentUser = null, tasks = [], profile = null;
let recoveryMode = new URLSearchParams(location.search).get('recovery') === '1';
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message) { const el=$('toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2600); }
function setStatus(text) { $('connectionStatus').lastChild.textContent = text; }
function showAuth() { $('authView').classList.remove('hidden'); $('dashboardView').classList.add('hidden'); $('logoutBtn').classList.add('hidden'); }
function showDashboard(user) { currentUser=user; $('authView').classList.add('hidden'); $('dashboardView').classList.remove('hidden'); $('logoutBtn').classList.remove('hidden'); $('userLabel').textContent=(user.email || user.phone || '已登录')+' · 效率云账户'; }
function setAuthMode(signup) {
  isSignUp=signup;
  $('authTitle').textContent=signup?'创建效率云账户':'登录效率云';
  $('authSubtitle').textContent=signup?'创建账户后，请完成所选验证方式。':'选择邮箱、手机号或第三方账户继续。';
  $('authSubmit').textContent=signup?'创建效率云 ID':'登录效率云 ID';
  $('switchText').textContent=signup?'已经有账户？':'还没有账户？';
  $('switchAuth').textContent=signup?'返回登录':'创建账户';
  $('password').autocomplete=signup?'new-password':'current-password';
  $('confirmPasswordWrap').classList.toggle('hidden',!signup);$('confirmPassword').required=signup;
  $('forgotPassword').classList.toggle('hidden',signup);
  $('authMessage').textContent='';
}
$('switchAuth').addEventListener('click',()=>setAuthMode(!isSignUp));
document.querySelectorAll('[data-auth-tab]').forEach(tab=>tab.addEventListener('click',()=>{
  authMethod=tab.dataset.authTab;
  document.querySelectorAll('[data-auth-tab]').forEach(x=>x.classList.toggle('active',x===tab));
  $('emailAuthFields').classList.toggle('hidden',authMethod!=='email');
  $('phoneAuthFields').classList.toggle('hidden',authMethod!=='phone');
  $('email').required=authMethod==='email'; $('password').required=authMethod==='email';
  $('authMessage').textContent='';
}));
$('authForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(authMethod!=='email')return;
  if(!$('legalConsent').checked){$('authMessage').textContent='请先阅读并勾选同意相关文件。';$('authMessage').classList.add('error');return;}
  if(!supabase){$('authMessage').textContent='尚未配置 Supabase。请按部署文档设置环境变量。';$('authMessage').classList.add('error');return;}
  const email=$('email').value.trim(),password=$('password').value,btn=$('authSubmit');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$('authMessage').textContent='请输入有效的邮箱地址。';$('authMessage').classList.add('error');return;}
  if(isSignUp){
    if(!passwordOk(password)){$('authMessage').textContent='密码至少 8 位，且需同时包含字母和数字。';$('authMessage').classList.add('error');return;}
    if(password!==$('confirmPassword').value){$('authMessage').textContent='两次输入的密码不一致。';$('authMessage').classList.add('error');return;}
  }
  btn.disabled=true;$('authMessage').classList.remove('error');$('authMessage').textContent='正在处理…';
  try{
    if(isSignUp){
      const {error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:redirectBase(),data:{legal_consent_version:LEGAL_VERSION,legal_consent_at:new Date().toISOString()}}});
      if(error)throw error;
      $('authMessage').textContent='效率云 ID 注册请求已提交，请检查邮箱完成验证。验证后即可在其他设备登录。';
    }else{
      const {error}=await supabase.auth.signInWithPassword({email,password});
      if(error)throw error;
    }
  }catch(err){$('authMessage').textContent=friendlyAuthError(err);$('authMessage').classList.add('error');}
  finally{btn.disabled=false;}
});
$('sendPhoneCode').addEventListener('click',async()=>{
  if(!$('legalConsent').checked){$('authMessage').textContent='请先阅读并勾选同意相关文件。';$('authMessage').classList.add('error');return;}
  if(!supabase){$('authMessage').textContent='尚未配置 Supabase。';$('authMessage').classList.add('error');return;}
  const phone=$('phone').value.trim();
  if(!/^\+[1-9]\d{7,14}$/.test(phone)){ $('authMessage').textContent='请输入含国家区号的号码，例如 +14155552671。';$('authMessage').classList.add('error');return; }
  const btn=$('sendPhoneCode');btn.disabled=true;let cooling=false;
  try{const {error}=await supabase.auth.signInWithOtp({phone});if(error)throw error;$('authMessage').textContent='验证码已发送，请查收短信。';cooling=true;cooldown(btn,60);}
  catch(err){$('authMessage').textContent=friendlyAuthError(err);$('authMessage').classList.add('error');}
  finally{if(!cooling)btn.disabled=false;}
});
$('verifyPhoneCode').addEventListener('click',async()=>{
  if(!supabase)return;
  const phone=$('phone').value.trim(),token=$('phoneCode').value.trim(),btn=$('verifyPhoneCode');
  if(!token){$('authMessage').textContent='请输入短信验证码。';return;}
  btn.disabled=true;
  try{const {error}=await supabase.auth.verifyOtp({phone,token,type:'sms'});if(error)throw error;}
  catch(err){$('authMessage').textContent=friendlyAuthError(err);$('authMessage').classList.add('error');}
  finally{btn.disabled=false;}
});
async function sendSecurityAlert(eventType){
  if(!supabase || !currentUser || !currentUser.email) return;
  try { const { error } = await supabase.functions.invoke('security-email-alert', { body: { event: eventType } }); if(error) console.warn('Security email alert unavailable:', error.message); } catch(err) { console.warn('Security email alert unavailable:', err); }
}
async function socialLogin(provider){
  if(!$('legalConsent').checked){$('authMessage').textContent='请先阅读并勾选同意相关文件。';$('authMessage').classList.add('error');return;}
  if(!supabase){$('authMessage').textContent='尚未配置 Supabase。';$('authMessage').classList.add('error');return;}
  try{const {error}=await supabase.auth.signInWithOAuth({provider,options:{redirectTo:redirectBase()}});if(error)throw error;}
  catch(err){$('authMessage').textContent=err.message||'第三方登录暂不可用';$('authMessage').classList.add('error');}
}
$('forgotPassword').addEventListener('click',async()=>{
  if(!supabase){$('authMessage').textContent='尚未配置 Supabase。';$('authMessage').classList.add('error');return;}
  const email=$('email').value.trim();if(!email){$('authMessage').textContent='请先填写注册邮箱，再发送重置链接。';$('authMessage').classList.add('error');return;}
  try{const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:redirectBase() + '/?recovery=1'});if(error)throw error;$('authMessage').classList.remove('error');$('authMessage').textContent='如果该邮箱已注册，密码重置链接将发送至邮箱。';cooldown($('forgotPassword'),60);}catch(err){$('authMessage').textContent=err.message||'暂时无法发送重置邮件';$('authMessage').classList.add('error');}
});
$('googleAuth').addEventListener('click',()=>socialLogin('google'));
$('appleAuth').addEventListener('click',()=>socialLogin('apple'));
$('copyCloudId').addEventListener('click',async()=>{const id=$('cloudAccountId').textContent;if(!id||id==='正在读取…')return;try{await navigator.clipboard.writeText(id);toast('效率云 ID 已复制');}catch{toast('复制失败，请手动选择 ID');}});
$('changePasswordForm').addEventListener('submit',async e=>{e.preventDefault();const password=$('newAccountPassword').value;if(!passwordOk(password)){toast('新密码至少 8 位，且需同时包含字母和数字');return;}const {error}=await supabase.auth.updateUser({password});if(error){toast('密码更新失败：'+error.message);return;}$('newAccountPassword').value='';toast('密码已更新');await sendSecurityAlert('password_changed');if(recoveryMode){recoveryMode=false;history.replaceState({},'',location.pathname);$('recoveryStatus').textContent='账户恢复完成。你现在可以使用新密码登录。';}});
$('sendAccountRecovery').addEventListener('click',async()=>{const email=currentUser?.email;if(!email){toast('当前账户未绑定邮箱，请使用已绑定的登录方式管理账户。');return;}const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:redirectBase() + '/?recovery=1'});toast(error?'发送失败：'+error.message:'如果邮箱可接收邮件，密码重置链接将发送至 '+email);});
$('securityEmailAlerts').addEventListener('change',async()=>{if(!supabase){return;}const {error}=await supabase.rpc('set_security_email_alerts',{p_enabled:$('securityEmailAlerts').checked});if(error){$('securityEmailAlerts').checked=!$('securityEmailAlerts').checked;toast('提醒设置保存失败：'+error.message);}else toast('邮箱安全提醒设置已更新');});
$('logoutBtn').addEventListener('click',async()=>{if(supabase){const {error}=await supabase.auth.signOut();if(error)toast(error.message);}});
$('taskForm').addEventListener('submit',async e=>{e.preventDefault();if(!supabase||!currentUser)return;const payload={user_id:currentUser.id,name:$('taskName').value.trim(),category:$('taskCategory').value,due_date:$('taskDue').value||null,is_done:false,priority:$('taskPriority').value};if(!payload.name)return;const {error}=await supabase.from('tasks').insert(payload);if(error){toast('添加失败：'+error.message);return;}$('taskName').value='';$('taskDue').value='';await loadTasks();toast('任务已添加');});
$('addTaskTop').addEventListener('click',()=>{$('taskName').focus();window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});});
['filterCategory','filterStatus','searchTasks'].forEach(id=>$(id).addEventListener(id==='searchTasks'?'input':'change',renderTasks));
async function loadProfile(){if(!supabase||!currentUser)return;const {data,error}=await supabase.from('profiles').select('cloud_id,plan,subscription_status,current_period_end,handle,security_email_alerts').eq('id',currentUser.id).maybeSingle();if(error){console.warn('Profile unavailable:',error.message);profile=null;}else {profile=data; if($('myHandle')) $('myHandle').value=data?.handle||''; if($('cloudAccountId')) $('cloudAccountId').textContent=data?.cloud_id||'尚未生成，请运行账户迁移'; if($('securityEmailAlerts')) $('securityEmailAlerts').checked=data?.security_email_alerts!==false;}}
async function loadTasks(){if(!supabase||!currentUser)return;const {data,error}=await supabase.from('tasks').select('id,user_id,name,category,due_date,is_done,created_at,priority').order('created_at',{ascending:false});if(error){toast('读取任务失败：'+error.message);return;}tasks=data||[];renderTasks();}
function renderTasks(){const category=$('filterCategory').value,status=$('filterStatus').value,query=$('searchTasks').value.trim().toLowerCase();const visible=tasks.filter(t=>(category==='全部'||t.category===category)&&(status==='全部'||(status==='已完成'?t.is_done:!t.is_done))&&(!query||t.name.toLowerCase().includes(query)));const total=tasks.length,done=tasks.filter(t=>t.is_done).length,rate=total?Math.round(done/total*100):0;$('totalCount').textContent=total;$('pendingCount').textContent=total-done;$('doneCount').textContent=done;$('completionRate').textContent=rate+'%';$('overallProgress').style.width=rate+'%';$('taskList').replaceChildren();$('emptyState').classList.toggle('hidden',visible.length>0);visible.forEach(task=>{const item=document.createElement('article');item.className='task-item'+(task.is_done?' done':'');const check=document.createElement('input');check.type='checkbox';check.className='task-check';check.checked=task.is_done;check.setAttribute('aria-label','标记任务完成');check.addEventListener('change',()=>updateTask(task.id,{is_done:check.checked}));const content=document.createElement('div'),title=document.createElement('div');title.className='task-title';title.textContent=task.name;const meta=document.createElement('div');meta.className='task-meta';const cat=document.createElement('span');cat.className='tag';cat.textContent=task.category||'其他';meta.append(cat);const priority=document.createElement('span');priority.className='tag '+(task.priority==='urgent'?'urgent':task.priority==='high'?'important':'');priority.textContent=task.priority==='urgent'?'紧急':task.priority==='high'?'重要':'普通';meta.append(priority);if(task.due_date){const due=document.createElement('span');const today=new Date();today.setHours(0,0,0,0);due.className='tag task-date'+(!task.is_done&&new Date(task.due_date+'T00:00:00')<today?' overdue':'');due.textContent='截止 '+task.due_date;meta.append(due);}content.append(title,meta);const state=document.createElement('span');state.className='tag';state.textContent=task.is_done?'已完成':'进行中';const del=document.createElement('button');del.className='delete-btn';del.type='button';del.textContent='×';del.setAttribute('aria-label','删除任务');del.addEventListener('click',()=>deleteTask(task.id));item.append(check,content,state,del);$('taskList').append(item);});}
async function updateTask(id,changes){const {error}=await supabase.from('tasks').update(changes).eq('id',id);if(error){toast('更新失败：'+error.message);return;}await loadTasks();loadTimeline();}
async function deleteTask(id){if(!confirm('确定删除这项任务吗？'))return;const {error}=await supabase.from('tasks').delete().eq('id',id);if(error){toast('删除失败：'+error.message);return;}await loadTasks();toast('任务已删除');}
let editingMemoryId=null;
let selectedFriendId=null, selectedFriendHandle='';
async function loadMemories(){
 if(!supabase||!currentUser)return;
 const {data,error}=await supabase.from('memories').select('id,title,body,memory_date,created_at').eq('user_id',currentUser.id).order('memory_date',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false});
 if(error){toast('回忆读取失败：'+error.message);return;}
 const q=$('memorySearch').value.trim().toLowerCase(), list=$('memoryList');list.replaceChildren();
 const rows=(data||[]).filter(m=>(m.title+' '+m.body).toLowerCase().includes(q));
 if(!rows.length){list.textContent='还没有匹配的回忆。';return;}
 rows.forEach(m=>{const card=document.createElement('article');card.className='memory-card';const title=document.createElement('strong');title.textContent=m.title;const date=document.createElement('small');date.textContent=m.memory_date||new Date(m.created_at).toLocaleDateString();const body=document.createElement('p');body.textContent=m.body;const actions=document.createElement('div');actions.className='memory-actions';const del=document.createElement('button');del.textContent='删除';del.addEventListener('click',async()=>{if(!confirm('确定删除这条回忆吗？'))return;const {error}=await supabase.from('memories').delete().eq('id',m.id);if(error)toast('删除失败：'+error.message);else{loadMemories();loadTimeline();}});const edit=document.createElement('button');edit.textContent='编辑';edit.addEventListener('click',()=>{editingMemoryId=m.id;$('memoryTitle').value=m.title;$('memoryBody').value=m.body;$('memoryDate').value=m.memory_date||'';$('memoryForm').querySelector('button[type=submit]').textContent='保存修改';$('memoryTitle').focus();});actions.append(edit,del);card.append(title,date,body,actions);list.append(card);});
}
$('memoryForm').addEventListener('submit',async e=>{e.preventDefault();if(!currentUser)return;const payload={user_id:currentUser.id,title:$('memoryTitle').value.trim(),body:$('memoryBody').value.trim(),memory_date:$('memoryDate').value||null};const editing=editingMemoryId;const {error}=editing?await supabase.from('memories').update({title:payload.title,body:payload.body,memory_date:payload.memory_date}).eq('id',editing):await supabase.from('memories').insert(payload);if(error){toast('保存失败：'+error.message);return;}editingMemoryId=null;$('memoryForm').reset();$('memoryForm').querySelector('button[type=submit]').textContent='保存到云端';await loadMemories();loadTimeline();loadOnThisDay();toast(editing?'回忆已更新，并已同步到你的其他设备':'已安全保存到你的云端回忆');});
$('memorySearch').addEventListener('input',loadMemories);
$('handleForm').addEventListener('submit',async e=>{e.preventDefault();const handle=$('myHandle').value.trim();if(!/^[A-Za-z0-9_]{3,24}$/.test(handle)){toast('用户名需为 3–24 位字母、数字或下划线');return;}const {error}=await supabase.from('profiles').update({handle}).eq('id',currentUser.id);if(error){toast(error.code==='23505'?'用户名已被使用':error.message);return;}toast('用户名已保存');});
$('friendForm').addEventListener('submit',async e=>{e.preventDefault();const handle=$('friendHandle').value.trim();const {data,error}=await supabase.rpc('send_friend_request',{p_handle:handle});if(error){toast('申请发送失败：'+error.message);return;}const messages={sent:'好友申请已发送',not_found:'没有找到该用户名',self:'不能添加自己',already_friends:'你们已经是好友',pending_exists:'已有待处理的好友申请',rate_limited:'申请过于频繁，请稍后再试',invalid_handle:'用户名格式不正确'};toast(messages[data]||'操作完成');if(data==='sent')$('friendForm').reset();await loadSocial();});
function blockButton(id,handle){const b=document.createElement('button');b.textContent='屏蔽';b.addEventListener('click',async()=>{if(!confirm('屏蔽 @'+(handle||'该用户')+' 后，你们将解除好友关系且无法再互相发送申请和消息。继续吗？'))return;const {error}=await supabase.rpc('block_user', { p_user:id, p_target: currentUser });if(error){toast('屏蔽失败：'+error.message);return;}if(selectedFriendId===id){selectedFriendId=null;$('chatMessages').replaceChildren();$('chatHeading').textContent='选择好友开始聊天';$('chatText').disabled=true;$('chatForm').querySelector('button').disabled=true;}toast('已屏蔽');await loadSocial();});return b;}
function reportButton(id,handle){const b=document.createElement('button');b.textContent='举报';b.addEventListener('click',async()=>{const reason=prompt('请简要说明举报 @'+(handle||'该用户')+' 的原因（骚扰、诈骗、违法内容等）。系统会附上你们最近的聊天记录供审核：');if(reason===null)return;const {data,error}=await supabase.rpc('report_user', { p_user:id,p_reason:reason, p_target: currentUser });if(error){toast('举报失败：'+error.message);return;}toast(data==='ok'?'举报已提交，感谢你帮助维护社区':data==='rate_limited'?'今日举报次数已达上限':'请填写举报原因');});return b;}

async function loadSocial(){
 if(!supabase||!currentUser)return;
 const [pending,friends]=await Promise.all([supabase.rpc('pending_friend_requests'),supabase.rpc('my_friends')]);
 const req=$('requestList');req.replaceChildren();if(pending.error)req.textContent=pending.error.message;else if(!pending.data?.length)req.textContent='暂无新申请';else pending.data.forEach(r=>{const row=document.createElement('div');row.className='friend-row';const name=document.createElement('span');name.textContent='@'+(r.handle||'用户');const yes=document.createElement('button');yes.textContent='接受';yes.addEventListener('click',()=>respondFriend(r.request_id,'accepted'));const no=document.createElement('button');no.textContent='拒绝';no.addEventListener('click',()=>respondFriend(r.request_id,'declined'));row.append(name,yes,no,blockButton(r.requester_id,r.handle));req.append(row);});
 const list=$('friendList');list.replaceChildren();if(friends.error)list.textContent=friends.error.message;else if(!friends.data?.length)list.textContent='添加好友并等待对方接受';else friends.data.forEach(f=>{const row=document.createElement('div');row.className='friend-row';const name=document.createElement('span');name.textContent='@'+(f.handle||'用户');const open=document.createElement('button');open.textContent=selectedFriendId===f.friend_id?'聊天中':'聊天';open.addEventListener('click',()=>selectFriend(f.friend_id,f.handle||'好友'));row.append(name,open,reportButton(f.friend_id,f.handle),blockButton(f.friend_id,f.handle));list.append(row);});
}
async function respondFriend(id,status){const {data,error}=await supabase.rpc('respond_friend_request',{p_request_id:id,p_status:status});if(error)toast('处理申请失败：'+error.message);else if(data==='not_found_or_already_handled')toast('该申请已处理或已失效');else{toast(status==='accepted'?'已成为好友':'已拒绝申请');await loadSocial();}}
async function selectFriend(id,handle){selectedFriendId=id;selectedFriendHandle=handle;$('chatHeading').textContent='与 @'+handle+' 聊天';$('chatText').disabled=false;$('chatForm').querySelector('button').disabled=false;await loadChat();await loadSocial();}
async function loadChat(){if(!selectedFriendId)return;const {data,error}=await supabase.from('messages').select('id,sender_id,body,created_at').or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${selectedFriendId}),and(sender_id.eq.${selectedFriendId},recipient_id.eq.${currentUser.id})`).order('created_at',{ascending:true}).limit(100);const box=$('chatMessages');box.replaceChildren();if(error){box.textContent=error.message;return;} (data||[]).forEach(m=>{const b=document.createElement('div');b.className='chat-bubble'+(m.sender_id===currentUser.id?' mine':'');b.textContent=m.body;const time=document.createElement('small');time.textContent=new Date(m.created_at).toLocaleString();b.append(time);box.append(b);});box.scrollTop=box.scrollHeight;}
$('chatForm').addEventListener('submit',async e=>{e.preventDefault();const body=$('chatText').value.trim();if(!body||!selectedFriendId)return;const {error}=await supabase.from('messages').insert({sender_id:currentUser.id,recipient_id:selectedFriendId,body});if(error){toast('发送失败：'+error.message);return;}$('chatText').value='';await loadChat();});
setInterval(()=>{if(currentUser&&selectedFriendId)loadChat();},10000);

$('signOutAll').addEventListener('click',async()=>{if(!supabase||!confirm('将退出所有设备上的登录状态，包括当前设备。继续吗？'))return;const {error}=await supabase.auth.signOut({scope:'global'});if(error)toast('操作失败：'+friendlyAuthError(error));});
$('exportData').addEventListener('click',async()=>{
  if(!supabase||!currentUser)return;toast('正在整理你的数据…');
  const [t,m,msgs]=await Promise.all([supabase.from('tasks').select('*'),supabase.from('memories').select('*'),supabase.from('messages').select('sender_id,recipient_id,body,created_at').or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`).limit(5000)]);
  const payload={exported_at:new Date().toISOString(),account:{cloud_id:profile?.cloud_id||null,email:currentUser.email||null,phone:currentUser.phone||null,handle:profile?.handle||null,plan:profile?.plan||null},tasks:t.data||[],memories:m.data||[],messages:msgs.data||[]};
  const text=JSON.stringify(payload,null,2);
  if(isNative){try{await navigator.clipboard.writeText(text);toast('数据已复制到剪贴板，请粘贴到笔记或文件中保存');}catch{toast('复制失败，请在网页版导出');}return;}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download='efficiency-cloud-export.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('数据已导出');
});
$('deleteAccount').addEventListener('click',async()=>{
  if(!supabase||!currentUser)return;
  const paid='';
  const answer=prompt('删除账户将永久清除你的任务、回忆、好友关系和聊天记录，且无法恢复。'+paid+'\n\n如确认，请输入“删除”：');
  if(answer===null)return;if(answer.trim()!=='删除'){toast('输入不匹配，已取消');return;}
  const {error}=await supabase.rpc('delete_my_account');if(error){toast('删除失败：'+error.message+'。请联系客服处理。');return;}
  await supabase.auth.signOut({scope:'local'}).catch(()=>{});toast('账户已删除');
});
if(isNative){const sa=$('socialAuth'),dv=$('authDivider');if(sa)sa.classList.add('hidden');if(dv)dv.classList.add('hidden');}

// ---- Timeline ("what did I do"), on-this-day, realtime sync ----
const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
const ymd=d=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
function renderItems(box,rows){
  box.replaceChildren();
  const days=new Map();rows.forEach(r=>{if(!days.has(r.day))days.set(r.day,[]);days.get(r.day).push(r);});
  days.forEach((items,day)=>{const wrap=document.createElement('section');wrap.className='timeline-day';const h=document.createElement('h3');h.textContent=day;wrap.append(h);
    items.forEach(r=>{const it=document.createElement('div');it.className='timeline-item '+r.kind;const t=document.createElement('strong');t.textContent=(r.kind==='task'?'✅ 完成：':'📝 回忆：')+r.title;it.append(t);
      const meta=document.createElement('small');meta.textContent=(r.kind==='task'&&r.category?r.category+' · ':'')+new Date(r.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});it.append(meta);
      if(r.body){const b=document.createElement('div');b.textContent=r.body.length>200?r.body.slice(0,200)+'…':r.body;it.append(b);}
      wrap.append(it);});
    box.append(wrap);});
}
async function loadTimeline(from,to){
  if(!supabase||!currentUser||!$('timeline'))return;
  const now=new Date(),start=new Date(now.getTime()-6*86400000);
  from=from||$('reviewFrom').value||ymd(start);to=to||$('reviewTo').value||ymd(now);
  if(!$('reviewFrom').value)$('reviewFrom').value=from;if(!$('reviewTo').value)$('reviewTo').value=to;
  const {data,error}=await supabase.rpc('my_timeline',{p_from:from,p_to:to,p_tz:tz});const box=$('timeline');
  if(error){box.textContent='暂时无法读取回顾，请确认已执行最新数据库迁移。';return;}
  if(!data?.length){box.textContent='这段时间还没有完成的任务或回忆。完成任务、写下回忆后，这里会自动出现。';return;}
  renderItems(box,data);
}
async function loadOnThisDay(){
  const box=$('onThisDay');if(!box||!supabase||!currentUser)return;const n=new Date();
  const {data,error}=await supabase.rpc('on_this_day',{p_month:n.getMonth()+1,p_day:n.getDate(),p_year:n.getFullYear(),p_tz:tz});
  box.replaceChildren();if(error||!data?.length)return;
  const h=document.createElement('strong');h.textContent='📅 往年的今天你做过：';box.append(h);
  data.slice(0,5).forEach(r=>{const d=document.createElement('div');d.textContent=r.day+'  '+(r.kind==='task'?'完成 ':'回忆 ')+r.title;box.append(d);});
}
document.querySelectorAll('[data-range]').forEach(b=>b.addEventListener('click',()=>{const n=new Date(),days=Number(b.dataset.range);$('reviewFrom').value=ymd(new Date(n.getTime()-days*86400000));$('reviewTo').value=ymd(n);loadTimeline();}));
$('reviewGo').addEventListener('click',()=>{if($('reviewFrom').value>$('reviewTo').value){toast('开始日期不能晚于结束日期');return;}loadTimeline();});
async function refreshAll(){const r=await Promise.all([loadTasks(),loadProfile(),loadMemories(),loadSocial(),loadTimeline(),loadOnThisDay()]);setStatus('云端已同步 '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));return r;}
let refreshTimer=null,syncChannel=null;
function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(currentUser)refreshAll();},600);}
function startRealtime(){
  if(!supabase||!currentUser||syncChannel)return;
  try{syncChannel=supabase.channel('ec-sync-'+currentUser.id)
    .on('postgres_changes',{event:'*',schema:'public',table:'tasks',filter:'user_id=eq.'+currentUser.id},scheduleRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'memories',filter:'user_id=eq.'+currentUser.id},scheduleRefresh).subscribe();}catch(e){console.warn('Realtime unavailable',e);}
}
function stopRealtime(){if(syncChannel&&supabase){supabase.removeChannel(syncChannel);}syncChannel=null;}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&currentUser)scheduleRefresh();});
addEventListener('online',()=>{if(currentUser)scheduleRefresh();});
setInterval(()=>{if(currentUser&&!document.hidden)refreshAll();},120000);

async function initialize(){if(!configured){setStatus('等待配置');$('authMessage').textContent='请配置 .env.local 中的 Supabase URL 与 Publishable Key 后启动。';$('authMessage').classList.add('error');return;}setStatus('云端连接中');const {data:{session},error}=await supabase.auth.getSession();if(error){setStatus('连接异常');$('authMessage').textContent=error.message;return;}if(session?.user){showDashboard(session.user);if(recoveryMode)$('recoveryStatus').textContent='如果你是通过密码恢复链接进入，请在下方设置新密码。';await refreshAll();startRealtime();}else{showAuth();setStatus('等待登录');}supabase.auth.onAuthStateChange((event,next)=>{if(next?.user){showDashboard(next.user);setStatus('云端已连接');if(event==='SIGNED_IN' && !recoveryMode) queueMicrotask(()=>sendSecurityAlert('new_sign_in'));if(event==='PASSWORD_RECOVERY'){recoveryMode=true;$('recoveryStatus').textContent='已验证恢复链接。请设置新密码以恢复账户。';$('newAccountPassword').focus();}queueMicrotask(()=>{refreshAll();startRealtime();});}else{stopRealtime();currentUser=null;tasks=[];profile=null;selectedFriendId=null;renderTasks();showAuth();setStatus('等待登录');}});}
initialize();
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

/* ===== 效率云 · 界面收尾 v1（只隐藏与改文案，不删任何元素） ===== */
(function(){
  try{
    var hide=function(el){if(el)el.style.display='none'};
    var txt=function(el,t){if(el)el.textContent=t};

    /* 1 好友与聊天整块隐藏；回忆面板撑满整行 */
    var panels=document.querySelectorAll('.feature-panel');
    for(var i=0;i<panels.length;i++){
      if(panels[i].textContent.indexOf('好友与聊天')>-1){hide(panels[i])}
      else{panels[i].style.gridColumn='1/-1'}
    }

    /* 2 效率云 ID 那一行隐藏（正在读取…/复制 ID），卡片其余全保留 */
    var cid=document.getElementById('copyCloudId');
    if(cid){hide(cid.closest('.account-id-row'))}

    /* 3 手机号登录：页签和输入区一起隐藏 */
    hide(document.querySelector('.auth-tabs'));
    hide(document.getElementById('phoneAuthFields'));

    /* 4 回忆文案：云端回忆 → 我的回忆；保存到云端 → 保存回忆 */
    var hs=document.querySelectorAll('.feature-panel .panel-heading h2');
    for(var j=0;j<hs.length;j++){
      if(hs[j].textContent.indexOf('云端回忆')>-1){txt(hs[j],'📔 我的回忆')}
    }
    txt(document.querySelector('#memoryForm button[type="submit"]'),'保存回忆');

    /* 5 账户说明去掉「好友」二字 */
    var ps=document.querySelectorAll('.account-panel .panel-heading p');
    for(var k=0;k<ps.length;k++){
      if(ps[k].textContent.indexOf('好友')>-1){
        txt(ps[k],'一个独立账户，在支持效率云的设备间同步你的任务与回忆。')
      }
    }

    /* 6 Apple ID 小字 + Google/Apple 按钮 + 「或使用以下方式继续」 */
    var fp=document.querySelectorAll('.fine-print');
    for(var m=0;m<fp.length;m++){
      if(fp[m].textContent.indexOf('Apple ID')>-1){hide(fp[m])}
    }
    hide(document.getElementById('socialAuth'));
    hide(document.getElementById('authDivider'));
  }catch(e){}
})();

/* ===== 提示气泡里的「云端」也换掉（失败自动跳过） ===== */
try{
  var _toast0=toast;
  if(typeof _toast0==='function'){
    toast=function(msg){
      if(typeof msg==='string'){
        msg=msg.replace(/已保存到云端/g,'已保存')
               .replace(/保存到云端/g,'保存')
               .replace(/云端回忆/g,'我的回忆')
               .replace(/云端/g,'');
      }
      return _toast0(msg);
    };
  }
}catch(e){}

/* ===== 回忆表单按钮：去掉「云端」（JS 会重置，所以持续纠正） ===== */
(function(){
  try{
    var form=document.getElementById('memoryForm');
    if(!form)return;
    var fix=function(){
      var bs=form.querySelectorAll('button');
      for(var i=0;i<bs.length;i++){
        var t=bs[i].textContent||'';
        if(t.indexOf('云端')>-1){
          bs[i].textContent=t.replace(/保存到云端/g,'保存回忆')
                              .replace(/更新到云端/g,'更新回忆')
                              .replace(/云端/g,'');
        }
      }
    };
    fix();
    try{new MutationObserver(fix).observe(form,{childList:true,subtree:true,characterData:true})}catch(e){}
    setInterval(fix,1500);
  }catch(e){}
})();

/* ===== 隐藏「回顾：我做过什么」整块 ===== */
(function(){
  try{
    var rp=document.getElementById('reviewPanel');
    if(rp){rp.style.display='none'}
  }catch(e){}
})();

/* ===== 隐藏所有搜索框（元素保留，只隐藏） ===== */
(function(){
  try{
    var st=document.getElementById('searchTasks');
    if(st){st.style.display='none'}

    var ms=document.getElementById('memorySearch');
    if(ms){ms.style.display='none'}

    /* 副标题里的「按关键词」已经没有搜索了，顺手改掉 */
    var ps=document.querySelectorAll('.panel-heading p');
    for(var i=0;i<ps.length;i++){
      if(ps[i].textContent.indexOf('按关键词')>-1){
        ps[i].textContent='记录重要经历，随时回看过去写下的片段。';
      }
    }

    /* 空列表提示：「还没有匹配的回忆」→「还没有回忆」 */
    var list=document.getElementById('memoryList');
    if(list){
      var fix=function(){
        var els=list.querySelectorAll('*');
        for(var k=0;k<els.length;k++){
          var el=els[k];
          if(el.children.length===0&&el.textContent.indexOf('匹配')>-1){
            el.textContent=el.textContent.replace(/还没有匹配的回忆/g,'还没有回忆');
          }
        }
      };
      fix();
      try{new MutationObserver(fix).observe(list,{childList:true,subtree:true,characterData:true})}catch(e){}
    }
  }catch(e){}
})();
