import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, deleteDoc, collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

var firebaseConfig = {
  apiKey: "AIzaSyCUaNX2ss31KorRt5Qe7GakhONob4ABbS0",
  authDomain: "dashboard-6d43e.firebaseapp.com",
  projectId: "dashboard-6d43e",
  storageBucket: "dashboard-6d43e.firebasestorage.app",
  messagingSenderId: "1049231463247",
  appId: "1:1049231463247:web:ce3b851c89bff01cfa6b3a",
  measurementId: "G-8TK54JJ7XE"
};

var app = initializeApp(firebaseConfig);
var auth = getAuth(app);
var db = getFirestore(app);
var provider = new GoogleAuthProvider();

var currentUser = null;
var resolveCloudReady;
window.CloudReady = new Promise(function (resolve) { resolveCloudReady = resolve; });

var LOCAL_KEY_PREFIXES = ['notes:', 'attachments:', 'checklist:', 'linklist:'];
var LOCAL_EXACT_KEYS = ['custom-topics'];

function isSyncedKey(key) {
  if (LOCAL_EXACT_KEYS.indexOf(key) !== -1) return true;
  for (var i = 0; i < LOCAL_KEY_PREFIXES.length; i++) {
    if (key.indexOf(LOCAL_KEY_PREFIXES[i]) === 0) return true;
  }
  return false;
}

function dataDoc(key) {
  return doc(db, 'users', currentUser.uid, 'data', key);
}

function pushKeyToCloud(key, value) {
  if (!currentUser) return;
  setDoc(dataDoc(key), { value: value, updatedAt: Date.now() }).catch(function (e) {
    console.warn('Cloud-Sync fehlgeschlagen für', key, e);
  });
}

function removeKeyFromCloud(key) {
  if (!currentUser) return;
  deleteDoc(dataDoc(key)).catch(function () {});
}

var originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function (key, value) {
  originalSetItem(key, value);
  if (isSyncedKey(key)) pushKeyToCloud(key, value);
};

var originalRemoveItem = localStorage.removeItem.bind(localStorage);
localStorage.removeItem = function (key) {
  originalRemoveItem(key);
  if (isSyncedKey(key)) removeKeyFromCloud(key);
};

function pullAllFromCloud() {
  return getDocs(collection(db, 'users', currentUser.uid, 'data')).then(function (snap) {
    snap.forEach(function (docSnap) {
      var data = docSnap.data();
      if (data && typeof data.value === 'string') {
        originalSetItem(docSnap.id, data.value);
      }
    });
  });
}

function renderAuthUI(user) {
  var slot = document.querySelector('.auth-slot');
  if (!slot) return;
  slot.innerHTML = '';

  if (user) {
    var info = document.createElement('span');
    info.className = 'auth-status';
    info.textContent = '🔄 ' + (user.displayName || user.email || 'Angemeldet');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'auth-button';
    btn.textContent = 'Abmelden';
    btn.addEventListener('click', function () { signOut(auth); });

    slot.appendChild(info);
    slot.appendChild(btn);
  } else {
    var signInBtn = document.createElement('button');
    signInBtn.type = 'button';
    signInBtn.className = 'auth-button';
    signInBtn.textContent = 'Mit Google synchronisieren';
    signInBtn.addEventListener('click', function () {
      signInWithPopup(auth, provider).catch(function (err) {
        console.error(err);
        window.alert('Anmeldung fehlgeschlagen: ' + err.message);
      });
    });
    slot.appendChild(signInBtn);
  }
}

var readyResolved = false;

onAuthStateChanged(auth, function (user) {
  currentUser = user;
  renderAuthUI(user);

  var afterPull = user ? pullAllFromCloud().catch(function (e) {
    console.warn('Cloud-Daten konnten nicht geladen werden', e);
  }) : Promise.resolve();

  afterPull.then(function () {
    if (!readyResolved) {
      readyResolved = true;
      resolveCloudReady();
    }
  });
});
