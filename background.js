/* globals safe */
'use strict';

var notify = message => chrome.notifications.create({
  title: chrome.runtime.getManifest().name,
  type: 'basic',
  iconUrl: 'data/icons/48.png',
  message
});

var storage = {};

function tab() {
  return new Promise((resolve, reject) => chrome.tabs.query({
    active: true,
    currentWindow: true
  }, tabs => {
    if (tabs && tabs.length) {
      resolve(tabs[0]);
    }
    else {
      reject(new Error('No active tab is detected'));
    }
  }));
}

function copy(str, tabId, msg) {
  if (/Firefox/.test(navigator.userAgent)) {
    const id = Math.random();
    storage[id] = str;
    const run = tabId => chrome.tabs.executeScript(tabId, {
      allFrames: false,
      runAt: 'document_start',
      code: `
        chrome.runtime.sendMessage({
          method: 'vars',
          id: ${id}
        }, password => {
          document.oncopy = (event) => {
            event.clipboardData.setData('text/plain', password);
            event.preventDefault();
          };
          window.focus();
          document.execCommand('Copy', false, null);
        });
      `
    }, () => {
      notify(chrome.runtime.lastError ? 'Cannot copy to the clipboard on this page!' : msg);
    });
    if (tabId) {
      run(tabId);
    }
    else {
      tab().then(tab => run(tab.id)).catch(e => notify(e.message));
    }
  }
  else {
    document.oncopy = e => {
      e.clipboardData.setData('text/plain', str);
      e.preventDefault();
      notify(msg);
    };
    document.execCommand('Copy', false, null);
  }
}
chrome.runtime.onMessage.addListener((request, sender, response) => {
  console.log(request)
  if (request.method === 'vars') {
    response(storage[request.id]);
    // multiple requests may need this value
    window.setTimeout(() => delete storage[request.id], 2000);
  }
});

var replace = (str, tabId) => {
  const id = Math.random();
  storage[id] = str;
  chrome.tabs.executeScript(tabId, {
    allFrames: true,
    code: `{
      const selected = window.getSelection();
      const aElement = document.activeElement;
      if (selected && selected.rangeCount) {
        chrome.runtime.sendMessage({
          method: 'vars',
          id: ${id}
        }, str => {
          const run = document.execCommand('insertText', null, str);
          if (run === false) {
            const range = selected.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(str));
          }
        });
      }
      else if (aElement && 'selectionStart' in aElement && aElement.selectionStart !== aElement.selectionEnd) {
        chrome.runtime.sendMessage({
          method: 'vars',
          id: ${id}
        }, str => {
          const value = aElement.value;
          const {selectionStart, selectionEnd} = aElement;
          aElement.value = value.slice(0, selectionStart) + str + value.slice(selectionEnd);
          Object.assign(aElement, {
            selectionStart,
            selectionEnd: selectionStart + str.length
          });
        });
      }
  }`});
};

// Context Menu
{
  const callback = () => {
    chrome.contextMenus.create({
      id: 'encrypt-clipboard',
      title: 'Encrypt (clipboard)',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'encrypt-replace',
      title: 'Encrypt (replace)',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'decrypt-clipboard',
      title: 'Decrypt (clipboard)',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'decrypt-replace',
      title: 'Decrypt (replace)',
      contexts: ['selection']
    });
  };
  chrome.runtime.onInstalled.addListener(callback);
  chrome.runtime.onStartup.addListener(callback);
}
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const method = info.menuItemId || '';
  const selected = info.selectionText;
  if (method.startsWith('encrypt-')) {
    if (!selected) {
      return notify('Selection is empty');
    }
    if (info.selectionText.startsWith('data:application/octet-binary;base64,')) {
      return notify('Selected text is already encrypted');
    }
    chrome.tabs.executeScript(tab.id, {
      code: `window.prompt('Enter a passphrase')`
    }, ([password]) => {
      if (password) {
        chrome.tabs.executeScript(tab.id, {
          code: `window.prompt('Re-enter the passphrase')`
        }, ([confirm]) => {
          if (password === confirm) {
            safe.encrypt(info.selectionText, password).then(encrypted => {
              if (method === 'encrypt-replace') {
                replace(encrypted, tab.id);
              }
              else {
                copy(encrypted, tab.id, 'Encrypted text is copied to the clipboard');
              }
            }).catch(e => notify(e.message));
          }
          else {
            notify('Password does not match');
          }
        });
      }
      else {
        notify('Empty passphrase. Operation terminated');
      }
    });
  }
  else if (method.startsWith('decrypt-')) {
    if (!selected) {
      return notify('Selection is empty');
    }
    if (selected.startsWith('data:application/octet-binary;base64,') === false) {
      return notify('This is not an encrypted text');
    }
    chrome.tabs.executeScript(tab.id, {
      code: `window.prompt('Enter the passphrase')`
    }, ([password]) => {
      if (password) {
        safe.decrypt(info.selectionText, password).then(text => {
          if (method === 'decrypt-replace') {
            replace(text, tab.id);
          }
          else {
            copy(text, tab.id, 'Decrypted text is copied to the clipboard');
          }
        }).catch(e => notify(e.message || 'Cannot decrypt selected text with the provided passphrase'));
      }
      else {
        notify('Passphrase is mandatory to decrypt selection');
      }
    });
  }
});

// FAQs & Feedback
chrome.storage.local.get({
  'version': null,
  'faqs': navigator.userAgent.indexOf('Firefox') === -1,
  'last-update': 0,
}, prefs => {
  const version = chrome.runtime.getManifest().version;

  if (prefs.version ? (prefs.faqs && prefs.version !== version) : true) {
    const now = Date.now();
    const doUpdate = (now - prefs['last-update']) / 1000 / 60 / 60 / 24 > 30;
    chrome.storage.local.set({
      version,
      'last-update': doUpdate ? Date.now() : prefs['last-update']
    }, () => {
      // do not display the FAQs page if last-update occurred less than 30 days ago.
      if (doUpdate) {
        const p = Boolean(prefs.version);
        chrome.tabs.create({
          url: chrome.runtime.getManifest().homepage_url + '?version=' + version +
            '&type=' + (p ? ('upgrade&p=' + prefs.version) : 'install'),
          active: p === false
        });
      }
    });
  }
});

{
  const {name, version} = chrome.runtime.getManifest();
  chrome.runtime.setUninstallURL(
    chrome.runtime.getManifest().homepage_url + '?rd=feedback&name=' + name + '&version=' + version
  );
}
