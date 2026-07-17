function initNotebook() {
  var section = document.querySelector('.notebook');
  if (!section || section.dataset.notebookReady) return;
  section.dataset.notebookReady = '1';

  var slug = section.dataset.slug;
  var notesKey = 'notes:' + slug;
  var attachKey = 'attachments:' + slug;
  var MAX_BYTES = 3 * 1024 * 1024;

  // --- Notizen ---
  var textarea = section.querySelector('.notes-editor');
  var status = section.querySelector('.notes-status');
  var saveTimer = null;

  textarea.value = localStorage.getItem(notesKey) || '';

  function formatTime() {
    return new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  if (textarea.value) {
    status.textContent = 'Gespeichert ' + formatTime();
  }

  textarea.addEventListener('input', function () {
    status.textContent = 'Speichere…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      localStorage.setItem(notesKey, textarea.value);
      status.textContent = 'Gespeichert ' + formatTime();
    }, 500);
  });

  section.querySelector('.notes-export').addEventListener('click', function () {
    var blob = new Blob([textarea.value], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = slug + '-notizen.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // --- Dokumente ---
  var list = section.querySelector('.attachment-list');

  function loadAttachments() {
    try {
      return JSON.parse(localStorage.getItem(attachKey) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveAttachments(items) {
    localStorage.setItem(attachKey, JSON.stringify(items));
  }

  var ICONS = { link: '🔗', pdf: '📕', image: '🖼️', doc: '📄', sheet: '📊', file: '📎' };
  var LABELS = { link: 'Link', pdf: 'PDF', image: 'Bild', doc: 'Dokument', sheet: 'Tabelle', file: 'Datei' };

  function getKind(item) {
    if (item.type === 'link') return 'link';
    var name = (item.name || item.title || '').toLowerCase();
    if (name.endsWith('.pdf')) return 'pdf';
    if (/\.(png|jpe?g|gif|webp|svg)$/.test(name)) return 'image';
    if (/\.(docx?|rtf|odt)$/.test(name)) return 'doc';
    if (/\.(xlsx?|csv)$/.test(name)) return 'sheet';
    return 'file';
  }

  function renderAttachments() {
    var items = loadAttachments();
    list.innerHTML = '';

    if (items.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'attachment-empty';
      empty.textContent = 'Noch keine Dokumente angeheftet.';
      list.appendChild(empty);
      return;
    }

    items.forEach(function (item, idx) {
      var kind = getKind(item);

      var card = document.createElement('div');
      card.className = 'attachment-item';
      card.dataset.kind = kind;

      var icon = document.createElement('div');
      icon.className = 'attachment-icon';
      icon.textContent = ICONS[kind] || '📎';

      var body = document.createElement('div');
      body.className = 'attachment-body';

      var link = document.createElement('a');
      link.className = 'attachment-title';
      link.textContent = item.title;
      link.title = item.title;
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      if (item.type === 'file') {
        link.download = item.name || item.title;
      }

      var kindLabel = document.createElement('span');
      kindLabel.className = 'attachment-kind';
      kindLabel.textContent = LABELS[kind] || 'Datei';

      body.appendChild(link);
      body.appendChild(kindLabel);

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'attachment-remove';
      remove.title = 'Entfernen';
      remove.textContent = '×';
      remove.addEventListener('click', function () {
        var current = loadAttachments();
        current.splice(idx, 1);
        saveAttachments(current);
        renderAttachments();
      });

      card.appendChild(remove);
      card.appendChild(icon);
      card.appendChild(body);
      list.appendChild(card);
    });
  }

  renderAttachments();

  var linkForm = section.querySelector('.attach-link-form');
  linkForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var title = linkForm.querySelector('.attach-link-title').value.trim();
    var url = linkForm.querySelector('.attach-link-url').value.trim();
    if (!title || !url) return;
    var items = loadAttachments();
    items.push({ type: 'link', title: title, url: url });
    saveAttachments(items);
    linkForm.reset();
    renderAttachments();
  });

  var fileInput = section.querySelector('.attach-file-input');
  var fileStatus = section.querySelector('.attach-file-status');
  fileInput.addEventListener('change', function () {
    var file = fileInput.files[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      fileStatus.textContent = 'Datei zu groß (max. 3 MB). Nutze stattdessen einen Link.';
      fileInput.value = '';
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var items = loadAttachments();
      items.push({ type: 'file', title: file.name, name: file.name, url: reader.result });
      saveAttachments(items);
      fileInput.value = '';
      fileStatus.textContent = '';
      renderAttachments();
    };
    reader.onerror = function () {
      fileStatus.textContent = 'Datei konnte nicht gelesen werden.';
    };
    reader.readAsDataURL(file);
  });
}

window.initNotebook = initNotebook;
(window.CloudReady || Promise.resolve()).then(initNotebook);
