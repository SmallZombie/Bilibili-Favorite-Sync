/**
 * 命令管理器
 * 负责处理和执行所有的命令节点
 * 目前只有 UIManager 在使用
 */

exports.execute = execute;


const nodes = {
    stop: require('./StopCommandNode.js'),
    help: require('./HelpCommandNode.js'),
    reload: require('./ReloadCommandNode.js')
}


function execute(cmd, ...args) {
    return new Promise((resolve, reject) => {
        if (nodes[cmd]) {
            nodes[cmd].execute(...args).then(res => resolve(res)).catch(e => reject(e));
        } else reject('命令不存在');
    });
}
