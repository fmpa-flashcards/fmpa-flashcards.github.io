/* Plan de révision 32 semaines. */
import {
  requireAuth, user, guardPro, fb, loadPlan,
  esc, $, $$, tabbar, toast, todayStr, touchStudy
} from './common.js';
import { doc, getDoc, setDoc } from '../vendor/firebase/firebase-firestore.js';

await requireAuth();
if (!guardPro('Plan de révision', 'plan')) throw new Error('locked');

const { db } = fb();
const app = document.getElementById('app');
let planState = null;
let planTimer = null;
let openWeek = null;

async function getPlanState() {
  if (planState) return planState;
  const ref = doc(db, 'users', user.uid, 'meta', 'plan');
  const snap = await getDoc(ref);
  if (snap.exists()) {
    planState = snap.data();
  } else {
    planState = { startDate: todayStr(), checks: {} };
    try { await setDoc(ref, planState); } catch (e) {}
  }
  return planState;
}
function savePlanState() {
  clearTimeout(planTimer);
  planTimer = setTimeout(async () => {
    try {
      await setDoc(doc(db, 'users', user.uid, 'meta', 'plan'), planState, { merge: true });
    } catch (e) { console.warn('plan save', e); }
  }, 1500);
}
function weekDates(startDate, n) {
  const d = new Date(startDate + 'T12:00:00');
  d.setDate(d.getDate() + (n - 1) * 7);
  const e = new Date(d); e.setDate(e.getDate() + 6);
  const f = (x) => x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return f(d) + ' → ' + f(e);
}

async function render() {
  const plan = await loadPlan();
  const st = await getPlanState();
  const totalTasks = plan.reduce((a, w) => a + w.tasks.length, 0);
  const doneTasks = Object.values(st.checks || {}).flat().filter(Boolean).length;
  const pct = totalTasks ? Math.round(doneTasks / totalTasks * 100) : 0;

  let html = `
    <div class="topbar"><h2>🗓️ Plan 32 semaines</h2></div>
    <div class="xpbar">
      <div class="row"><b>${doneTasks}/${totalTasks} tâches</b><span>${pct}%</span></div>
      <div class="track"><div style="width:${pct}%"></div></div>
    </div>
    <div class="kv"><div class="r"><span class="k">Début du plan</span>
      <span class="v"><input type="date" id="planStart" value="${esc(st.startDate || '')}" class="input" style="margin:0;padding:6px 8px;width:auto"></span></div>
    </div>`;
  for (const w of plan) {
    const checks = (st.checks && st.checks[String(w.n)]) || [];
    const done = checks.filter(Boolean).length;
    const open = openWeek === w.n;
    html += `
    <div class="week">
      <button class="week-head" data-w="${w.n}">
        <div><span class="phase">${esc(w.phase)}</span>
          <h3>S${w.n} — ${esc(w.title)}</h3>
          <small>${esc(weekDates(st.startDate, w.n))} · ${done}/${w.tasks.length} ✓</small></div>
        <div style="font-size:1.2rem">${open ? '▾' : '▸'}</div>
      </button>
      ${open ? `
        <p class="small" style="margin:10px 0 4px"><b>Focus :</b> ${esc(w.focus || '')}</p>
        ${w.milestone ? `<p class="small" style="color:var(--teal);font-weight:700">🎯 ${esc(w.milestone)}</p>` : ''}
        <div>${w.tasks.map((t, ti) => `
          <label class="task ${checks[ti] ? 'done' : ''}">
            <input type="checkbox" data-wn="${w.n}" data-ti="${ti}" ${checks[ti] ? 'checked' : ''}>
            <span>${esc(t)}</span>
          </label>`).join('')}
        </div>` : ''}
    </div>`;
  }
  html += `
    <button class="btn btn-ghost mt" id="planReset">Réinitialiser le plan</button>
    <p class="small" style="text-align:center">Ta progression du plan est sauvegardée sur ton compte.</p>`;
  app.innerHTML = html;

  $$('.week-head').forEach(b => b.onclick = () => {
    openWeek = openWeek === +b.dataset.w ? null : +b.dataset.w;
    render();
  });
  $$('.task input').forEach(cb => cb.onchange = async () => {
    const st2 = await getPlanState();
    const wn = cb.dataset.wn;
    st2.checks[wn] = st2.checks[wn] || [];
    st2.checks[wn][+cb.dataset.ti] = cb.checked;
    savePlanState();
    cb.closest('.task').classList.toggle('done', cb.checked);
    touchStudy();
  });
  $('#planStart').onchange = async (e) => {
    const st2 = await getPlanState();
    st2.startDate = e.target.value;
    savePlanState();
    render();
  };
  const rst = $('#planReset');
  rst.onclick = () => {
    if (!rst.dataset.armed) {
      rst.dataset.armed = '1';
      rst.textContent = 'Touche encore pour confirmer la réinitialisation';
      setTimeout(() => { rst.dataset.armed = ''; rst.textContent = 'Réinitialiser le plan'; }, 4000);
    } else {
      planState = { startDate: todayStr(), checks: {} };
      savePlanState();
      toast('Plan réinitialisé 🗓️');
      render();
    }
  };
}

await render();
document.body.insertAdjacentHTML('beforeend', tabbar('plan'));
