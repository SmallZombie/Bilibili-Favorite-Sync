const FS = require('fs');
const QRCODE = require('qrcode');
const { spawn } = require('child_process');
const PATH = require('path');
const { reload, getLibraryConfig, save, getLibraryPath, logger, pushService } = require('./src/config/Global.js');
const { setAllowInput } = require('./src/CLI.js');
const { timeout } = require('./src/util/BaseUtil.js');
const { fetchEx } = require('./src/util/RequestUtil.js');


console.clear();
console.log(`
  ____  ______ _____
 |  _ \\|  ____/ ____|
 | |_) | |__ | (___  _   _ _ __   ___
 |  _ <|  __| \\___ \\| | | | '_ \\ / __|
 | |_) | |    ____) | |_| | | | | (__
 |____/|_|   |_____/ \\__, |_| |_|\\___|
                      __/ |
                     |___/
`);
logger.info(`TIPS: 你可以在同步之外使用一些命令来控制应用，使用 \`help\` 获取帮助`);


// 1. 准备 config
if (!FS.existsSync('config.json')) {
    FS.writeFileSync(PATH.join(__dirname, 'config.json'), JSON.stringify({
        version: 1,
        library_path: 'library'
    }));
}
reload(); // 加载配置文件


// 2. 初始化库
if (!FS.existsSync(getLibraryPath())) {
    FS.mkdirSync(PATH.join(getLibraryPath(), 'favorites'), { recursive: true });
    FS.mkdirSync(PATH.join(getLibraryPath(), 'videos'));
    FS.mkdirSync(PATH.join(getLibraryPath(), 'recycle'));
    FS.mkdirSync(PATH.join(getLibraryPath(), 'temp'));
    FS.mkdirSync(PATH.join(getLibraryPath(), 'exports'));

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
            "//": "两个名单不可同时启用",
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
            // 'danmu' // TODO
        ],
        "//": "止步于此，下面的内容请不要修改",
        favorites: [],
        last_pos: {
            favorite: null,
            video: null
        }
    }));

    logger.info('初始化库：' + getLibraryPath());
}
reload(); // 重载一次


// 3. 登录并验证
(async () => {
    function _saveQr(url) {
        return new Promise((resolve, reject) => {
            QRCODE.toFile('./qr.png', url, e => {
                if (e) resolve('保存二维码时发生错误：' + e);
                resolve();
            });
        });
    }


    // 没登录，尝试登录
    if (!getLibraryConfig().account.token) {
        logger.info('尝试获取二维码...');
        // 获取、生成、保存二维码
        const qrcode_key = await (async () => {
            const res = await fetchEx('https://passport.bilibili.com/x/passport-login/web/qrcode/generate');
            if (res.code === 0) {
                await _saveQr(res.data.url);
                logger.info(`二维码已保存至 "${PATH.join(__dirname, './qr.png')}"`);
                return res.data.qrcode_key;
            } else throw new Error(`获取二维码时发生错误：${res.code} ${res.message}`);
        })();

        const ls = spawn('explorer.exe', [PATH.join(__dirname, './qr.png')]);

        // 等待扫描然后关闭
        logger.info('等待扫描并登录...');
        let count = 0;
        while (++count < 30) {
            const res = await fetch('https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=' + qrcode_key).then(res => {
                const reg = /^SESSDATA=([^;]+);/.exec(res.headers.get('set-cookie'));
                if (reg) getLibraryConfig().account.token = reg[1];
                return res.json();
            });

            // 0: 登录成功
            // 86101: 未扫描
            // 86090: 扫了但没确认
            // 86038: 失效
            if (res.data.code === 0) {
                getLibraryConfig().account.refresh_token = res.data.refresh_token;
                break;
            } else if (res.data.code === 86038) throw new Error('二维码已失效');

            await timeout(3000);
        }

        ls.kill();
        save();
    }


    logger.info('验证登录...');
    const res = await fetchEx('https://api.bilibili.com/x/web-interface/nav');

    // 0: 正常
    // -101: 没 sessdata or sessdata 无效
    if (res.code === 0) {
        if (!getLibraryConfig().account.uid) {
            getLibraryConfig().account.uid = res.data.mid;
            save();
        }
        logger.info('登录成功');
    } else throw new Error(`登录检查失败：${res.code} ${res.message}`);

    setAllowInput(true);
})();
