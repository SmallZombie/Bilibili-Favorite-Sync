exports.Logger = class Logger {
    info(msg = '') {
        msg = String(msg);
        process.stdout.write('[INFO] ' + msg + (msg.endsWith('\r') ? '' : '\n'));
    }
    warn(msg = '') {
        msg = String(msg);
        process.stdout.write('\x1b[7;33m' + '[WARN] ' + msg + '\x1b[0m' + (msg.endsWith('\\r') ? '' : '\n'));
    }
    err(msg = '', clearLine) {
        msg = String(msg);
        if (clearLine) process.stdout.clearLine();
        process.stdout.write('\x1b[1;41m' + '[ERR ] ' + msg + '\x1b[0m' + (msg.endsWith('\\r') ? '' : '\n'));
    }
}
