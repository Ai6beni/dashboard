(function () {
  var mount = document.getElementById('dynamic-topic');
  if (!mount) return;

  var params = new URLSearchParams(window.location.search);
  var slug = params.get('slug');
  var topics = TopicsStore.loadCustomTopics();
  var topic = topics.filter(function (t) { return t.slug === slug; })[0];

  if (!topic) {
    mount.innerHTML = '';
    var missing = document.createElement('article');
    missing.className = 'topic-page';
    missing.innerHTML =
      '<h1>Thema nicht gefunden</h1>' +
      '<p>Dieses Thema existiert nicht oder wurde in einem anderen Browser angelegt – ' +
      'selbst hinzugefügte Themen sind nur in dem Browser sichtbar, in dem du sie erstellt hast.</p>' +
      '<p><a href="index.html">← Zurück zur Übersicht</a></p>';
    mount.appendChild(missing);
    return;
  }

  document.title = topic.title;

  var article = document.createElement('article');
  article.className = 'topic-page';

  var h1 = document.createElement('h1');
  h1.textContent = (topic.emoji || '📄') + ' ' + topic.title;
  article.appendChild(h1);

  if (topic.summary) {
    var summary = document.createElement('p');
    summary.textContent = topic.summary;
    article.appendChild(summary);
  }

  var badge = document.createElement('p');
  badge.className = 'notebook-hint';
  badge.textContent = 'Selbst angelegtes Thema — nur in diesem Browser sichtbar.';
  article.appendChild(badge);

  var deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'topic-delete';
  deleteBtn.textContent = 'Thema entfernen';
  deleteBtn.addEventListener('click', function () {
    if (!window.confirm('Thema „' + topic.title + '“ inklusive Notizen, Dokumenten und Listen wirklich entfernen?')) return;
    var remaining = topics.filter(function (t) { return t.slug !== slug; });
    TopicsStore.saveCustomTopics(remaining);
    localStorage.removeItem('notes:' + slug);
    localStorage.removeItem('attachments:' + slug);
    localStorage.removeItem('checklist:' + slug);
    localStorage.removeItem('linklist:' + slug);
    window.location.href = 'index.html';
  });
  article.appendChild(deleteBtn);

  var notebookSection = document.createElement('section');
  notebookSection.className = 'notebook';
  notebookSection.dataset.slug = slug;
  notebookSection.innerHTML =
    '<h2 class="notebook-heading">📝 Meine Notizen</h2>' +
    '<p class="notebook-hint">Wird automatisch in diesem Browser gespeichert.</p>' +
    '<div class="notes-paper"><textarea class="notes-editor" rows="8" placeholder="Deine eigenen Notizen zu diesem Thema..."></textarea></div>' +
    '<div class="notes-toolbar">' +
    '<span class="notes-status"></span>' +
    '<button type="button" class="notes-export">Als Markdown exportieren</button>' +
    '</div>' +
    '<button type="button" class="topic-export">Thema dauerhaft machen (.md exportieren)</button>' +

    '<h2 class="notebook-heading">📎 Meine Dokumente</h2>' +
    '<p class="notebook-hint">Links zu eigenen Dateien anheften oder kleine Dateien (max. 3 MB) direkt einbetten.</p>' +
    '<form class="attach-link-form">' +
    '<input type="text" class="attach-link-title" placeholder="Titel" required>' +
    '<input type="url" class="attach-link-url" placeholder="https://..." required>' +
    '<button type="submit">Link anheften</button>' +
    '</form>' +
    '<div class="attach-file-row">' +
    '<label class="attach-file-label">Datei einbetten (max. 3 MB)' +
    '<input type="file" class="attach-file-input">' +
    '</label>' +
    '<span class="attach-file-status"></span>' +
    '</div>' +
    '<div class="attachment-list"></div>' +

    '<div class="widgets-mount"></div>' +
    '<div class="widget-toggles"></div>';

  mount.innerHTML = '';
  mount.appendChild(article);
  mount.appendChild(notebookSection);

  if (window.initNotebook) window.initNotebook();

  notebookSection.querySelector('.topic-export').addEventListener('click', function () {
    var notes = notebookSection.querySelector('.notes-editor').value;
    var frontmatter =
      '---\n' +
      'title: ' + topic.title + '\n' +
      'emoji: ' + (topic.emoji || '📄') + '\n' +
      'summary: ' + (topic.summary || '') + '\n' +
      '---\n\n' + notes + '\n';
    var blob = new Blob([frontmatter], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = slug + '.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // --- Zusatzmodule: Checkliste & Linkliste (nur für selbst angelegte Themen) ---
  var widgetsMount = notebookSection.querySelector('.widgets-mount');
  var togglesBar = notebookSection.querySelector('.widget-toggles');

  var WIDGET_DEFS = {
    checklist: { icon: '✅', label: 'Checkliste', addLabel: '+ Checkliste hinzufügen' },
    linklist: { icon: '🚗', label: 'Linkliste mit Icons', addLabel: '+ Linkliste mit Icons hinzufügen' }
  };

  function persistTopicWidgets(widgets) {
    topic.widgets = widgets;
    var all = TopicsStore.loadCustomTopics();
    var idx = all.findIndex(function (t) { return t.slug === slug; });
    if (idx !== -1) {
      all[idx] = topic;
      TopicsStore.saveCustomTopics(all);
    }
  }

  function renderToggles() {
    var widgets = topic.widgets || [];
    togglesBar.innerHTML = '';
    Object.keys(WIDGET_DEFS).forEach(function (key) {
      if (widgets.indexOf(key) !== -1) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'add-widget';
      btn.textContent = WIDGET_DEFS[key].addLabel;
      btn.addEventListener('click', function () {
        var updated = (topic.widgets || []).concat([key]);
        persistTopicWidgets(updated);
        renderWidgets();
      });
      togglesBar.appendChild(btn);
    });
  }

  function renderWidgets() {
    widgetsMount.innerHTML = '';
    var widgets = topic.widgets || [];
    if (widgets.indexOf('checklist') !== -1) {
      widgetsMount.appendChild(buildChecklistSection());
    }
    if (widgets.indexOf('linklist') !== -1) {
      widgetsMount.appendChild(buildLinklistSection());
    }
    renderToggles();
  }

  // --- Checkliste ---
  function buildChecklistSection() {
    var section = document.createElement('div');
    section.className = 'widget-section';

    var heading = document.createElement('h2');
    heading.className = 'notebook-heading';
    heading.textContent = '✅ Checkliste';
    section.appendChild(heading);

    var form = document.createElement('form');
    form.className = 'checklist-form';
    form.innerHTML =
      '<input type="text" class="checklist-input" placeholder="Neuer Eintrag..." required>' +
      '<button type="submit">Hinzufügen</button>';
    section.appendChild(form);

    var itemsBox = document.createElement('div');
    itemsBox.className = 'checklist-items';
    section.appendChild(itemsBox);

    var key = 'checklist:' + slug;

    function load() {
      try { return JSON.parse(localStorage.getItem(key) || '[]'); }
      catch (e) { return []; }
    }
    function save(items) { localStorage.setItem(key, JSON.stringify(items)); }

    function render() {
      var items = load();
      itemsBox.innerHTML = '';
      if (items.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'attachment-empty';
        empty.textContent = 'Noch keine Einträge.';
        itemsBox.appendChild(empty);
        return;
      }
      items.forEach(function (item, idx) {
        var row = document.createElement('label');
        row.className = 'checklist-item' + (item.done ? ' done' : '');

        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !!item.done;
        checkbox.addEventListener('change', function () {
          var current = load();
          current[idx].done = checkbox.checked;
          save(current);
          render();
        });

        var text = document.createElement('span');
        text.className = 'checklist-text';
        text.textContent = item.text;

        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'checklist-remove';
        remove.title = 'Entfernen';
        remove.textContent = '×';
        remove.addEventListener('click', function (e) {
          e.preventDefault();
          var current = load();
          current.splice(idx, 1);
          save(current);
          render();
        });

        row.appendChild(checkbox);
        row.appendChild(text);
        row.appendChild(remove);
        itemsBox.appendChild(row);
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('.checklist-input');
      var text = input.value.trim();
      if (!text) return;
      var items = load();
      items.push({ text: text, done: false });
      save(items);
      form.reset();
      render();
    });

    render();
    return section;
  }

  // --- Linkliste mit automatischem Website-Icon ---
  function faviconFor(url) {
    try {
      var host = new URL(url).hostname;
      return 'https://www.google.com/s2/favicons?sz=64&domain=' + encodeURIComponent(host);
    } catch (e) {
      return '';
    }
  }

  function buildLinklistSection() {
    var section = document.createElement('div');
    section.className = 'widget-section';

    var heading = document.createElement('h2');
    heading.className = 'notebook-heading';
    heading.textContent = '🚗 Linkliste';
    section.appendChild(heading);

    var hint = document.createElement('p');
    hint.className = 'notebook-hint';
    hint.textContent = 'Titel + Link hinzufügen. Das Website-Icon wird automatisch erkannt. Optional: direkte Bild-URL für ein echtes Produktfoto.';
    section.appendChild(hint);

    var form = document.createElement('form');
    form.className = 'linklist-form';
    form.innerHTML =
      '<input type="text" class="linklist-title" placeholder="Titel (z.B. Porsche 911 GT3 RS)" required>' +
      '<input type="url" class="linklist-url" placeholder="https://..." required>' +
      '<input type="url" class="linklist-image" placeholder="Bild-URL (optional)">' +
      '<button type="submit">Hinzufügen</button>';
    section.appendChild(form);

    var itemsBox = document.createElement('div');
    itemsBox.className = 'linklist-items';
    section.appendChild(itemsBox);

    var key = 'linklist:' + slug;

    function load() {
      try { return JSON.parse(localStorage.getItem(key) || '[]'); }
      catch (e) { return []; }
    }
    function save(items) { localStorage.setItem(key, JSON.stringify(items)); }

    function render() {
      var items = load();
      itemsBox.innerHTML = '';
      if (items.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'attachment-empty';
        empty.textContent = 'Noch keine Links hinzugefügt.';
        itemsBox.appendChild(empty);
        return;
      }
      items.forEach(function (item, idx) {
        var card = document.createElement('div');
        card.className = 'linklist-item';

        var thumb = document.createElement('img');
        thumb.className = 'linklist-thumb';
        thumb.alt = '';
        thumb.src = item.image || faviconFor(item.url);
        if (!item.image) thumb.classList.add('is-favicon');

        var body = document.createElement('div');
        body.className = 'attachment-body';

        var link = document.createElement('a');
        link.className = 'attachment-title';
        link.textContent = item.title;
        link.title = item.title;
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        body.appendChild(link);

        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'attachment-remove';
        remove.title = 'Entfernen';
        remove.textContent = '×';
        remove.addEventListener('click', function () {
          var current = load();
          current.splice(idx, 1);
          save(current);
          render();
        });

        card.appendChild(remove);
        card.appendChild(thumb);
        card.appendChild(body);
        itemsBox.appendChild(card);
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var title = form.querySelector('.linklist-title').value.trim();
      var url = form.querySelector('.linklist-url').value.trim();
      var image = form.querySelector('.linklist-image').value.trim();
      if (!title || !url) return;
      var items = load();
      items.push({ title: title, url: url, image: image || null });
      save(items);
      form.reset();
      render();
    });

    render();
    return section;
  }

  renderWidgets();
})();
