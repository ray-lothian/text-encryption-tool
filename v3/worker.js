/* global Safe */

self.importScripts('./safe.js');
self.importScripts('./context.js');

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
      const safe = new Safe();
      await safe.open(password);
      const encrypted = 'data:application/octet-binary;base64,' + await safe.encrypt(info.selectionText);
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
        const safe = new Safe();
        await safe.open(password);
        const text = await safe.decrypt(selected);
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
