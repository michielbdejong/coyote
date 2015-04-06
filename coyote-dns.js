var dns = require('./dns'),
    configReader = require('./config-reader');

//..
configReader.init();
dns.start();
