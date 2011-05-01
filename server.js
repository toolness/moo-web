var net = require('net'),
    http = require('http'),
    fs = require('fs'),
    io = require('./socket.io');

const STATIC_FILES_DIR = 'static-files/'

var server = http.createServer(function(req, res) {
  var filename = null;
  var mimetype = null;
  
  switch (req.url) {
    case '/':
    filename = 'index.html';
    mimetype = 'text/html';
    break;
    
    case '/jquery.min.js':
    case '/jquery.scrollTo-min.js':
    filename = req.url.slice(1);
    mimetype = 'application/javascript';
  }

  if (filename) {
    res.writeHead(200, {'Content-Type': mimetype});
    res.end(fs.readFileSync(STATIC_FILES_DIR + filename));
  } else {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('not found');
  }
});

server.listen(7778);

var httpSocket = io.listen(server);

httpSocket.on('connection', function(client) {
  console.log('conenction');

  var socket = net.createConnection('moo.sock');

  socket.setEncoding('utf8');

  socket.on('connect', function() {
    console.log('connect');
  });

  socket.on('connect', function() {
    console.log('connect');
  });

  socket.on('data', function(chunk) {
    client.send(chunk);
  });
  
  client.on('message', function(msg) {
    socket.write(msg);
  });
  
  client.on('disconnect', function() {
    socket.end();
  });
});
