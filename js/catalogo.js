/* SD Comayagua | Catálogo sincronizado con Google Sheets
   - Fuente: Google Sheets (GViz)
   - Tabs esperadas: ofertas, gamer, pc, movil, streaming, cobertores, power
*/

(function(){
  'use strict';

  var SHEET_ID = '1pp4fQRoy9hI5aqFaEGkqIpMSb2v85FP3MgBhCqrnmt4';
  var PHONE = '50431517755';

  var TABS = [
    { key: 'ofertas', label: 'Ofertas' },
    { key: 'gamer', label: 'Gamer' },
    { key: 'pc', label: 'PC' },
    { key: 'movil', label: 'Móvil' },
    { key: 'streaming', label: 'Streaming' },
    { key: 'cobertores', label: 'Cobertores' },
    { key: 'power', label: 'Power' }
  ];

  var state = {
    loading: true,
    products: [],
    search: '',
    category: 'todos',
    onlyAvailable: false
  };

  var els = {};

  function $(id){ return document.getElementById(id); }

  function setStatus(msg){
    if(els.status) els.status.textContent = msg;
  }

  function escapeHtml(str){
    if(str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function normalizeImageUrl(url){
    if(!url) return '';
    var u = String(url).trim();

    // Google Drive share links, try to convert to direct (best-effort)
    // (If user uses Drive images later)
    if(u.includes('drive.google.com') && u.includes('/file/d/')){
      var m = u.match(/\/file\/d\/([^/]+)/);
      if(m && m[1]) return 'https://drive.google.com/uc?export=view&id=' + m[1];
    }

    // GitHub "blob" → raw
    if(u.includes('github.com') && u.includes('/blob/')){
      // https://github.com/user/repo/blob/branch/path
      u = u.replace('https://github.com/', 'https://raw.githubusercontent.com/');
      u = u.replace('/blob/', '/');
    }

    // Sometimes links already have ?raw=1
    u = u.replace(/\?raw=1$/,'');

    return u;
  }

  function toNumber(v){
    if(v === null || v === undefined) return null;
    if(typeof v === 'number') return v;
    var s = String(v).replace(/[\s,]/g,'').trim();
    if(!s) return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }

  function moneyLps(v){
    var n = toNumber(v);
    if(n === null) return '';
    // no intl dependency; keep simple
    return 'L ' + n.toFixed(n % 1 === 0 ? 0 : 2);
  }

  function parseGViz(text){
    // Expected: google.visualization.Query.setResponse({...});
    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if(start === -1 || end === -1) throw new Error('Respuesta inválida de Sheets');
    var json = text.substring(start, end + 1);
    return JSON.parse(json);
  }

  function gvizUrl(sheetName){
    return 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(SHEET_ID) +
      '/gviz/tq?sheet=' + encodeURIComponent(sheetName) + '&tqx=out:json';
  }

  function rowToObj(cols, row){
    var o = {};
    for(var i=0; i<cols.length; i++){
      var key = (cols[i] || '').trim();
      if(!key) continue;
      var cell = row.c && row.c[i] ? row.c[i].v : null;
      o[key] = cell;
    }
    return o;
  }

  function isEmptyRow(obj){
    var keys = Object.keys(obj);
    for(var i=0;i<keys.length;i++){
      var v = obj[keys[i]];
      if(v !== null && v !== undefined && String(v).trim() !== '') return false;
    }
    return true;
  }

  function isSectionRow(obj){
    var c = obj.categoria;
    return (typeof c === 'string' && c.trim().startsWith('▌'));
  }

  function isAvailable(obj){
    var estado = (obj.estado || '').toString().toLowerCase().trim();
    var stock = toNumber(obj.stock);
    if(estado === 'agotado') return false;
    if(stock !== null && stock <= 0) return false;
    // if estado blank and stock blank, assume available
    return true;
  }

  function waLink(obj){
    var txt = (obj.whatsapp && String(obj.whatsapp).trim())
      ? String(obj.whatsapp)
      : 'Hola SD Comayagua.\n\nEstoy interesado en: ' + (obj.nombre || 'un producto') + '\n\n¿Está disponible?';

    // Add id if present
    if(obj.id && String(obj.id).trim()){
      txt += '\n\nCódigo/ID: ' + String(obj.id).trim();
    }

    return 'https://wa.me/' + PHONE + '?text=' + encodeURIComponent(txt);
  }

  function matchesSearch(obj, q){
    if(!q) return true;
    q = q.toLowerCase();
    var hay = [obj.nombre, obj.descripcion, obj.subcategoria, obj.categoria, obj._sheet].map(function(x){
      return (x === null || x === undefined) ? '' : String(x).toLowerCase();
    }).join(' | ');
    return hay.indexOf(q) !== -1;
  }

  function categoryMatches(obj, cat){
    if(cat === 'todos') return true;
    // prefer sheet tab
    if(obj._sheet && obj._sheet.toLowerCase() === cat) return true;
    var c = (obj.categoria || '').toString().toLowerCase().trim();
    return c === cat;
  }

  function buildCard(obj){
    var img = normalizeImageUrl(obj.imagen);
    var name = escapeHtml(obj.nombre || 'Producto');
    var sub = escapeHtml(obj.subcategoria || '');
    var desc = escapeHtml(obj.descripcion || '');

    var price = moneyLps(obj.precio);
    var oldPrice = moneyLps(obj.precio_anterior);

    var available = isAvailable(obj);
    var badge = available
      ? '<span class="sdc-badge sdc-badge-ok">Disponible</span>'
      : '<span class="sdc-badge sdc-badge-no">Agotado</span>';

    var offer = (toNumber(obj.precio_anterior) && toNumber(obj.precio) && toNumber(obj.precio_anterior) > toNumber(obj.precio))
      ? '<span class="sdc-badge sdc-badge-offer">Oferta</span>'
      : '';

    var videoBtn = '';
    if(obj.tiktok && String(obj.tiktok).trim().startsWith('http')){
      videoBtn = '<a class="btn btn-outline-dark btn-sm sdc-mini" href="' + escapeHtml(String(obj.tiktok).trim()) + '" target="_blank" rel="noopener">Ver video</a>';
    }

    var imgTag = img
      ? '<img src="' + escapeHtml(img) + '" alt="' + name + '" loading="lazy" onerror="this.onerror=null;this.src=\'images/computer-img.png\';" />'
      : '<img src="images/computer-img.png" alt="' + name + '" loading="lazy" />';

    var priceHtml = '';
    if(price){
      priceHtml = '<div class="sdc-price">' +
        (oldPrice ? '<span class="sdc-old">' + oldPrice + '</span>' : '') +
        '<span class="sdc-now">' + price + '</span>' +
      '</div>';
    } else {
      priceHtml = '<div class="sdc-price"><span class="sdc-now">Consultar</span></div>';
    }

    var cls = available ? '' : ' sdc-soldout';

    return (
      '<div class="col-lg-3 col-md-4 col-sm-6 sdc-col">' +
        '<div class="sdc-product-card' + cls + '">' +
          '<div class="sdc-thumb">' + imgTag +
            '<div class="sdc-badges">' + offer + badge + '</div>' +
          '</div>' +
          '<div class="sdc-body">' +
            '<div class="sdc-name" title="' + name + '">' + name + '</div>' +
            (sub ? '<div class="sdc-sub">' + sub + '</div>' : '') +
            (desc ? '<div class="sdc-desc">' + desc + '</div>' : '') +
            priceHtml +
            '<div class="sdc-actions">' +
              '<a class="btn btn-success btn-sm sdc-mini" href="' + waLink(obj) + '" target="_blank" rel="noopener"><i class="fa fa-whatsapp"></i> Pedir</a>' +
              videoBtn +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function buildSection(title){
    return '<div class="col-12"><div class="sdc-section">' + escapeHtml(title) + '</div></div>';
  }

  function render(){
    if(!els.grid) return;

    var q = (state.search || '').trim();
    var cat = state.category;

    var out = '';
    var shown = 0;

    // Filter base list (keep original order)
    var filtered = state.products.filter(function(p){
      if(p._type === 'section') return true; // keep section separators for grouping view
      if(!categoryMatches(p, cat)) return false;
      if(state.onlyAvailable && !isAvailable(p)) return false;
      if(!matchesSearch(p, q)) return false;
      return true;
    });

    // If sorting/search is active, flatten without global sections for cleaner UI
    var flatten = (q.length > 0) || state.onlyAvailable || (cat !== 'todos');

    if(flatten){
      var items = filtered.filter(function(p){ return p._type !== 'section'; });
      items.forEach(function(p){ out += buildCard(p); shown++; });
    } else {
      // Grouped view: show by sheet sections
      var bySheet = {};
      TABS.forEach(function(t){ bySheet[t.key] = []; });
      filtered.forEach(function(p){
        var sk = (p._sheet || '').toLowerCase();
        if(!bySheet[sk]) bySheet[sk] = [];
        bySheet[sk].push(p);
      });

      TABS.forEach(function(tab){
        var list = bySheet[tab.key] || [];
        if(!list.length) return;
        out += buildSection(tab.label);
        list.forEach(function(p){
          if(p._type === 'section'){
            out += buildSection(String(p.title || '').replace(/^▌\s*/,'').trim());
          } else {
            out += buildCard(p);
            shown++;
          }
        });
      });
    }

    els.grid.innerHTML = out || '<div class="col-12"><div class="sdc-empty">No se encontraron productos con esos filtros.</div></div>';

    setStatus((state.loading ? 'Cargando… ' : '') + shown + ' productos');
  }

  function bindUI(){
    els.search = $('searchInput');
    els.grid = $('catalogGrid');
    els.status = $('catalogStatus');
    els.category = $('categorySelect');
    els.onlyAvail = $('onlyAvailableToggle');

    if(els.search){
      els.search.addEventListener('input', function(){
        state.search = els.search.value || '';
        render();
      });
    }

    if(els.category){
      els.category.addEventListener('change', function(){
        state.category = els.category.value || 'todos';
        render();
      });
    }

    if(els.onlyAvail){
      els.onlyAvail.addEventListener('change', function(){
        state.onlyAvailable = !!els.onlyAvail.checked;
        render();
      });
    }
  }

  function loadAll(){
    state.loading = true;
    setStatus('Cargando productos…');

    var promises = TABS.map(function(tab){
      return fetch(gvizUrl(tab.key), { cache: 'no-store' })
        .then(function(r){ return r.text(); })
        .then(function(t){
          var data = parseGViz(t);
          var table = data.table;
          var cols = (table.cols || []).map(function(c){ return (c.label || '').toString().trim(); });
          var rows = table.rows || [];

          var list = [];
          for(var i=0;i<rows.length;i++){
            var obj = rowToObj(cols, rows[i]);
            if(isEmptyRow(obj)) continue;
            obj._sheet = tab.key;

            // Treat section rows
            if(isSectionRow(obj)){
              list.push({ _type: 'section', _sheet: tab.key, title: String(obj.categoria || '').trim() });
              continue;
            }

            // Require product name
            if(!obj.nombre || String(obj.nombre).trim() === '') continue;

            list.push(obj);
          }

          return list;
        })
        .catch(function(){
          // If a tab is missing, ignore it.
          return [];
        });
    });

    Promise.all(promises).then(function(all){
      state.products = [].concat.apply([], all);
      state.loading = false;

      var now = new Date();
      var time = now.toLocaleString();
      setStatus('Datos cargados: ' + time);

      render();
    }).catch(function(err){
      state.loading = false;
      setStatus('No se pudo cargar el catálogo. Revisá permisos del Sheet.');
      if(els.grid) els.grid.innerHTML = '<div class="col-12"><div class="sdc-empty">No se pudo cargar el catálogo.\n\n1) Compartí el Google Sheet como “Cualquiera con el enlace (Lector)” o “Publicar en la web”.\n2) Recargá la página.</div></div>';
      // eslint-disable-next-line no-console
      console.error(err);
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    bindUI();
    loadAll();
  });

})();
