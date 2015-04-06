var dns = require('native-dns'),
    configReader = require('./config-reader');

module.exports.start = function() {
  var server = dns.createServer();
  var TYPE_A = 1;
  var TYPE_NS = 2;
  var TYPE_MX = 15;

  server.on('request', function (request, response) {
    var question = request.question[0];
    if (question.type === TYPE_A) {
      response.answer.push(dns.A({
        name: question.name,
        address: configReader.getIPAddress(question.name),
        ttl: 600,
      }));
    } else if (question.type === TYPE_NS) {
      response.answer.push(dns.NS({
        name: question.name,
        data: configReader.getNameServer(question.name, 1),
        ttl: 600,
      }));
      response.answer.push(dns.NS({
        name: question.name,
        data: configReader.getNameServer(question.name, 2),
        ttl: 600,
      }));
    } else if (question.type === TYPE_MX) {
      response.answer.push(dns.MX({
        name: question.name,
        priority: 10,
        exchange: configReader.getMailServer(question.name),
        ttl: 600,
      }));
    }
    response.send();
  });
  
  server.on('error', function (err, buff, req, res) {
    console.log(err.stack);
  });
  
  server.serve(53);
};
