/* globals Parser */
'use strict';

const ID = 'com.add0n.native_client';
const DOWNLOAD_TEST = 'https://webbrowsertools.com/test-download-with/';
const LINK = /(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#/%=~_|$?!:,.]*\)|[A-Z0-9+&@#/%=~_|$])/igm;
const config = window.config = {};

config.mode = {
  get method() {
    return 'parallel';
  },
  supports: false
};
config.command = {
  executable: {
    Mac: 'open',
    Win: '%ProgramFiles%\\Softdeluxe\\Free Download Manager\\fdm.exe',
    // user installtion path
    uWin: 'C:\\Users\\IEUser\\AppData\\Local\\Softdeluxe\\Free Download Manager',
    Lin: 'fdm'
  },
  args: {
    Mac: '-a "Free Download Manager" "[URL]"',
    Win: '"[URL]"',
    Lin: '"[URL]"'
  },
  get guess() {
    const os = navigator.platform.substr(0, 3);
    const executable = config.command.executable;
    const args = config.command.args[os];
    return {
      executable: executable[os],
      args
    };
  }
};

const links = {};
// remove cache when tab is closed
chrome.tabs.onRemoved.addListener(id => delete links[id]);

const tools = {};
tools.fetch = ({url, headers = {}, method = 'GET', data = {}}) => {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();
    req.open(method, url);
    Object.entries(headers).forEach(([key, value]) => {
      req.setRequestHeader(key, value);
    });
    req.onload = () => resolve(req);
    req.onerror = req.ontimeout = () => reject(new Error('network error'));
    req.send(Object.entries(data).map(([key, value]) => key + '=' + encodeURIComponent(value)).join('&'));
  });
};

const notify = e => chrome.notifications.create({
  title: chrome.runtime.getManifest().name,
  type: 'basic',
  iconUrl: '/data/icons/48.png',
  message: e.message || e
});
const lang = {};
lang.empty = 'Command box is empty. Use options page to define one!';
lang.notfound = 'Executable path cannot be located. Go to the options page and fix the path.';
lang.permissions = 'To extract links from all iframes of this page, the permission is needed';
lang.nolink = 'Cannot extract any link from selected text';
lang.getLinks = 'To extract links and display the interface, this permission is needed';

function execute(d) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(config.command.guess, prefs => {
      if (!prefs.executable) {
        return notify(lang.empty);
      }
      const p = new Parser();
      // do not escape expressions
      p.escapeExpressions = {};
      // remove args that are not provided
      if (!d.referrer) {
        prefs.args = prefs.args
          .replace(/\s[^\s]*\[REFERRER\][^\s]*\s/, ' ');
      }
      if (!d.filename) {
        prefs.args = prefs.args
          .replace(/\s[^\s]*\[FILENAME\][^\s]*\s/, ' ')
          .replace(/\s[^\s]*\[DISK][^\s]*\s/, ' ');
      }

      let url = d.finalUrl || d.url;
      if (Array.isArray(url)) {
        url = url.join(config.mode.sep);
      }
      // we do not support cookies for FDM
      prefs.args = prefs.args.replace('--load-cookies=[COOKIES]', '');

      // remove path from filename
      const name = (d.filename || '').split(/[/\\]/).pop();
      const termref = {
        lineBuffer: prefs.args
          .replace(/\[URL\]/g, url)
          .replace(/\[REFERRER\]/g, d.referrer)
          .replace(/\[FILENAME\]/g, name)
          .replace(/\[DISK\]/g, (d.filename || ''))
          .replace(/\[USERAGENT\]/g, navigator.userAgent)
          .replace(/\\/g, '\\\\')
      };

      p.parseLine(termref);

      setTimeout(resolve, config.delay || 5000);
      const permissions = ['path', 'child_process'];
      chrome.runtime.sendNativeMessage(ID, {
        permissions,
        args: [prefs.executable, ...termref.argv],
        script: String.raw`
          const command = args[0].replace(/%([^%]+)%/g, (_, n) => {
            if (n === 'ProgramFiles(x86)' && !env[n]) {
              return env['ProgramFiles'];
            }
            return env[n];
          });
          args = args.map(s => s.replace(/\[COOKIES\]/g, '.'));
          const exe = require('child_process').spawn(command, args.slice(1), {
            detached: true,
            windowsVerbatimArguments: ${Boolean(config.windowsVerbatimArguments)}
          });
          let stdout = '', stderr = '';
          exe.stdout.on('data', data => stdout += data);
          exe.stderr.on('data', data => stderr += data);

          stdout += command;
          exe.on('close', code => {
            push({code, stdout, stderr});
            done();
          });
          if (${config.detached}) {
            setTimeout(() => {
              push({code: 0});
              done();
              process.exit();
            }, 5000);
          }
        `
      }, res => {
        if (!res) {
          chrome.tabs.create({
            url: '/data/guide-fdm/index.html'
          });
          return reject(Error('empty response'));
        }
        else if (res.code !== 0) {
          const msg = res.stderr || res.error || res.err;
          console.warn(msg);
          if (msg && msg.indexOf('ENOENT') !== -1) {
            return reject(Error(lang.notfound));
          }
          return reject(Error(msg));
        }
        else {
          resolve();
        }
      });
    });
  });
}

function transfer(d, tab = {}) {
  (config.pre ? config.pre.action() : Promise.resolve(false))
    .then(running => !running && execute(d)).then(() => {
      if (config.post) {
        config.post.action(d, tab);
      }
    })
    .then(() => {
      if (d.id) {
        chrome.downloads.erase({
          id: d.id
        });
      }
    }).catch(e => e && notify(e));
}

let id;
function observe(d, response = () => {}) {
  const mimes = localStorage.getItem('mimes') || '';
  if (mimes.indexOf(d.mime) !== -1) {
    return false;
  }

  response();
  const url = d.finalUrl || d.url;
  if (url.startsWith('http') || url.startsWith('ftp')) {
    // prefer d.url over d.finalUrl as it might be closer to the actual page url
    const {hostname} = new URL(d.url || d.finalUrl);
    const whitelist = localStorage.getItem('whitelist') || '';
    if (whitelist) {
      const hs = whitelist.split('|');
      if (hs.some(s => !s.endsWith(hostname) && !hostname.endsWith(s))) {
        return false;
      }
    }
    if (d.url.indexOf('github.com/belaviyo/native-client') !== -1) {
      return false;
    }
    if (id === d.id || d.error) {
      return false;
    }

    chrome.downloads.pause(d.id, () => chrome.tabs.query({
      active: true,
      currentWindow: true
    }, tabs => {
      transfer(d, tabs && tabs.length ? tabs[0] : {});
    }));
  }
}

function power(enabled) {
  const diSupport = Boolean(chrome.downloads.onDeterminingFilename);
  const download = diSupport ? chrome.downloads.onDeterminingFilename : chrome.downloads.onCreated;
  if (enabled) {
    download.addListener(observe);
  }
  else {
    download.removeListener(observe);
  }
  chrome.browserAction.setIcon({
    path: {
      '16': 'data/icons/' + (enabled ? '' : 'disabled/') + '16.png',
      '19': 'data/icons/' + (enabled ? '' : 'disabled/') + '19.png',
      '32': 'data/icons/' + (enabled ? '' : 'disabled/') + '32.png',
      '38': 'data/icons/' + (enabled ? '' : 'disabled/') + '38.png',
      '48': 'data/icons/' + (enabled ? '' : 'disabled/') + '48.png',
      '64': 'data/icons/' + (enabled ? '' : 'disabled/') + '64.png'
    }
  });
  chrome.browserAction.setTitle({
    title: `Download with Free Download Manager (interruption is "${enabled ? 'enabled' : 'disabled'}")`
  });
}

function onCommand(toggle = true) {
  chrome.storage.local.get({
    enabled: false
  }, prefs => {
    const enabled = toggle ? !prefs.enabled : prefs.enabled;
    chrome.storage.local.set({
      enabled
    });
    power(enabled);
  });
}
chrome.browserAction.onClicked.addListener(onCommand);
onCommand(false);

// contextMenus
const context = () => (new Promise(resolve => chrome.storage.local.get({
  'context.open-link': true,
  'context.open-video': true,
  'context.grab': true,
  'context.extract': true
}, resolve)).then(prefs => {
  const add = o => {
    o.documentUrlPatterns = ['*://*/*'];
    chrome.contextMenus.create(o);
  };

  chrome.contextMenus.removeAll(() => {
    add({
      id: 'test',
      title: 'Open Sample Download Page',
      contexts: ['browser_action']
    });
    if (prefs['context.open-link']) {
      add({
        id: 'open-link',
        title: 'Download Link',
        contexts: ['link']
      });
    }
    if (prefs['context.open-video']) {
      add({
        id: 'open-video',
        title: 'Download Media or Image',
        contexts: ['audio', 'video', 'image']
      });
    }
    if (prefs['context.grab']) {
      add({
        id: 'grab',
        title: 'Download all Links',
        contexts: ['browser_action', 'page']
      });
    }
    if (prefs['context.extract']) {
      add({
        id: 'extract',
        title: 'Extract Links from Selection',
        contexts: ['selection']
      });
    }
  });
}));
chrome.runtime.onStartup.addListener(context);
chrome.runtime.onInstalled.addListener(context);
chrome.storage.onChanged.addListener(prefs => {
  if (Object.keys(prefs).some(s => s.startsWith('context.'))) {
    context();
  }
});

const grab = mode => chrome.tabs.executeScript({
  runAt: 'document_start',
  code: `window.mode = "${mode}"`
}, () => {
  const lastError = chrome.runtime.lastError;
  if (lastError) {
    notify(lastError.message);
  }
  else {
    chrome.tabs.executeScript({
      runAt: 'document_start',
      file: '/data/grab/inject.js'
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'grab') {
    chrome.permissions.request({
      origins: ['*://*/*']
    }, granted => {
      if (granted) {
        grab('none');
      }
      else {
        notify(lang.permissions);
      }
    });
  }
  else if (info.menuItemId === 'extract') {
    const es = info.selectionText.match(LINK) || [];
    chrome.permissions.request({
      origins: ['*://*/*']
    }, granted => {
      if (granted) {
        chrome.tabs.executeScript(tab.id, {
          frameId: info.frameId,
          code: `window.extraLinks = ${JSON.stringify(es)};`
        }, () => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            notify(lastError.message);
          }
          else {
            chrome.tabs.executeScript(tab.is, {
              frameId: info.frameId,
              file: 'data/grab/selection.js'
            }, a => {
              if (a && a[0]) {
                const es = a[0].filter((s, i, l) => s && l.indexOf(s) === i);
                if (es.length) {
                  links[tab.id] = es;
                  grab('serve');
                }
                else {
                  notify(lang.nolink);
                }
              }
            });
          }
        });
      }
      else {
        notify(lang.getLinks);
      }
    });
  }
  else if (info.menuItemId === 'test') {
    chrome.tabs.create({
      url: DOWNLOAD_TEST
    });
  }
  else {
    transfer({
      finalUrl: info.menuItemId === 'open-video' ? info.srcUrl : info.linkUrl,
      referrer: info.pageUrl
    }, tab);
  }
});

//
chrome.runtime.onMessage.addListener((request, sender, response) => {
  const {method} = request;
  if (method === 'notify') {
    const {message} = request;
    notify(message);
  }
  else if (method === 'exec') {
    const {code} = request;
    chrome.tabs.executeScript({
      runAt: 'document_start',
      code,
      allFrames: true
    }, r => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        notify(lastError.message);
      }
      else {
        response(r);
      }
    });
    return true;
  }
  else if (method === 'download-links') {
    const {job} = request;
    if (config.mode.method === 'batch') {
      transfer({
        ...job,
        referrer: sender.tab.url
      }, sender.tab);
    }
    else {
      (async () => {
        const delay = () => new Promise(resolve => setTimeout(resolve, Number(localStorage.getItem('delay') || 1000)));

        for (const finalUrl of job.url) {
          transfer({
            finalUrl,
            referrer: sender.tab.url
          }, sender.tab);

          await delay();
        }
      })();
    }
    chrome.tabs.sendMessage(sender.tab.id, {
      cmd: 'close-me'
    });
  }
  else if (method === 'download') {
    transfer(Object.assign({
      referrer: sender.tab.url
    }, request.job), sender.tab);
  }
  else if (method === 'extracted-links') {
    response(links[sender.tab.id] || []);
  }
  else if (method === 'head') {
    const req = new XMLHttpRequest();
    req.open('GET', request.link);
    req.ontimeout = req.onerror = () => response('');
    req.timeout = 10000;
    req.onreadystatechange = () => {
      if (req.readyState === req.HEADERS_RECEIVED) {
        const type = req.getResponseHeader('content-type') || '';
        req.abort();
        response(type);
      }
    };
    req.send();
    // async response
    return true;
  }
});

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
            tabs.create({
              url: page + '&version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install'
            });
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '&rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
