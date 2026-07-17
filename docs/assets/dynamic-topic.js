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
    if (!window.confirm('Thema „' + topic.title + '“ inklusive Notizen und Dokumenten wirklich entfernen?')) return;
    var remaining = topics.filter(function (t) { return t.slug !== slug; });
    TopicsStore.saveCustomTopics(remaining);
    localStorage.removeItem('notes:' + slug);
    localStorage.removeItem('attachments:' + slug);
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
    '<div class="attachment-list"></div>';

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
})();
