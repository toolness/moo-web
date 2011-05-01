var net = require('net'),
    http = require('http'),
    fs = require('fs'),
    util = require('util'),
    io = require('./socket.io');

var config = JSON.parse(fs.readFileSync('config.json'));

const STATIC_FILES_DIR = 'static-files/',
      MOO_PROGRAM = 'moo/moo';

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
  var socket = net.createConnection(config.moo.socketFile);

  socket.setEncoding('utf8');

  socket.on('connect', function() {
    //console.log('connect');
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

function startMOO(cb) {
  try {
    fs.unlinkSync(config.moo.socketFile);
  } catch (e) {}

  var args = [
    '-l',
    config.moo.logFile,
    config.moo.inputDbFile,
    config.moo.outputDbFile,
    // There's a weird bug in LambdaMOO where the last
    // character of the socket filename gets clipped,
    // so we'll add an extra character as a workaround.
    config.moo.socketFile + ' '
  ];

  util.log("Spawning '" + MOO_PROGRAM + ' ' + args.join(" ") + "'");

  var moo = require('child_process').spawn(MOO_PROGRAM, args);

  moo.on('exit', function(code) {
    util.log('MOO process terminated');
    fs.unlinkSync(config.moo.socketFile);
    process.exit(code);
  });

  process.on('SIGINT', function() {
    util.log('SIGINT received, shutting down MOO');
    moo.kill('SIGINT');
  });

  util.log("MOO started as pid " + moo.pid);
  
  var interval = setInterval(function() {
    fs.stat(config.moo.socketFile, function(err) {
      if (!err) {
        clearInterval(interval);
        cb();
      }
    });
  }, 100);
}

startMOO(function() {
  server.listen(config.port);
  util.log("Now listening on port " + config.port);
  process.on('uncaughtException', function(err) {
    util.log(err.stack);
    util.log(err.message);    
  });
});
