var net = require('net'),
    http = require('http'),
    fs = require('fs'),
    io = require('./socket.io');

const STATIC_FILES_DIR = 'static-files/';
const SOCKET_FILENAME = 'moo.sock';

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

var httpSocket = io.listen(server);

httpSocket.on('connection', function(client) {
  var socket = net.createConnection(SOCKET_FILENAME);

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

function startMOO() {
  try {
    fs.unlinkSync(SOCKET_FILENAME);
  } catch (e) {}

  var moo = require('child_process').spawn('moo/moo', [
    'moo/Minimal.db',
    'moo/Minimal-new.db',
    // There's a weird bug in LambdaMOO where the last
    // character of the socket filename gets clipped,
    // so we'll add an extra character as a workaround.
    SOCKET_FILENAME + ' '
  ]);

  moo.on('exit', function(code) {
    console.log('moo process terminated.');
    fs.unlinkSync(SOCKET_FILENAME);
    process.exit(code);
  });

  process.on('SIGINT', function() {
    console.log('shutting down...');
    moo.kill('SIGINT');
  });

  console.log("moo started as pid " + moo.pid + ".");
}

startMOO();
server.listen(7777);
