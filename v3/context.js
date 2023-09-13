// Context Menu
{
  const callback = () => {
    chrome.contextMenus.create({
      id: 'open-safe',
      title: 'Open in Encryption Tool',
      contexts: ['selection'],
      documentUrlPatterns: ['*://*/*']
    });
    chrome.contextMenus.create({
      id: 's1',
      contexts: ['selection'],
      documentUrlPatterns: ['*://*/*'],
      type: 'separator'
    });
    chrome.contextMenus.create({
      id: 'encrypt-store',
      title: 'Encrypt (store)',
      contexts: ['selection'],
      documentUrlPatterns: ['*://*/*']
    });
    chrome.contextMenus.create({
      id: 'encrypt-clipboard',
      title: 'Encrypt (clipboard)',
      contexts: ['selection'],
      documentUrlPatterns: ['*://*/*']
    });
    chrome.contextMenus.create({
      id: 'encrypt-replace',
      title: 'Encrypt (replace)',
      contexts: ['selection'],
      documentUrlPatterns: ['*://*/*']
    });
    chrome.contextMenus.create({
      id: 's2',
      contexts: ['selection'],
      documentUrlPatterns: ['*://*/*'],
      type: 'separator'
    });
    chrome.contextMenus.create({
      id: 'decrypt-clipboard',
      title: 'Decrypt (clipboard)',
      contexts: ['selection'],
      documentUrlPatterns: ['*://*/*']
    });
    chrome.contextMenus.create({
      id: 'decrypt-replace',
      title: 'Decrypt (replace)',
      contexts: ['selection'],
      documentUrlPatterns: ['*://*/*']
    });
    chrome.contextMenus.create({
      id: 's3',
      contexts: ['selection'],
      documentUrlPatterns: ['*://*/*'],
      type: 'separator'
    });
    chrome.contextMenus.create({
      id: 'safe',
      title: 'Safe Storage',
      contexts: ['selection', 'page', 'editable'],
      documentUrlPatterns: ['*://*/*']
    });
    chrome.contextMenus.create({
      id: 'remove',
      title: 'Remove from Storage',
      contexts: ['selection', 'page', 'editable'],
      documentUrlPatterns: ['*://*/*']
    });
    records();

    chrome.contextMenus.create({
      id: 'text-editor',
      title: 'Open Text Editor',
      contexts: ['action']
    });
    chrome.contextMenus.create({
      id: 'file-encryptor',
      title: 'Open File Encryptor',
      contexts: ['action']
    });
    chrome.contextMenus.create({
      id: 'options',
      title: 'Options',
      contexts: ['action']
    });

    chrome.storage.local.get({
      'rate': true,
      'try-to-paste': true
    }, prefs => {
      if (prefs.rate) {
        chrome.contextMenus.create({
          id: 's4',
          contexts: ['selection', 'page'],
          documentUrlPatterns: ['*://*/*'],
          type: 'separator'
        });
        chrome.contextMenus.create({
          id: 'rate',
          title: 'Rate Me',
          contexts: ['selection', 'page'],
          documentUrlPatterns: ['*://*/*']
        });
      }
      chrome.contextMenus.create({
        id: 'try-to-paste',
        title: 'Try to Paste Decrypted Text to Editable',
        contexts: ['action'],
        parentId: 'options',
        checked: prefs['try-to-paste'],
        type: 'checkbox'
      });
    });
  };
  chrome.runtime.onInstalled.addListener(callback);
  chrome.runtime.onStartup.addListener(callback);
}

// records
const records = () => chrome.storage.sync.get(null, prefs => {
  const keys = Object.keys(prefs).filter(s => s.startsWith('record.'));
  keys.sort();

  chrome.contextMenus.update('safe', {
    title: `Safe Storage (${keys.length})`
  });
  for (const key of keys) {
    chrome.contextMenus.create({
      id: key,
      title: key.replace('record.', ''),
      contexts: ['selection', 'page', 'editable'],
      parentId: 'safe'
    }, () => chrome.runtime.lastError);
  }
});
chrome.storage.onChanged.addListener(prefs => {
  if (Object.keys(prefs).some(s => s.startsWith('record.'))) {
    records();
  }
});
