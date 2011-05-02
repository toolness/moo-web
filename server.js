var net = require('net'),
    fs = require('fs'),
    util = require('util'),
    io = require('./socket.io');

var config = null;

const STATIC_FILES_DIR = 'static-files/',
      MOO_PROGRAM = 'moo/moo';

function staticFileServer(req, res) {
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
    var out = fs.createReadStream(STATIC_FILES_DIR + filename);
    out.pipe(res);
  } else {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('not found: ' + req.url);
  }
}

function pipeMOOToWeb(client) {
  var socket = net.createConnection(config.moo.socketFile);

  socket.setEncoding('utf8');

  socket.on('data', function(chunk) {
    client.send(chunk);
  });
  
  client.on('message', function(msg) {
    socket.write(msg);
  });
  
  client.on('disconnect', function() {
    socket.end();
  });
}

function exists(filename) {
  try {
    fs.statSync(filename);
    return true;
  } catch (e) {
    return false;
  }
}

function unlinkIfExists(filename) {
  try {
    fs.unlinkSync(filename);
  } catch (e) {}  
}

function copyFile(src, dest) {
  var contents = fs.readFileSync(src);
  fs.writeFileSync(dest, contents);
}

function startMOO(cb) {
  unlinkIfExists(config.moo.socketFile);

  var currentFile = config.moo.dbFile + '.current';
  var newFile = config.moo.dbFile + '.new';
  var backupFile = config.moo.dbFile + '.backup';
  
  if (exists(currentFile)) {
    if (exists(newFile)) {
      unlinkIfExists(backupFile);
      fs.renameSync(currentFile, backupFile);
      fs.renameSync(newFile, currentFile);
    }
  } else {
    unlinkIfExists(newFile);
    copyFile(config.moo.dbFile, currentFile);
  }

  var args = [
    '-l',
    config.moo.logFile,
    currentFile,
    newFile,

    // There's a weird bug in LambdaMOO on OSX where the last
    // character of the socket filename gets clipped,
    // so we'll add an extra character as a workaround.

    config.moo.socketFile + (process.platform == 'darwin' ? ' ' : '')
  ];

  util.log("Spawning '" + MOO_PROGRAM + ' ' + args.join(" ") + "'");

  var moo = require('child_process').spawn(MOO_PROGRAM, args);

  moo.on('exit', function(code) {
    util.log('MOO process terminated with exit code ' + code);
    unlinkIfExists(config.moo.socketFile);
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

function loadConfig() {
  function loadJSONFile(filename) {
    var obj = null;
    try {
      return JSON.parse(fs.readFileSync(filename));
    } catch (e) {
      util.log("Error parsing " + filename + ": " + e);
      process.exit(1);
    }
  }

  function overlayConfig(config, localConfig) {
    for (var name in localConfig) {
      if (typeof(localConfig[name]) == 'object' &&
          localConfig[name] !== null)
        overlayConfig(config[name], localConfig[name]);
      else
        config[name] = localConfig[name];
    }
  }

  var config = loadJSONFile('config.json');

  if (exists('config.local.json')) {
    var localConfig = loadJSONFile('config.local.json');
    overlayConfig(config, localConfig);
  }
  
  return config;
}

config = loadConfig();

startMOO(function() {
  var server;
  var protocol;
  
  if ('key' in config) {
    protocol = 'https';
    server = require('https').createServer({
      key: fs.readFileSync(config.key),
      cert: fs.readFileSync(config.cert),
      ca: fs.readFileSync(config.ca)
    }, staticFileServer);
  } else {
    protocol = 'http';
    server = require('http').createServer(staticFileServer);
  }
  
  var httpSocket = io.listen(server, config.io);

  httpSocket.on('connection', pipeMOOToWeb);
  server.listen(config.port);

  util.log("Now listening on port " + config.port +
           " using " + protocol);

  process.on('uncaughtException', function(err) {
    util.log(err.stack);
    util.log(err.message);    
  });
});
