exports.execute = execute;


const { reload } = require('../config/global.js');


function execute(...args) {
    return new Promise((resolve, reject) => {
        switch (reload()) {
            case 0: reject('配置文件重载失败');
            case 1: resolve('配置文件重载成功');
            case 2: reject('部分文件重载失败');
        }
    });
}
