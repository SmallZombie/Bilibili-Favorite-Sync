const FS = require('fs');
const QRCODE = require('qrcode');
const { spawn } = require('child_process');
const PATH = require('path');


const { reload, getLibraryConfig, save, getLibraryPath } = require('./src/config/Global.js');
const { start } = require('./src/Main.js');
const { updateInfos, updateCommandInfos, setAllowInput } = require('./src/UIManager.js');
const path = require('path');


updateInfos(`
  ____  ______ _____
 |  _ \\|  ____/ ____|
 | |_) | |__ | (___  _   _ _ __   ___
 |  _ <|  __| \\___ \\| | | | '_ \\ / __|
 | |_) | |    ____) | |_| | | | | (__
 |____/|_|   |_____/ \\__, |_| |_|\\___|
                      __/ |
                     |___/
`);
updateCommandInfos(`使用 \`help\` 来获取帮助`);
setAllowInput(false);


// 1. 准备 config
if (!FS.existsSync('config.json')) {
    FS.writeFileSync(PATH.join(__dirname, 'config.json', JSON.stringify({
        "//": '配置文件版本，不要改动',
        version: 1,
        library_path: '../library',
        filter: {
            '//': '两个名单都必须填入收藏夹 id:Number',
            blacklist: {
                enable: false,
                list: []
            },
            whitelist: {
                enable: false,
                list: []
            }
        },
        '//': '要同步的的内容，下面已经列出了所有候选值',
        sync: [
            'video',
            'audio',
            'subtitle',
            'danmu',
            'cover'
        ]
    })));
}
reload(); // 加载配置文件


// 2. 初始化库
if (!FS.existsSync(getLibraryPath())) {
    FS.mkdirSync(PATH.join(getLibraryPath(), 'favorites'), { recursive: true });
    FS.mkdirSync(PATH.join(getLibraryPath(), 'videos'));
    FS.mkdirSync(PATH.join(getLibraryPath(), 'recycle'));
    FS.mkdirSync(PATH.join(getLibraryPath(), 'temp'));

    // 创建默认清单文件
    FS.writeFileSync(getLibraryPath() + '/index.json', JSON.stringify({
        version: 1,
        account: {
            uid: null,
            token: null,
            refresh_token: null,
            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0'
        },
        filter: {
            '//': '两个名单都必须填入收藏夹 id:Number',
            blacklist: {
                enable: false,
                list: []
            },
            whitelist: {
                enable: false,
                list: []
            }
        },
        '//': '要同步的的内容，下面已经列出了所有候选值',
        sync: [
            'cover',
            'video',
            'audio',
            'subtitle',
            'danmu'
        ],
        favorites: []
    }));

    updateInfos('初始化库：' + getLibraryPath());
}
reload(); // 重载一次


// 3. 登录并验证
(() => {
    new Promise((resolve, reject) => {
        if (getLibraryConfig().account.token) {
            resolve();
            return;
        }

        // 扫码登录
        updateInfos('尝试获取二维码...');
        fetch('https://passport.bilibili.com/x/passport-login/web/qrcode/generate')
            .then(res => res.json())
            // 生成、保存二维码
            .then(res => new Promise((resolve, reject) => {
                if (res.code === 0) {
                    QRCODE.toFile('./qr.png', res.data.url, e => {
                        if (e) reject('保存二维码时发生错误：' + e);
                        updateInfos(`二维码已保存至 "${path.join(__dirname, './qr.png')}"`);
                        resolve(res.data.qrcode_key);
                    });
                } else reject(`获取二维码时发生错误：${res.code} ${res.message}`);
            }))
            // 打开、等待扫描然后关闭
            .then(qrcode_key => new Promise((resolve, reject) => {
                const ls = spawn('explorer.exe', [path.join(__dirname, './qr.png')]);

                // 等待扫描
                updateInfos('等待扫描并登录...');
                let timer = setInterval(() => {
                    fetch('https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=' + qrcode_key)
                        .then(res => {
                            const reg = /^SESSDATA=([^;]+);/.exec(res.headers.get('set-cookie'));
                            if (reg) {
                                getLibraryConfig().account.token = reg[1];
                            }
                            return res.json();
                        })
                        .then(res => {
                            // 0: 登录成功
                            // 86101: 未扫描
                            // 86090: 扫了但没确认
                            // 86038: 失效
                            if (res.data.code === 0) {
                                ls.kill();
                                clearInterval(timer);

                                getLibraryConfig().account.refresh_token = res.data.refresh_token;
                                resolve();
                            } else if (res.data.code === 86038) {
                                ls.kill();
                                clearInterval(timer);

                                reject('二维码已失效');
                            }
                        })
                        .catch(e => reject('检查扫描状态时发生错误：' + e));
                }, 3000);

            }))
            .then(() => {
                save();
                resolve();
            })
            .catch(e => reject('尝试登录时发生错误：' + e));
    })
        .then(() => {
            updateInfos('验证登录...');

            return fetch('https://api.bilibili.com/x/web-interface/nav', {
                headers: {
                    Cookie: 'SESSDATA=' + getLibraryConfig().account.token
                }
            });
        })
        .then(res => res.json())
        .then(res => new Promise((resolve, reject) => {
            // 0: 正常
            // -101: 没 sessdata or sessdata 无效
            if (res.code === 0) {
                if (!getLibraryConfig().account.uid) {
                    getLibraryConfig().account.uid = res.data.mid;
                    save();
                } else resolve();
            } else reject(`登录检查失败：${res.code} ${res.message}`);
        }))
        .then(() => {
            updateInfos('登录成功');

            // 4. 启动主线程
            start();
            setAllowInput(true);
        }).catch(e => {
            updateInfos('登录验证时发生错误：' + e);
            process.exit(-1);
        });
})();
