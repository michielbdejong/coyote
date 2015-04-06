var fs = require('fs'),
    async = require('async'),
    repos = require('./repos'),
    backends = require('./backends');

var CONFIG_LOAD_INTERVAL = 60*1000;


var config;

function loadConfig(sync) {
  if (sync) {
    try {
      config = JSON.parse(fs.readFileSync('config.json'));
      console.log('loaded config', config);
    } catch(e) {
      console.log('error loading config.json', e);
    }
  } else {
    fs.readFile('config.json', function(err, data) {
      if (err) {
        console.log('error reading config.json', err);
      } else {
        try {
          config = JSON.parse(data.toString());
          console.log('reloaded config', config);
        } catch(e) {
          console.log('error parsing config.json', e);
        }
      }
    });
  }
}

function getConfig(domain) {
  if (config && config.domains && config.domains[domain]) {
    return config.domains[domain];
  } else {
    return {};
  }
}

module.exports.init = function() {
  setInterval(loadConfig, CONFIG_LOAD_INTERVAL);
  loadConfig(true);
};
module.exports.getConfig = getConfig;
module.exports.getBackupServerPath = function(which) {
  if (config && config.backupServerPaths) {
    return config.backupServerPaths[which];
  } else {
    return null;
  }
}

module.exports.getImagesList = function(which) {
  if (config && config.images && config.images[which]) {
    return config.images[which];
  } else {
    return [];
  }
}

function checkDomain(host, config, callback) {
  if (config.type === 'backend') {
    repos.ensurePresent(host, config.repo, function(err, localRepoPath) {
     if (err) {
       callback(err);
     } else {
// starting containers is probably a bad idea here. See also
// https://github.com/michielbdejong/snickers/issues/17 about (re-)creating containers
//       backends.ensureStarted(config, localRepoPath, function(err, ipaddr) {
//         if (err) {
//           callback(err);
//         } else {
           callback(null);
//         }
//       });
      }
    });
  } else if (config.type === 'static') {
    repos.ensurePresent(host, config.repo, function(err, localRepoPath) {
      if (err) {
        callback(err);
      } else {
        repos.maybePull(host, config.pullFrequency, callback);
      }
    });
  } else if (config.type === 'redirect') {
    if (typeof config.redirectHost === 'string') {
      callback(null);
    } else {
      callback('no redirectHost for redirect domain' + JSON.stringify(config));
    }
  } else {
    callback('unknown type ' + JSON.stringify(config));
  }
}
function checkDomains(domains, defaultBackupServerPath, callback) {
  async.each(Object.keys(domains), function(i, doneThis) {
    var thisConf = domains[i];
    if (!thisConf.repo) {
      thisConf.repo = defaultBackupServerPath + i;
    }
    checkDomain(i, thisConf, doneThis);
  }, callback);
}

module.exports.getBackendTarPath = function(application) {
  return '../snickers-applications/tar/' + application + '.tar';
};

module.exports.getIPAddress = function(domain) {
  if (config.domains[domain]) {
    return config.host.ipaddress;
  } else if (typeof config.neighboring[domain] === 'object' && typeof config.neighboring[domain].ipaddress === 'string') {
    return config.neighboring[domain].ipaddress;
  } else {
    return false;
  }
}

module.exports.getNameServer = function(domain, index) {
  if (config.domains[domain]) {
    return config.host.nameservers[index];
  } else if (typeof config.neighboring[domain] === 'object'
      && typeof config.neighboring[domain].nameservers === 'object'
      && typeof config.neighboring[domain].nameservers[index] === 'string') {
    return config.neighboring[domain].nameservers[index];
  } else {
    return false;
  }
}

module.exports.getMailServer = function(domain) {
  if (config.domains[domain]) {
    return config.host.mailserver;
  } else if (typeof config.neighboring[domain] === 'object' && typeof config.neighboring[domain].mailserver === 'string') {
    return config.neighboring[domain].mailserver;
  } else {
    return false;
  }
}

module.exports.updateConfig = function(confObj) {
  var failedCheck;
  function checkType(thing, type, name) {
    if (typeof thing === type) {
      return true;
    } else {
      failedCheck = 'Type of '+name+' should be '+type;
    }
  }
  function checkArray(thing, name) {
    if (Array.isArray(thing)) {
      return true;
    } else {
      failedCheck = name+' should be an Array';
    }
  }
  if (checkType(confObj, 'object', 'confObj')
      && checkType(confObj.domains, 'object', 'confObj.domains')
      && checkType(confObj.neighboring, 'object', 'confObj.neighboring')
      && checkType(confObj.host, 'object', 'confObj.host')
      && checkType(confObj.host.ipaddress, 'string', 'confObj.host.ipaddress')
      && checkType(confObj.host.nameservers, 'object', 'confObj.host.nameservers')
      && checkType(confObj.host.nameservers[1], 'string', 'confObj.host.nameservers[1] should be a string')
      && checkType(confObj.host.nameservers[2], 'string', 'confObj.host.nameservers[2] should be a string')
      && checkType(confObj.host.mailserver, 'string', 'confObj.host.mailserver')
      && checkType(confObj.images, 'object', 'confObj.images')
      && checkArray(confObj.images.upstream, 'confObj.images.upstream')
      && checkArray(confObj.images.intermediate, 'confObj.images.intermediate')
      && checkArray(confObj.images.target, 'confObj.images.target')
      && checkType(confObj.backupServerPaths, 'object', 'confObj.backupServerPaths')
      && checkType(confObj.backupServerPaths.origin, 'string', 'confObj.backupServerPaths.origin')
      && checkType(confObj.backupServerPaths.secondary, 'string', 'confObj.backupServerPaths.secondary')) {
    backends.rebuildAll(confObj.images, function(err) {
      if (err) {
        console.log('error rebuilding images', err);
      } else {
        checkDomains(confObj.domains, confObj.backupServerPaths.origin, function(err) {
          if (err) {
            console.log(err);
          } else {
            fs.writeFile('config.json', JSON.stringify(confObj), function(err) {
              if (err) {
                console.log('error writing config.json');
              } else {
                console.log('wrote config.json');
              }
            });
          }
        });
      }
    });
  } else {
    console.log('Please format your config.js file like config.js.sample', failedCheck);
  }
}
