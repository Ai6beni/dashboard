(function () {
  var section = document.querySelector('.notebook');
  if (!section) return;

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
      var row = document.createElement('div');
      row.className = 'attachment-item';

      var link = document.createElement('a');
      link.textContent = (item.type === 'file' ? '📎 ' : '🔗 ') + item.title;
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      if (item.type === 'file') {
        link.download = item.name || item.title;
      }

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'attachment-remove';
      remove.textContent = 'Entfernen';
      remove.addEventListener('click', function () {
        var current = loadAttachments();
        current.splice(idx, 1);
        saveAttachments(current);
        renderAttachments();
      });

      row.appendChild(link);
      row.appendChild(remove);
      list.appendChild(row);
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
})();
