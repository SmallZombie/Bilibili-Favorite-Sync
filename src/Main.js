/**
 * 主线程
 */

module.exports = {
    start, stop
}


const { updateInfos } = require('./UIManager.js');
const { getLibraryConfig, getLibraryPath, save, getConfig } = require('./config/Global.js');
const FS = require('fs');
const PATH = require('path');
const { downloadVideo } = require('./util/BiliUtil.js');
const { timeout } = require('./util/BaseUtil.js');


let running = null;
let syncing = false;
let cleaning = false;


/** 内部，同步一次 */
function sync() {
    /** 获取一个收藏夹的全部视频 */
    function getAllVideo(id) {
        /** 获取该收藏夹的某一页视频添加到数组中，数量固定为 20 */
        function _getPage(page) {
            return fetch(`https://api.bilibili.com/x/v3/fav/resource/list?media_id=${id}&pn=${page}&ps=20`, {
                headers: {
                    Cookie: 'SESSDATA=' + getLibraryConfig().account.token
                }
            }).then(res => res.json());
        }


        // 获取所有页
        return new Promise(async (resolve, reject) => {
            let videos = [];
            let page = 1;

            while (true) {
                const res = await _getPage(page++);
                videos = videos.concat(res.data.medias);

                if (!res.data.has_more) {
                    resolve(videos);
                    break;
                }
                await timeout(1000);
            }
        });
    }


    return new Promise(async (resolve, reject) => {
        if (syncing) {
            reject('已有同步正在进行');
            return;
        } else syncing = true;

        if (cleaning) {
            reject('已有清理正在进行');
            return;
        }

        // 检查收藏夹变化
        const res = await fetch('https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=' + getLibraryConfig().account.uid, {
            headers: {
                Cookie: 'SESSDATA=' + getLibraryConfig().account.token
            }
        }).then(res => res.json());

        let needSave = false;
        for (const i of res.data.list) {
            if (!getLibraryConfig().favorites.some(v => v.id === i.id)) {
                needSave = true;
                updateInfos('发现新的收藏夹：' + i.title);
            }
        }

        if (needSave) {
            getLibraryConfig().favorites = res.data.list;
            save();
        }

        resolve();
    })
    // 检查所有收藏夹
    .then(() => new Promise(async (resolve, reject) => {
        for (const i of getLibraryConfig().favorites) {
            // 获取全部视频然后与上一次同步比较出是否有失效视频或新内容需要下载
            const videos = await new Promise(async (resolve, reject) => {
                const res = await getAllVideo(i.id);

                // 最后一次同步信息
                const lastSync = await new Promise((resolve, reject) => {
                    const path = PATH.join(getLibraryPath(), 'temp', 'last_sync.json');
                    if (FS.existsSync(path)) resolve(require(path));
                    else resolve({
                        invalid: [] // cids
                    });
                });

                // 与上一次同步做对比
                for (const ii of res) {
                    if (ii.cover === 'http://i0.hdslb.com/bfs/archive/be27fd62c99036dce67efface486fb0a88ffed06.jpg' && !lastSync.invalid.includes(ii.cid)) {
                        // 这里把所有失效的视频都存起来，防止下次同步重复汇报
                        lastSync.invalid.push(ii.cid);
                        console.log('已失效视频：' + ii.id);
                    }
                }

                // 保存
                FS.writeFileSync(PATH.join(getLibraryPath(), 'temp', 'last_sync.json'), JSON.stringify(lastSync));

                resolve(res);
            });

            // 保存清单
            FS.writeFileSync(PATH.join(getLibraryPath(), 'favorites', i.id + '.json'), JSON.stringify((() => {
                const ret = [];
                for (const ii of videos) ret.push(ii.id);
                return ret;
            })()));

            for (const ii of videos) {
                updateInfos('[+] 开始任务：' + ii.title);
                await downloadVideo(
                    ii.id,
                    PATH.join(getLibraryPath(), 'videos'),
                    getLibraryConfig().sync.reduce((v, k) => ({ ...v, [k]: true }), {})
                );
                updateInfos('[√] 完成：' + ii.title);
            }
        }


        syncing = false;
        resolve();
    }))
    .then(() => clean());
}

/** 启动主线程 */
function start() {
    if (running) return;
    else running = true;

    updateInfos('[!] 开始同步线程');

    function syncOnce() {
        updateInfos('[!] 同步...');
        sync().then(() => {
            updateInfos('空闲');
        }).catch(e => updateInfos('同步时发生错误：' + e));
    }

    running = setInterval(syncOnce, 20 * 60 * 1000);
    syncOnce();
}

/** 结束主线程 */
function stop() {
    if (!running) return;
    clearInterval(running);
    updateInfos('[!] 停止同步线程');
}

/**
 * 运行清理，用于将 videos 里的某些内容移动至回收站，以下情况的文件会被视为"需要清理"：
 * - 没有收藏夹收藏这个视频
 * - 配置文件中不再声明需要这个文件
 * 同步中不能使用该方法，该方法会在同步后自动调用
 */
function clean() {
    new Promise((resolve, reject) => {
        if (cleaning) {
            reject('无法清理：已有清理任务正在运行');
            return;
        }
        if (syncing) {
            reject('无法清理：正在进行同步');
            return;
        }
        cleaning = true;

        updateInfos('开始清理...');

        // 获取全部收藏夹的全部引用
        let quotes = [];
        const favBasePath = PATH.join(getLibraryPath(), 'favorites');
        for (const i of FS.readdirSync(favBasePath)) {
            const file = require(PATH.join(favBasePath, i));
            quotes = quotes.concat(file);
        }

        // 获取全部本地视频
        const vidBasePath = PATH.join(getLibraryPath(), 'videos');
        for (const i of FS.readdirSync(vidBasePath)) {
            if (!quotes.includes(Number(i))) FS.rmdirSync(PATH.join(vidBasePath, i));
        }

        updateInfos('清理完成');
        cleaning = false;
        resolve();
    });
}
