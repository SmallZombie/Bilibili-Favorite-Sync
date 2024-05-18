/**
 * 命令管理器
 * 负责处理和执行所有的命令节点
 * 目前只有 UIManager 在使用
 */
exports.execute = execute;


const { logger } = require('../config/Global.js');


const nodes = {
    help: require('./HelpCommandNode.js'),
    start: require('./StartCommandNode.js'),
    stop: require('./StopCommandNode.js'),
    reload: require('./ReloadCommandNode.js'),
    library: require('./LibraryCommandNode.js'),
    pause: require('./PauseCommandNode.js')
}


function execute(cmd, args) {
    return new Promise((resolve, reject) => {
        if (nodes[cmd]) {
            // 如果一个命令有子节点需要子节点自己 `switch | if`，参考 `LibraryCommandNode.js` 的写法
            // 命令需要自己使用 `logger` 来更新执行时的详细信息
            // 你可以将最终的执行结果使用 `resolve` 返回，或自行使用 `logger`(建议)
            nodes[cmd].execute(args)
                .then(res => {
                    res && logger.info(res);
                    resolve();
                })
                .catch(e => reject(e));
        } else reject('未知命令：' + cmd);
    });
}
