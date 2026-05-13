// Pair Capture UI — plain JS, no frameworks, no imports.

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function setFeedback(elId, message, isError) {
  var el = document.getElementById(elId);
  el.textContent = message;
  el.className = 'feedback ' + (isError ? 'error' : 'success');
}

function clearFeedback(elId) {
  var el = document.getElementById(elId);
  el.textContent = '';
  el.className = 'feedback';
}

function setButtonLoading(btn, originalLabel) {
  btn.disabled = true;
  btn.textContent = 'Bezig...';
  return function restore() {
    btn.disabled = false;
    btn.textContent = originalLabel;
  };
}

// ---------------------------------------------------------------------------
// Progress display
// ---------------------------------------------------------------------------

var CATEGORY_LABELS = {
  top: 'Tops',
  broek_of_rok: 'Broek/rok',
  schoenen: 'Schoenen',
  jas: 'Jassen'
};

function updateProgress(state) {
  var counts = { top: 0, broek_of_rok: 0, schoenen: 0, jas: 0 };
  for (var i = 0; i < state.items.length; i++) {
    var cat = state.items[i].category;
    if (counts[cat] !== undefined) counts[cat]++;
  }

  var styleRefCount = state.user.styleReferences.length;

  var parts = Object.keys(counts).map(function(cat) {
    var label = CATEGORY_LABELS[cat];
    var count = counts[cat];
    if (count === 0) {
      return '<span class="missing">' + label + ': 0</span>';
    }
    return label + ': ' + count;
  });

  var text = parts.join(', ') + ' — Style refs: ' + styleRefCount + '/5';
  document.getElementById('progress-text').innerHTML = text;

  // Update style-ref counter
  document.getElementById('stijlref-counter').textContent =
    styleRefCount + ' / 5 toegevoegd';

  // Show existing proportions as hint
  var hintEl = document.getElementById('proportions-hint');
  var currentText = state.user.proportionsText;
  if (currentText && currentText.trim() !== '') {
    hintEl.textContent = 'Huidige tekst: ' + currentText;
    hintEl.hidden = false;
  } else {
    hintEl.hidden = true;
  }
}

// ---------------------------------------------------------------------------
// Fetch state
// ---------------------------------------------------------------------------

function fetchState() {
  return fetch('/api/state')
    .then(function(res) {
      if (!res.ok) throw new Error('State ophalen mislukt (' + res.status + ')');
      return res.json();
    })
    .then(function(state) {
      updateProgress(state);
      return state;
    })
    .catch(function(err) {
      document.getElementById('progress-text').textContent =
        'Status niet beschikbaar: ' + err.message;
    });
}

// ---------------------------------------------------------------------------
// Extract error message from response
// ---------------------------------------------------------------------------

function extractError(res) {
  return res.json()
    .then(function(body) {
      return body.error || 'Onbekende fout (status ' + res.status + ')';
    })
    .catch(function() {
      return 'Onbekende fout (status ' + res.status + ')';
    });
}

// ---------------------------------------------------------------------------
// Section 1 — Proportions
// ---------------------------------------------------------------------------

function initProportions() {
  var form = document.getElementById('form-proportions');
  var btn = document.getElementById('btn-proportions');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    clearFeedback('feedback-proportions');

    var text = document.getElementById('proportionsText').value.trim();
    if (!text) {
      setFeedback('feedback-proportions', 'Vul een tekst in.', true);
      return;
    }

    var restore = setButtonLoading(btn, 'Opslaan');

    fetch('/api/proportions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    })
      .then(function(res) {
        if (!res.ok) return extractError(res).then(function(msg) { throw new Error(msg); });
        return res.json();
      })
      .then(function(data) {
        setFeedback('feedback-proportions', 'Opgeslagen.', false);
        updateProgress(data.state);
      })
      .catch(function(err) {
        setFeedback('feedback-proportions', 'Fout: ' + err.message, true);
      })
      .finally(function() {
        restore();
      });
  });
}

// ---------------------------------------------------------------------------
// Section 2 — Style refs
// ---------------------------------------------------------------------------

function initStijlRefs() {
  var form = document.getElementById('form-stijlref');
  var btn = document.getElementById('btn-stijlref');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    clearFeedback('feedback-stijlref');

    var fileInput = document.getElementById('stijlref-photo');
    if (!fileInput.files || fileInput.files.length === 0) {
      setFeedback('feedback-stijlref', 'Kies een foto.', true);
      return;
    }

    var formData = new FormData();
    formData.append('photo', fileInput.files[0]);

    var restore = setButtonLoading(btn, 'Toevoegen');

    fetch('/api/style-refs', {
      method: 'POST',
      body: formData
    })
      .then(function(res) {
        if (!res.ok) return extractError(res).then(function(msg) { throw new Error(msg); });
        return res.json();
      })
      .then(function(data) {
        var count = data.state.user.styleReferences.length;
        setFeedback('feedback-stijlref', 'Stijlreferentie ' + count + ' toegevoegd.', false);
        form.reset();
        updateProgress(data.state);
      })
      .catch(function(err) {
        setFeedback('feedback-stijlref', 'Fout: ' + err.message, true);
      })
      .finally(function() {
        restore();
      });
  });
}

// ---------------------------------------------------------------------------
// Section 3 — Items
// ---------------------------------------------------------------------------

function initItems() {
  var form = document.getElementById('form-item');
  var btn = document.getElementById('btn-item');
  var categorySelect = document.getElementById('item-category');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    clearFeedback('feedback-item');

    var category = document.getElementById('item-category').value;
    var colors = document.getElementById('item-colors').value.trim();
    var occasion = document.getElementById('item-occasion').value;
    var fileInput = document.getElementById('item-photo');

    if (!colors) {
      setFeedback('feedback-item', 'Vul de kleur(en) in.', true);
      return;
    }
    if (!fileInput.files || fileInput.files.length === 0) {
      setFeedback('feedback-item', 'Kies een foto.', true);
      return;
    }

    var formData = new FormData();
    formData.append('category', category);
    formData.append('colors', colors);
    formData.append('occasion', occasion);
    formData.append('photo', fileInput.files[0]);

    var restore = setButtonLoading(btn, 'Item toevoegen');

    fetch('/api/items', {
      method: 'POST',
      body: formData
    })
      .then(function(res) {
        if (!res.ok) return extractError(res).then(function(msg) { throw new Error(msg); });
        return res.json();
      })
      .then(function(data) {
        var item = data.item;
        setFeedback('feedback-item', item.id + ' toegevoegd.', false);
        form.reset();
        categorySelect.focus();
        updateProgress(data.state);
      })
      .catch(function(err) {
        setFeedback('feedback-item', 'Fout: ' + err.message, true);
      })
      .finally(function() {
        restore();
      });
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', function() {
  fetchState();
  initProportions();
  initStijlRefs();
  initItems();
});
