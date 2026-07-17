var TopicsStore = (function () {
  var CUSTOM_KEY = 'custom-topics';

  function loadCustomTopics() {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveCustomTopics(items) {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(items));
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'thema';
  }

  function uniqueSlug(base, existingSlugs) {
    var slug = base;
    var n = 2;
    while (existingSlugs.indexOf(slug) !== -1) {
      slug = base + '-' + n;
      n++;
    }
    return slug;
  }

  return {
    loadCustomTopics: loadCustomTopics,
    saveCustomTopics: saveCustomTopics,
    slugify: slugify,
    uniqueSlug: uniqueSlug
  };
})();

window.TopicsStore = TopicsStore;

(window.CloudReady || Promise.resolve()).then(function () {
  var customTopics = TopicsStore.loadCustomTopics();

  // Eigene Themen im Menü oben auf jeder Seite ergaenzen
  var nav = document.querySelector('.topnav');
  if (nav) {
    var params = new URLSearchParams(window.location.search);
    var currentSlug = params.get('slug');
    customTopics.forEach(function (t) {
      var a = document.createElement('a');
      a.href = 'topic.html?slug=' + encodeURIComponent(t.slug);
      a.textContent = (t.emoji || '📄') + ' ' + t.title;
      if (window.location.pathname.indexOf('topic.html') !== -1 && currentSlug === t.slug) {
        a.className = 'active';
      }
      nav.appendChild(a);
    });
  }

  // Startseite: eigene Themen als Kacheln + "Neues Thema"-Formular
  var grid = document.querySelector('.card-grid');
  if (!grid) return;

  var addCard = grid.querySelector('.card-add');

  customTopics.forEach(function (t) {
    var card = document.createElement('a');
    card.className = 'card';
    card.href = 'topic.html?slug=' + encodeURIComponent(t.slug);

    var emoji = document.createElement('div');
    emoji.className = 'card-emoji';
    emoji.textContent = t.emoji || '📄';

    var h2 = document.createElement('h2');
    h2.textContent = t.title;

    var p = document.createElement('p');
    p.textContent = t.summary || '';

    card.appendChild(emoji);
    card.appendChild(h2);
    card.appendChild(p);

    if (addCard) {
      grid.insertBefore(card, addCard);
    } else {
      grid.appendChild(card);
    }
  });

  var addBtn = document.querySelector('.add-topic-button');
  var form = document.querySelector('.add-topic-form');
  if (!addBtn || !form) return;

  addBtn.addEventListener('click', function () {
    form.classList.toggle('open');
    if (form.classList.contains('open')) {
      form.querySelector('.add-topic-title').focus();
    }
  });

  // --- Emoji-Picker ---
  var EMOJIS = [
    '📚', '🧠', '💬', '🛒', '🚗', '⏱️', '🎯', '💡', '🔥', '⭐', '🎓', '📝',
    '📌', '🗂️', '📈', '💰', '🏋️', '🧘', '🍳', '✈️', '🎨', '🎵', '🎮', '📷',
    '🏠', '🌱', '❤️', '🧩', '🔧', '📅', '🧭', '🌍', '🚀', '⚡', '🏆', '📖',
    '🖊️', '🍎', '☕', '🛠️', '🔍', '🧳', '🎬', '🐍', '🎉', '🌙', '☀️', '🍀'
  ];

  var emojiToggle = form.querySelector('.emoji-picker-toggle');
  var emojiPopup = form.querySelector('.emoji-picker-popup');
  var emojiInput = form.querySelector('.add-topic-emoji');

  if (emojiToggle && emojiPopup && emojiInput) {
    if (!emojiPopup.childElementCount) {
      EMOJIS.forEach(function (e) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = e;
        btn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          emojiInput.value = e;
          emojiPopup.classList.remove('open');
        });
        emojiPopup.appendChild(btn);
      });
    }

    emojiToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      emojiPopup.classList.toggle('open');
    });

    document.addEventListener('click', function (e) {
      if (!emojiPopup.contains(e.target) && e.target !== emojiToggle) {
        emojiPopup.classList.remove('open');
      }
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var title = form.querySelector('.add-topic-title').value.trim();
    var emoji = form.querySelector('.add-topic-emoji').value.trim() || '📄';
    var summary = form.querySelector('.add-topic-summary').value.trim();
    if (!title) return;

    var staticSlugs = window.STATIC_SLUGS || [];
    var existing = TopicsStore.loadCustomTopics();
    var existingSlugs = staticSlugs.concat(existing.map(function (t) { return t.slug; }));
    var slug = TopicsStore.uniqueSlug(TopicsStore.slugify(title), existingSlugs);

    existing.push({ slug: slug, title: title, emoji: emoji, summary: summary, createdAt: Date.now() });
    TopicsStore.saveCustomTopics(existing);
    window.location.href = 'topic.html?slug=' + encodeURIComponent(slug);
  });
})();
