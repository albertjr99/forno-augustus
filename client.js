/* Forno Augustus — página do cliente (abre pelo QR da plaquinha) */
(function () {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => (Math.round((n || 0) * 100) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const first = n => (n || '').trim().split(/\s+/)[0] || '';
const noAccent = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const P = {
  qr: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  bread: '<path d="M5 11a7 5 0 0 1 14 0v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M9 9.5l1.5 2M13 8.5l1.5 2"/>',
  back: '<path d="M15 18l-6-6 6-6"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8"/>'
};
const ic = n => '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + P[n] + '</svg>';

let catalog = null, stock = null, fs = null, auth = null, ready = false;
const st = { step: 'vitrine', cart: {}, name: '', phone: '', last: null, sending: false };
try { st.name = localStorage.getItem('fa_cli_name') || ''; st.phone = localStorage.getItem('fa_cli_phone') || ''; } catch (e) {}

const products = () => (catalog && catalog.products) || [];
const prod = id => products().find(p => p.id === id);
const itemsTotal = it => Object.keys(it).reduce((s, id) => s + (prod(id) ? prod(id).price * it[id] : 0), 0);
const itemsQty = it => Object.values(it).reduce((s, q) => s + q, 0);
function availability() {
  if (!stock || stock.date !== today()) return null;
  const taken = stock.taken || {}; if (!itemsQty(taken)) return null;
  const av = {}; products().forEach(p => { av[p.id] = Math.max(0, (taken[p.id] || 0) - ((stock.sold || {})[p.id] || 0) - ((stock.returned || {})[p.id] || 0)); });
  return av;
}

function emv(id, v) { return id + String(v.length).padStart(2, '0') + v; }
function crc16(s) { let c = 0xFFFF; for (let i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) { c = (c & 0x8000) ? ((c << 1) ^ 0x1021) : (c << 1); c &= 0xFFFF; } } return c.toString(16).toUpperCase().padStart(4, '0'); }
function pix(amount) {
  if (!catalog || !catalog.pixKey) return '';
  const clean = (t, n) => noAccent(t).toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().slice(0, n) || 'X';
  let p = emv('00', '01') + emv('26', emv('00', 'br.gov.bcb.pix') + emv('01', catalog.pixKey.trim())) + emv('52', '0000') + emv('53', '986') +
    emv('54', amount.toFixed(2)) + emv('58', 'BR') + emv('59', clean(catalog.pixName, 25)) + emv('60', clean(catalog.pixCity || 'BRASIL', 15)) + emv('62', emv('05', '***')) + '6304';
  return p + crc16(p);
}

let tt;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2600); }

function header() {
  return '<header class="chero"><img src="img/logo.webp" alt="Forno Augustus"><div><div class="chero-t">Forno Augustus</div><div class="chero-s">Pães caseiros da Talita</div></div></header><div class="cpage">';
}
function render() {
  if (!ready) { $('#app').innerHTML = header() + '<div class="loading">Carregando os pães de hoje…</div></div>'; return; }
  if (!products().length) { $('#app').innerHTML = header() + '<div class="card empty"><b>Cardápio indisponível agora</b>Tente de novo em instantes.</div></div>'; return; }
  const total = itemsTotal(st.cart), qty = itemsQty(st.cart);
  let h = header();
  if (st.step === 'vitrine') {
    h += '<div class="ctitle">Pegou um pãozinho?</div><div class="csub">Marque o que você levou. Leva 10 segundos.</div>';
    const av = availability();
    h += products().map(p => { const left = av ? av[p.id] : null; const inCart = st.cart[p.id] || 0; const off = left === 0 && !inCart;
      return '<div class="prod' + (off ? ' off' : '') + '"><div class="ph" style="' + (p.photo ? 'background-image:url(' + p.photo + ')' : '') + '">' + (p.photo ? '' : ic('bread')) + '</div>' +
      '<div class="grow"><b>' + esc(p.name) + '</b><div class="muted" style="font-size:13px">' + esc(p.desc || '') + '</div><div class="money" style="color:var(--brown);font-size:17px">' + money(p.price) + '</div>' +
      (left === null ? '' : off ? '<span class="soldout">Esgotado hoje</span>' : '<span class="left">Restam ' + left + '</span>') + '</div>' +
      (off ? '' : '<div class="step"><button data-a="dec" data-id="' + esc(p.id) + '" aria-label="Menos">−</button><output>' + inCart + '</output>' +
      '<button class="plus" data-a="inc" data-id="' + esc(p.id) + '" aria-label="Mais"' + (left !== null && inCart >= left ? ' disabled' : '') + '>+</button></div>') + '</div>'; }).join('');
    h += '</div><div class="cbar"><button class="btn btn-dark btn-block" data-a="next"' + (qty ? '' : ' style="opacity:.5"') + '><span>' + (qty ? qty + (qty > 1 ? ' itens · ' : ' item · ') + money(total) : 'Escolha o que pegou') + '</span>' + (qty ? '<span style="margin-left:auto">Continuar</span>' : '') + '</button></div>';
  } else if (st.step === 'dados') {
    h += '<button class="cback" data-a="back">' + ic('back') + 'Voltar</button><div class="ctitle">Quase lá!</div>';
    h += '<div class="card">' + Object.keys(st.cart).filter(id => st.cart[id] && prod(id)).map(id => '<div class="row" style="justify-content:space-between;padding:4px 0"><span>' + st.cart[id] + '× ' + esc(prod(id).name) + '</span><span>' + money(prod(id).price * st.cart[id]) + '</span></div>').join('') +
      '<div class="row" style="justify-content:space-between;border-top:1px solid var(--line);margin-top:8px;padding-top:8px;font-weight:800"><span>Total</span><span class="money" style="font-size:22px">' + money(total) + '</span></div></div>';
    h += '<label class="f">Seu nome<input class="inp" id="cName" maxlength="50" value="' + esc(st.name) + '" placeholder="Ex.: Juliana do financeiro" autocomplete="name"></label>' +
      '<label class="f">WhatsApp (opcional)<input class="inp" id="cPhone" maxlength="20" inputmode="tel" value="' + esc(st.phone) + '" placeholder="(11) 99999-9999"></label>' +
      '<div class="hint">Fica salvo neste celular. Na próxima é só tocar.</div>';
    h += (catalog.pixKey ? '<button class="btn btn-green btn-block" data-a="pix">' + ic('qr') + 'Pagar agora no Pix</button>' : '') +
      '<button class="btn btn-line btn-block" data-a="send" data-s="anotado"' + (st.sending ? ' disabled' : '') + '>Vou pagar depois</button></div>';
  } else if (st.step === 'pix') {
    const code = pix(total);
    h += '<button class="cback" data-a="back">' + ic('back') + 'Voltar</button><div class="ctitle">Pague ' + money(total) + ' no Pix</div>';
    h += '<div class="card"><ol class="csteps"><li>Toque em <b>Copiar código Pix</b></li><li>Abra o app do seu banco e escolha <b>Pix copia e cola</b></li><li>Cole, confira o valor e pague</li></ol>' +
      '<div class="code" style="margin:10px 0">' + esc(code) + '</div><button class="btn btn-ember btn-block" data-a="copy">' + ic('copy') + 'Copiar código Pix</button>' +
      '<div class="hint" style="margin-top:8px">Chave Pix: ' + esc(catalog.pixKey) + '</div></div>';
    h += '<button class="btn btn-green btn-block" data-a="send" data-s="pago"' + (st.sending ? ' disabled' : '') + '>' + ic('check') + (st.sending ? 'Enviando…' : 'Já paguei') + '</button></div>';
  } else {
    const l = st.last || {};
    h += '<div class="cok"><div class="cok-ic">' + ic('check') + '</div><div class="ctitle" style="text-align:center">Obrigada, ' + esc(first(l.customer)) + '!</div>' +
      '<div class="csub" style="text-align:center">' + (l.status === 'pago' ? 'Seu pagamento de ' + money(l.total) + ' foi informado à Talita.' : 'Anotamos ' + money(l.total) + ' no seu nome. Quando puder, pague pelo Pix da plaquinha.') + '</div></div>' +
      '<button class="btn btn-line btn-block" data-a="again">Registrar outra compra</button></div>';
  }
  $('#app').innerHTML = h;
}
function saveFields() {
  const n = $('#cName'); if (!n) return !!st.name;
  st.name = n.value.trim().slice(0, 50); st.phone = $('#cPhone').value.trim().slice(0, 20);
  if (!st.name) { toast('Coloque seu nome'); n.focus(); return false; }
  try { localStorage.setItem('fa_cli_name', st.name); localStorage.setItem('fa_cli_phone', st.phone); } catch (e) {}
  return true;
}
function send(status) {
  if (st.sending) return;
  if (st.step === 'dados' && !saveFields()) return;
  const items = {}; Object.keys(st.cart).forEach(id => { if (st.cart[id] > 0 && prod(id)) items[id] = st.cart[id]; });
  if (!itemsQty(items)) { st.step = 'vitrine'; render(); return; }
  const k = today();
  const sale = { id: uid(), date: k, ts: Date.now(), customer: st.name, phone: st.phone, items, total: Math.round(itemsTotal(items) * 100) / 100,
    status, paidAt: status === 'pago' ? k : null, by: 'Cliente (QR)', source: 'cliente', selfReported: status === 'pago' };
  st.sending = true; render();
  const go = () => FB.setDoc(FB.doc(fs, 'sales', sale.id), sale).then(() => {
    if (stock && stock.date === k) { const upd = {}; Object.keys(items).forEach(id => { upd['sold.' + id] = FB.increment(items[id]); }); FB.updateDoc(FB.doc(fs, 'public', 'stock'), upd).catch(() => {}); }
    st.sending = false; st.last = sale; st.cart = {}; st.step = 'ok'; render(); scrollTo(0, 0);
  }).catch(e => { st.sending = false; render(); toast('Não foi possível enviar. Confira a internet e tente de novo.'); console.error(e); });
  if (auth.currentUser) go(); else FB.signInAnonymously(auth).then(go).catch(e => { st.sending = false; render(); toast('Sem conexão. Tente de novo.'); console.error(e); });
}
const A = {
  inc(d) { const av = availability(); if (av && (st.cart[d.id] || 0) >= av[d.id]) { toast('Só restam ' + av[d.id]); return; } st.cart[d.id] = (st.cart[d.id] || 0) + 1; render(); },
  dec(d) { st.cart[d.id] = Math.max(0, (st.cart[d.id] || 0) - 1); render(); },
  next() { if (!itemsQty(st.cart)) { toast('Marque o que você pegou'); return; } st.step = 'dados'; render(); scrollTo(0, 0); },
  back() { if (st.step === 'pix') st.step = 'dados'; else { saveFields(); st.step = 'vitrine'; } render(); scrollTo(0, 0); },
  pix() { if (!saveFields()) return; st.step = 'pix'; render(); scrollTo(0, 0); },
  send(d) { send(d.s); },
  again() { st.step = 'vitrine'; st.cart = {}; render(); },
  copy() {
    const code = pix(itemsTotal(st.cart));
    const ok = () => toast('Código copiado! Agora abra o app do banco.');
    try { navigator.clipboard.writeText(code).then(ok, fallback); } catch (e) { fallback(); }
    function fallback() { const t = document.createElement('textarea'); t.value = code; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('Copie o código acima manualmente'); } t.remove(); }
  }
};
document.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (!el || el.disabled) return; const f = A[el.dataset.a]; if (f) f(el.dataset); });

try {
  const app = FB.initializeApp(window.FA_CONFIG.firebase);
  try { auth = FB.initializeAuth(app, { persistence: [FB.indexedDBLocalPersistence, FB.browserLocalPersistence] }); } catch (e) { auth = FB.getAuth(app); }
  fs = FB.initializeFirestore(app, { localCache: FB.memoryLocalCache() });
  FB.onSnapshot(FB.doc(fs, 'public', 'catalog'), d => { catalog = d.exists() ? d.data() : { products: [] }; ready = true; render(); },
    e => { ready = true; catalog = { products: [] }; render(); console.error(e); });
  FB.onSnapshot(FB.doc(fs, 'public', 'stock'), d => {
    stock = d.exists() ? d.data() : null;
    const av = availability(); if (av && st.step === 'vitrine') Object.keys(st.cart).forEach(id => { if (st.cart[id] > av[id]) st.cart[id] = av[id]; });
    if (ready) render();
  }, e => console.error(e));
  FB.signInAnonymously(auth).catch(e => console.error(e));
} catch (e) { console.error(e); ready = true; catalog = { products: [] }; }
render();
})();
