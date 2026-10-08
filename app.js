// Arquivo — lê somente data/movies.json. Nenhuma chave de API no navegador.
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const decadeOf = m => m.year ? `${Math.floor(m.year / 10) * 10}s` : 'Aguardados';

let all = [], shown = [];
const f = { q: '', kind: '', service: '', decade: '', genre: '', sort: 'added-desc' };

// Pôster: local → URL remota guardada → placeholder desenhado
function posterHTML(m, lazy = true) {
  const ph = `<div class="ph"><b>${esc(m.name)}</b><span>${esc(m.director || m.year || 'Sem pôster')}</span></div>`;
  const src = m.poster || m.posterRemote;
  if (!src) return ph;
  const next = m.poster && m.posterRemote ? ` data-next="${esc(m.posterRemote)}"` : '';
  return `${ph}<img src="${esc(src)}"${next} alt="Pôster de ${esc(m.name)}" width="500" height="750" ${lazy ? 'loading="lazy"' : ''} decoding="async">`;
}
document.addEventListener('error', e => {
  const img = e.target;
  if (img.tagName !== 'IMG') return;
  if (img.dataset.next) { img.src = img.dataset.next; delete img.dataset.next; } else img.remove();
}, true);

function cardHTML(m) {
  const first = esc(m.year || m.status || 'Aguardado'), prov = m.providers?.[0] ? ` · <em>${esc(m.providers[0])}</em>` : '';
  return `<button class="card" data-id="${esc(m.id)}"><div class="poster">${posterHTML(m)}</div>
    <div class="cap"><b>${esc(m.name)}</b><span>${first}${prov}</span></div></button>`;
}

function counts(key, list) {
  const n = {};
  list.forEach(m => (Array.isArray(m[key]) ? m[key] : [m[key]]).forEach(v => v && (n[v] = (n[v] || 0) + 1)));
  return n;
}
function chips(el, key, n, top) {
  const names = Object.keys(n).sort((a, b) => n[b] - n[a]).slice(0, top);
  el.innerHTML = names.map(k => `<button class="chip" data-k="${key}" data-v="${esc(k)}" aria-pressed="${f[key] === k}">${esc(k)}<small>${n[k]}</small></button>`).join('');
}
function options(el, label, values) {
  el.innerHTML = `<option value="">${label}</option>` + values.map(v => `<option>${esc(v)}</option>`).join('');
}

function apply() {
  const q = norm(f.q);
  shown = all.filter(m =>
    (!q || norm(m.name).includes(q) || norm(m.director).includes(q)) &&
    (!f.kind || m.type === f.kind) &&
    (!f.service || m.providers?.includes(f.service)) &&
    (!f.decade || decadeOf(m) === f.decade) &&
    (!f.genre || m.genres?.includes(f.genre)));
  const [by, dir] = f.sort.split('-'), s = dir === 'asc' ? 1 : -1;
  shown.sort(by === 'name' ? (a, b) => a.name.localeCompare(b.name, 'pt')
    : (a, b) => s * String(a[by] ?? '').localeCompare(String(b[by] ?? '')) || a.name.localeCompare(b.name, 'pt'));
  $('#acervo').innerHTML = shown.map(cardHTML).join('');
  $('#empty').hidden = !!shown.length;
  $('#count').textContent = `${shown.length} ${shown.length === 1 ? 'título' : 'títulos'}`;
  $('#clear').hidden = !(f.q || f.kind || f.service || f.decade || f.genre);
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', f[c.dataset.k] === c.dataset.v));
}

function openModal(id) {
  const m = all.find(x => x.id === id); if (!m) return;
  const run = m.runtime ? `${Math.floor(m.runtime / 60)}h ${m.runtime % 60}min` : '';
  $('#m-title').textContent = m.name;
  $('.m-poster').innerHTML = `<div class="poster">${posterHTML(m, false)}</div>`;
  $('.m-meta').textContent = [m.year || m.status, m.director, run, m.type, (m.genres || []).join(', ')].filter(Boolean).join(' · ');
  $('.m-over').textContent = m.overview || '';
  $('.m-prov').textContent = m.providers?.length ? m.providers.join(' · ') : 'Fora dos streamings por assinatura no Brasil.';
  $('#modal').showModal();
}

function init(data) {
  all = data.items || [];
  const years = new Set(all.filter(m => m.year).map(decadeOf));
  $('#lede').innerHTML = all.length
    ? `<b>${all.length} títulos</b> reunidos em uma coleção particular — um arquivo em construção, organizado por tempo, curiosidade e desejo.`
    : 'Um arquivo em construção — filmes que ainda vão encontrar seu lugar aqui.';
  chips($('#kinds'), 'kind', counts('type', all), 6);
  chips($('#services'), 'service', counts('providers', all), 8);
  options($('#decade'), 'Todas', [...years].sort().reverse().concat(all.some(m => !m.year) ? ['Aguardados'] : []));
  options($('#genre'), 'Todos', Object.keys(counts('genres', all)).sort((a, b) => a.localeCompare(b, 'pt')));
  if (data.updated) $('#stamp').textContent = `Atualizado em ${new Date(data.updated).toLocaleDateString('pt-BR')}`;
  apply();
}

document.addEventListener('click', e => {
  const chip = e.target.closest('.chip'), card = e.target.closest('.card');
  if (chip) { const { k, v } = chip.dataset; f[k] = f[k] === v ? '' : v; apply(); }
  else if (card) openModal(card.dataset.id);
  else if (e.target === $('#modal')) $('#modal').close();
});
$('#m-close').onclick = () => $('#modal').close();
$('#q').addEventListener('input', e => { f.q = e.target.value; apply(); });
['decade', 'genre', 'sort'].forEach(k => $('#' + k).addEventListener('change', e => { f[k] = e.target.value; apply(); }));
$('#clear').onclick = () => { Object.assign(f, { q: '', kind: '', service: '', decade: '', genre: '' }); $('#q').value = ''; $('#decade').value = $('#genre').value = ''; apply(); };
$('#pick').onclick = () => {
  const pool = (shown.filter(m => m.year && m.providers?.length).length ? shown.filter(m => m.year && m.providers?.length) : shown);
  if (pool.length) openModal(pool[Math.floor(Math.random() * pool.length)].id);
};
document.addEventListener('keydown', e => {
  if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('#q').focus(); }
});

fetch('data/movies.json').then(r => { if (!r.ok) throw 0; return r.json(); }).then(init)
  .catch(() => { $('#lede').textContent = 'O arquivo de dados ainda não foi gerado. Rode: node build-data.mjs'; });
