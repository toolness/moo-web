var net = require('net'),
    fs = require('fs'),
    util = require('util'),
    url = require('url'),
    io = require('./socket.io');

var config = null;

const STATIC_FILES_DIR = __dirname + '/static-files',
      MOO_PROGRAM = __dirname + '/moo/moo';

const MIME_TYPES = {
  js: 'application/javascript',
  html: 'text/html'
};

function staticFileServer(req, res) {
  var path = url.parse(req.url).pathname;
  var staticFilePath = STATIC_FILES_DIR + path;
  
  function return404() {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('not found: ' + path);
  }

  if (staticFilePath.match(/\/$/))
    staticFilePath += 'index.html';

  fs.realpath(staticFilePath, function(err, resolvedPath) {
    if (!err && resolvedPath.indexOf(STATIC_FILES_DIR + '/') == 0) {
      var extMatch = resolvedPath.match(/\.([a-z]+)$/);
      var mimetype;

      if (extMatch && extMatch[1] in MIME_TYPES) {
        mimetype = MIME_TYPES[extMatch[1]];

        fs.stat(resolvedPath, function(err, stats) {
          if (!err && stats.isFile()) {
            if (req.headers['if-none-match'] == stats.mtime) {
              res.writeHead(304);
              res.end();
            } else {
              res.writeHead(200, {
                'Content-Length': stats.size,
                'Content-Type': mimetype,
                'ETag': stats.mtime
              });
              var out = fs.createReadStream(resolvedPath);
              out.pipe(res);
            }
          } else
            return404();
        });
      } else
        return404();
    } else
      return404();
  });
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
