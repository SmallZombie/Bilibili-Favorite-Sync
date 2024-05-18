/**
 * 用户界面
 */
exports.setAllowInput = setAllowInput;


const { execute } = require('./command/CommandManager.js');
const { logger } = require('./config/Global.js');
const READLINE = require('readline');


let rl = null;


/** 处理命令 */
function inputHandle(line) {
    setAllowInput(false);

    // const args = line.trim().split(/\s(?=(?:[^'"`]*(['"`])[^'"`]*\1)*[^'"`]*$)/g);
    const args = line.trim().split(/(?=(?:(?:[^"]*"){2})*[^"]*$)[ ]+/);
    for (let i = 0; i < args.length; i++) {
        args[i] = args[i].replace(/"/g, '').trim();
    }

    execute(args.shift(), args)
        .catch(e => logger.err('执行命令时发生错误：' + e))
        .finally(() => setAllowInput(true));
}

/** 设置是否允许输入，默认为 false */
function setAllowInput(allow) {
    if (allow) {
        if (!rl) {
            rl = READLINE.createInterface(process.stdin, process.stdout);
            rl.on('line', inputHandle);
        }
        rl.setPrompt('> ');
        rl.prompt();
    } else if (rl) {
        rl.pause();
        rl.setPrompt('');
    }
}
