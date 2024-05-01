const FS = require('fs');
const PATH = require('path');


let G_CONFIG = null;
let G_LIBRARY_CONFIG = null;
/** 本地库的绝对路径 */
let G_LIBRARY_PATH = null;

const G_DEBUG = true;


/**
 * 重载配置文件
 * @returns {Number} 结果，0: 失败，1: 成功，2: 部分失败
 */
function reload() {
    let path = PATH.join(__dirname, '../../config.json');
    if (FS.existsSync(path)) {
        G_CONFIG = require(path);
        G_LIBRARY_PATH = PATH.join(__dirname, '../../' + G_CONFIG.library_path);
    } else return 0;

    path = PATH.join(__dirname, '../../' + G_CONFIG.library_path + '/index.json');
    if (FS.existsSync(path)) {
        G_LIBRARY_CONFIG = require(path);
    } else return 2;

    return 1;
}

function getConfig() {
    return G_CONFIG;
}

function getLibraryConfig() {
    return G_LIBRARY_CONFIG;
}

/** 将内存中的数据保存到本地，不要高频调用！ */
function save() {
    FS.writeFileSync(PATH.join(__dirname, '../../config.json'), JSON.stringify(G_CONFIG, null, 4));
    FS.writeFileSync(PATH.join(__dirname, '../../' + G_CONFIG.library_path + '/index.json'), JSON.stringify(G_LIBRARY_CONFIG, null, 4));
}

function getLibraryPath() {
    return G_LIBRARY_PATH;
}


module.exports = {
    getConfig, getLibraryConfig, getLibraryPath,
    reload, save,
    G_DEBUG
}
