'use strict';

const ID = 'com.add0n.native_client';

const notify = (type, message) => chrome.runtime.sendMessage({
  method: 'notify',
  message
});

let os = 'windows';
if (/Mac/.test(navigator.userAgent)) {
  os = 'mac';
  document.body.dataset.os = 'mac';
}
else if (/Linux/.test(navigator.userAgent)) {
  os = 'linux';
  document.body.dataset.os = 'linux';
}
else {
  document.body.dataset.os = 'windows';
}

const links = {
  api: 'https://api.github.com/repos/belaviyo/native-client/releases/latest',
  page: 'https://github.com/belaviyo/native-client/releases'
};
const lang = {
  search: 'Looking for the latest version of the native-client',
  nonative: 'Cannot find the native client. Follow the 3 steps to install the native client',
  start: 'Download is started. Extract and install when it is done',
  failed: 'Something went wrong! Please download the package manually'
};

const check = (silent = false, callback = () => {}) => chrome.runtime.sendNativeMessage(ID, {
  method: 'spec'
}, response => {
  callback(response);
  if (silent) {
    return;
  }
  if (response) {
    notify('success', 'Native client version is ' + response.version);
  }
  else {
    notify('error', lang.nonative);
  }
});

document.addEventListener('click', e => {
  const {target} = e;
  if (target.dataset.cmd === 'options') {
    chrome.runtime.openOptionsPage();
  }
  else if (target.dataset.cmd === 'download') {
    notify('info', lang.search);
    fetch(links.api).then(r => r.json()).then(response => {
      try {
        chrome.downloads.download({
          url: response.assets.filter(a => a.name === os + '.zip')[0].browser_download_url,
          filename: os + '.zip'
        }, () => {
          notify('success', lang.start);
          document.body.dataset.step = 1;
        });
      }
      catch (e) {
        notify('error', e.message || e);
      }
    }).catch(e => {
      console.warn(e);
      notify('error', lang.failed);
      window.open(links.page);
    });
  }
  else if (target.dataset.cmd === 'check') {
    check();
  }
});

check(true, response => {
  if (response && response.version) {
    document.getElementById('followup').dataset.hidden = false;
  }
});
