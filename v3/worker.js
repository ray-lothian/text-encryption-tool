/* global safe */

self.importScripts('./safe.js');

const notify = message => chrome.notifications.create({
  title: chrome.runtime.getManifest().name,
  type: 'basic',
  iconUrl: 'data/icons/48.png',
  message
});

const replace = (str, tabId) => {
  chrome.scripting.executeScript({
    target: {
      tabId,
      allFrames: true
    },
    func: str => {
      const selected = window.getSelection();
      const aElement = document.activeElement;
      if (selected && selected.rangeCount) {
        const run = document.execCommand('insertText', null, str);
        if (run === false) {
          const range = selected.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(str));
        }
      }
      else if (aElement && 'selectionStart' in aElement && aElement.selectionStart !== aElement.selectionEnd) {
        const value = aElement.value;
        const {selectionStart, selectionEnd} = aElement;
        aElement.value = value.slice(0, selectionStart) + str + value.slice(selectionEnd);
        Object.assign(aElement, {
          selectionStart,
          selectionEnd: selectionStart + str.length
        });
      }
    },
    args: [str]
  }).catch(notify);
};

const copy = async (str, tabId) => {
  await chrome.tabs.update(tabId, {
    highlighted: true
  });
  await new Promise(resolve => setTimeout(resolve, 500));

  await chrome.scripting.executeScript({
    target: {
      tabId
    },
    func: encrypted => {
      navigator.clipboard.writeText(encrypted).catch(e => {
        alert('Cannot copy to the clipboard; ' + e.message + '\n\nCopy using Ctrl + C\n\n' + encrypted);
      });
    },
    args: [str]
  });
};

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
      rate: true,
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

const onClicked = async (info, tab) => {
  const method = info.menuItemId || '';
  let selected = info.selectionText;
  if (method.startsWith('encrypt-')) {
    if (!selected) {
      return notify('Selection is empty');
    }
    if (info.selectionText.startsWith('data:application/octet-binary;base64,')) {
      return notify('Selected text is already encrypted');
    }
    try {
      const r = await chrome.scripting.executeScript({
        target: {
          tabId: tab.id
        },
        func: () => {
          const password = prompt('Enter a passphrase');
          if (password === '') {
            return {
              error: 'Empty passphrase. Operation terminated'
            };
          }
          const confirm = prompt('Re-enter the passphrase');
          if (password !== confirm) {
            return {
              error: 'Password does not match'
            };
          }
          window.focus();
          return {
            password
          };
        }
      });
      if (r[0].result.error) {
        throw Error(r[0].result.error);
      }
      const {password} = r[0].result;
      const encrypted = await safe.encrypt(info.selectionText, password);
      if (method === 'encrypt-replace') {
        replace(encrypted, tab.id);
      }
      else if (method === 'encrypt-store') {
        const r = await chrome.scripting.executeScript({
          target: {
            tabId: tab.id
          },
          func: () => prompt('Enter a unique name for this record')
        });
        if (r[0].result) {
          chrome.storage.sync.set({
            ['record.' + r[0].result]: encrypted
          }, () => notify('Saved the encrypted data in your synced storage'));
        }
        else {
          notify('saving aborted');
        }
      }
      else {
        copy(encrypted, tab.id);
        notify('Encrypted text is copied to the clipboard');
      }
    }
    catch (e) {
      console.warn(e);
      notify(e.message);
    }
  }
  else if (method.startsWith('decrypt-') || method.startsWith('record.')) {
    if (method.startsWith('record.')) {
      selected = await new Promise(resolve => chrome.storage.sync.get(method, prefs => resolve(prefs[method])));
    }

    if (!selected) {
      return notify('Selection is empty');
    }
    if (selected.startsWith('data:application/octet-binary;base64,') === false) {
      return notify('This is not an encrypted text');
    }
    try {
      const r = await chrome.scripting.executeScript({
        target: {
          tabId: tab.id
        },
        func: () => prompt('Enter the passphrase')
      });
      const password = r[0].result;
      if (password) {
        const text = await safe.decrypt(selected, password);
        if (method === 'decrypt-replace') {
          replace(text, tab.id);
        }
        else {
          const prefs = await new Promise(resolve => chrome.storage.local.get({
            'try-to-paste': true
          }, resolve));

          // try to paste the text into the editable
          if (info.editable && prefs['try-to-paste']) {
            const r = await chrome.scripting.executeScript({
              target: {
                tabId: tab.id,
                frameIds: [info.frameId]
              },
              func: msg => document.execCommand('insertText', false, msg),
              args: [text]
            });

            if (r[0].result) {
              return;
            }
          }

          await copy(text, tab.id);
          notify('Decrypted text is copied to the clipboard');
        }
      }
      else {
        notify('Passphrase is mandatory to decrypt selection');
      }
    }
    catch (e) {
      notify(e.message || 'Cannot decrypt selected text with the provided passphrase');
    }
  }
  else if (method === 'open-safe') {
    const win = await chrome.windows.getCurrent();
    chrome.storage.local.get({
      width: 700,
      height: 400,
      left: win.left + Math.round((win.width - 700) / 2),
      top: win.top + Math.round((win.height - 400) / 2)
    }, prefs => {
      chrome.windows.create({
        url: '/data/safe/index.html?content=' + encodeURIComponent(info.selectionText),
        width: prefs.width,
        height: prefs.height,
        left: prefs.left,
        top: prefs.top,
        type: 'popup'
      });
    });
  }
  else if (method === 'safe') {
    notify('This is your synced safe storage. Use the "Encrypt (store)" context menu item to store content privately');
  }
  else if (method === 'remove') {
    const r = await chrome.scripting.executeScript({
      target: {
        tabId: tab.id
      },
      func: () => prompt('Enter the name of a record to be removed')
    });
    if (r[0].result) {
      chrome.storage.sync.remove('record.' + r[0].result);
      chrome.contextMenus.remove('record.' + r[0].result);
    }
  }
  else if (method === 'rate') {
    let url = 'https://chrome.google.com/webstore/detail/text-encryption-tool/dbamnickgaplfmadnoegnbpjlojmjpge/reviews/';
    if (/Edg/.test(navigator.userAgent)) {
      url = 'https://microsoftedge.microsoft.com/addons/detail/dbniffdbjhdfohfjdapjmnladdcflijg';
    }
    else if (/Firefox/.test(navigator.userAgent)) {
      url = 'https://addons.mozilla.org/firefox/addon/text-encryption-tool/reviews';
    }

    chrome.storage.local.set({
      'rate': false
    }, () => chrome.tabs.create({
      url
    }));
  }
  else if (method === 'text-editor' || method === 'file-encryptor') {
    chrome.tabs.create({
      url: 'https://webbrowsertools.com/' + method + '/'
    });
  }
  else if (method === 'try-to-paste') {
    chrome.storage.local.set({
      'try-to-paste': info.checked
    });
  }
};
chrome.contextMenus.onClicked.addListener(onClicked);

chrome.action.onClicked.addListener(() => onClicked({
  menuItemId: 'open-safe',
  selectionText: ''
}));

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
