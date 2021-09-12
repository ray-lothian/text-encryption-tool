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
    const name = prompt('Enter a unique name for this record');
    if (name) {
      chrome.storage.sync.set({
        ['record.' + name]: data
      });
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
  document.getElementById('data').value = e.target.selectedOptions[0].value;
};
