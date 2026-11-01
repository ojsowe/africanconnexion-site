/* Minimal runtime for African Connexion pages: renders the page template with the page's Component logic. */
(function () {
  var NS_SVG = 'http://www.w3.org/2000/svg';
  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (patch) {
    var p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = Object.assign({}, this.state, p);
    schedule();
  };
  DCLogic.prototype.forceUpdate = function () { schedule(); };
  window.DCLogic = DCLogic;

  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  function lookup(ctx, path) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^(['"]).*\1$/.test(path)) return path.slice(1, -1);
    var parts = path.split('.'), v = ctx;
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  function interp(str, ctx) {
    return str.replace(HOLE, function (_, p) { var v = lookup(ctx, p); return v == null ? '' : String(v); });
  }
  function child(ctx, extra) { var c = Object.create(ctx); for (var k in extra) c[k] = extra[k]; return c; }

  function renderChildren(nodes, ctx, parent) {
    for (var i = 0; i < nodes.length; i++) renderNode(nodes[i], ctx, parent);
  }
  function renderNode(node, ctx, parent) {
    if (node.nodeType === 3) { parent.appendChild(document.createTextNode(interp(node.nodeValue, ctx))); return; }
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    if (tag === 'sc-for') {
      var m = WHOLE.exec(node.getAttribute('list') || '');
      var list = m ? lookup(ctx, m[1]) : [];
      var as = node.getAttribute('as') || 'item';
      (list || []).forEach(function (item, idx) {
        var extra = { $index: idx }; extra[as] = item;
        renderChildren(node.childNodes, child(ctx, extra), parent);
      });
      return;
    }
    if (tag === 'sc-if') {
      var mv = WHOLE.exec(node.getAttribute('value') || '');
      if (mv && lookup(ctx, mv[1])) renderChildren(node.childNodes, ctx, parent);
      return;
    }
    var el = node.namespaceURI === NS_SVG ? document.createElementNS(NS_SVG, tag) : document.createElement(tag);
    for (var a = 0; a < node.attributes.length; a++) {
      var at = node.attributes[a], name = at.name, val = at.value;
      if (name.indexOf('hint-') === 0) continue;
      var w = WHOLE.exec(val);
      if (/^on[a-z]+$/i.test(name) && w) {
        var fn = w ? lookup(ctx, w[1]) : null;
        if (typeof fn === 'function') el.addEventListener(name.slice(2).toLowerCase(), fn);
        continue;
      }
      if (w) {
        var v = lookup(ctx, w[1]);
        if (v === false || v == null) continue;
        el.setAttribute(name, v === true ? '' : String(v));
      } else {
        el.setAttribute(name, interp(val, ctx));
      }
    }
    var src = tag === 'template' ? node.content.childNodes : node.childNodes;
    renderChildren(src, ctx, el);
    parent.appendChild(el);
  }

  var comp, tpl, root, pending = false, first = true;
  function render() {
    pending = false;
    var vals = comp.renderVals() || {};
    var frag = document.createDocumentFragment();
    renderChildren(tpl.content.childNodes, vals, frag);
    root.replaceChildren(frag);
    if (first) { first = false; document.documentElement.classList.add('dc-ready'); }
  }
  function schedule() { if (!pending) { pending = true; requestAnimationFrame(render); } }

  window.dcMount = function (Component) {
    tpl = document.getElementById('dc-tpl');
    root = document.getElementById('dc-root');
    comp = new Component({});
    if (comp.componentDidMount) setTimeout(function () { comp.componentDidMount(); }, 0);
    render();
  };
})();
