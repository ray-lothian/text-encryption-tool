/* globals safe */
'use strict';

const args = new URLSearchParams(location.search);

document.getElementById('encrypt').addEventListener('click', () => {
  document.forms[0].dataset.action = 'encrypt';
});
document.getElementById('decrypt').addEventListener('click', () => {
  document.forms[0].dataset.action = 'decrypt';
});

document.addEventListener('submit', e => {
  e.preventDefault();
  const data = document.getElementById('data').value;
  const passphrase = document.getElementById('passphrase').value;
  const result = document.getElementById('result');

  if (safe[e.target.dataset.action]) {
    safe[e.target.dataset.action](data, passphrase).then(s => result.value = s)
      .catch(e => result.value = e.message || 'Operation was unsuccessful');
  }
});

document.getElementById('store').addEventListener('click', () => {
  const data = document.getElementById('result').value;
  if (data.startsWith('data:application/octet-binary;base64,')) {
    const index = document.getElementById('records').selectedIndex;
    const v = index === -1 || index === 0 ? '' : document.getElementById('records').selectedOptions[0].textContent;

    const name = prompt(`Enter a unique name for this record:

>>> The old data will be removed if the name already exists <<<`, v);
    if (name) {
      chrome.storage.sync.set({
        ['record.' + name]: data
      });

      document.getElementById('remove').disabled = false;

      // do we already have this name
      for (const option of document.getElementById('records').options) {
        if (option.textContent === name) {
          option.value = data;
          option.selected = true;

          return;
        }
      }

      const option = document.createElement('option');
      option.value = data;
      option.textContent = name;
      document.getElementById('records').appendChild(option);
      document.getElementById('records').disabled = false;
      option.selected = true;
    }
  }
  else {
    alert('You can only store encrypted data. Use "Encrypt" button to generate one');
  }
});

if (args.has('content')) {
  document.getElementById('data').value = args.get('content');
}


chrome.storage.sync.get(null, prefs => {
  const keys = Object.keys(prefs).filter(s => s.startsWith('record.'));
  keys.sort();

  for (const key of keys) {
    const option = document.createElement('option');
    option.value = prefs[key];
    option.textContent = key.replace('record.', '');
    document.getElementById('records').appendChild(option);
  }
  if (keys.length === 0) {
    document.getElementById('records').disabled = true;
  }
  document.getElementById('rd').disabled = true;
});

document.getElementById('records').onchange = e => {
  const index = e.target.selectedIndex;
  const n = index === 0 || index === -1;

  document.getElementById('data').value = n ? '' : document.getElementById('records').selectedOptions[0].value;
  document.getElementById('result').value = '';
  document.getElementById('remove').disabled = n;
};

document.getElementById('remove').onclick = () => {
  if (confirm('Are you sure?')) {
    const [option] = document.getElementById('records').selectedOptions;
    const v = option.textContent;

    chrome.storage.sync.remove('record.' + v);
    chrome.contextMenus.remove('record.' + v);

    document.getElementById('records').selectedIndex -= 1;
    option.remove();
    document.getElementById('records').dispatchEvent(new Event('change'));
  }
};

document.getElementById('swap').onclick = () => {
  const v1 = document.getElementById('data').value;
  const v2 = document.getElementById('result').value;

  document.getElementById('data').value = v2;
  document.getElementById('result').value = v1;
};

document.getElementById('data').oninput = () => {
  document.getElementById('result').value = '';
};
