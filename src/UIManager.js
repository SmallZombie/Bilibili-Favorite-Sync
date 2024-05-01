/**
 * 用户界面管理器
 * 负责整合信息、命令执行信息和命令输入
 */

module.exports = {
    updateInfos,
    updateCommandInfos,
    setAllowInput
}


const readline = require('readline');
const { execute } = require('./command/CommandManager.js');
const { G_DEBUG } = require('./config/Global.js');


// 初始化 readline 接口
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let currInfos = '';
let currCommandInfos = '';
let currInput = '';


function updateInfos(newInfos) {
    if (G_DEBUG) console.log('[DEBUG] ' + newInfos);
    else {
        currInfos = newInfos;
        update();
    }
}

function updateCommandInfos(newCommandInfos) {
    if (G_DEBUG) console.log('[DEBUG] ' + newCommandInfos);
    else {
        currCommandInfos = newCommandInfos;
        update();
    }
}

/** 更新信息显示区 */
function update() {
    if (G_DEBUG) return;

    // 清除
    console.clear();

    // 基本信息区
    rl.write(currInfos);

    // 命令提示区
    rl.write('\n\n' + currCommandInfos);

    if (allowInput) {
        // 光标
        rl.write('\n> ' + currInput);
    }
}

// 监听按键
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

process.stdin.on('keypress', (str, key) => {
    if (!allowInput) return;

    if (str === '\r') enterHandle();
    else if (str === '\b') currInput = currInput.slice(0, -1);
    else currInput += str;
});

// 首次运行
console.clear();
update();

// 处理命令
function enterHandle() {
    if (currInput === '') return;

    const temp = currInput.trim().split(' ');
    execute(temp.shift(), temp).then(res => {
        if (res) {
            updateCommandInfos(res);
        } else updateCommandInfos('执行成功，没有更多信息。');
    }).catch(e => updateCommandInfos('执行命令时发生错误：' + e));

    currInput = '';
    update();
}

/** 设置是否允许输入 */
function setAllowInput(allow) {
    allowInput = allow;
    update();
}
