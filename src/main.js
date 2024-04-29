/**
 * 主线程
 */

module.exports = {
    start, stop
}


const { updateInfos } = require('./UIManager.js');
const { getLibraryConfig, getLibraryPath, save, getConfig } = require('./config/global.js');
const FS = require('fs');
const PATH = require('path');
const { downloadVideo } = require('./util/BiliUtil.js');
const { download } = require('./util/DownloadUtil.js');


let running = null;
let syncing = false;


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
                await new Promise((resolve, reject) => {
                    setTimeout(() => resolve(_getPage(page++)), 1000);
                }).then(res => {
                    videos = videos.concat(res.data.medias);
                    if (!res.data.has_more) resolve(videos);
                });
            }
        });
    }


    return new Promise(async (resolve, reject) => {
        if (syncing) {
            reject('已有同步正在进行');
            return;
        } else syncing = true;


        // 检查收藏夹变化
        const res = await fetch('https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=' + getLibraryConfig().account.uid, {
            headers: {
                Cookie: 'SESSDATA=' + getLibraryConfig().account.token
            }
        }).then(res => res.json());

        const news = []; // 新增的
        const localFavs = getLibraryConfig().favorites.slice(); // 下面 for 之后剩下的就是删除的

        // 云端有本地没有，是新增
        // 云端没有本地有，是删除
        for (const i of res.data.list) {
            if (localFavs.some(v => v.id === i.id)) {
                localFavs.splice(localFavs.findIndex(v => v.id === i.id), 1);
            } else news.push(i);
        }

        // console.log(`共 ${res.data.count}, 新增 ${news.length}, 移除 ${localFavs.length}`);

        // 处理新增
        for (const i of news) {
            FS.mkdirSync(getLibraryPath() + '/favorites/' + i.id);
            getLibraryConfig().favorites.push(i);
            updateInfos('发现新的收藏夹：' + i.title);
        }

        // 处理删除
        for (const i of localFavs) {
            FS.renameSync(getLibraryPath() + '/favorites/' + i.id, getLibraryPath() + '/recycle/' + i.id);
            getLibraryConfig().favorites.splice(getLibraryConfig().favorites.findIndex(v => v.id === i.id), 1);
            updateInfos('移动至回收站：' + i.title);
        }

        if (news.length > 0 || localFavs.length > 0) save();

        syncing = false;
        resolve();
    })
    .then(async () => {
        // 检查所有收藏夹
        for (const i of getLibraryConfig().favorites) {
            if (i.id !== 3154942526) continue; // DEBUG filter

            // 获取全部视频
            const videos = await new Promise((resolve, reject) => {
                setTimeout(() => {
                    getAllVideo(i.id).then(res => {
                        // console.log(i.id, i.title, res.length);
                        resolve(res);
                    }).catch(e => reject(e));
                }, 1000);
            });

            // 获取本地所有视频(aids)
            const locVids = [];
            const favPath = PATH.join(getLibraryPath(), 'favorites', String(i.id));
            for (const ii of FS.readdirSync(favPath)) locVids.push(ii);

            // console.log('lvs', localVideos);


            // 对比差异
            for (const ii of videos) {
                // 视频失效，本地存在 -> 汇报视频失效
                // 视频失效，本地不存在 -> 报错无法下载
                // 视频有效，本地存在 -> 什么都不做
                // 视频有效，本地不存在 -> 创建新下载任务

                const vidPath = PATH.join(favPath, String(ii.id));
                if (!FS.existsSync(vidPath)) FS.mkdirSync(vidPath);

                const res = await fetch(`https://api.bilibili.com/x/web-interface/view/detail?aid=${ii.id}`).then(res => res.json());
                /** 本地已存在的 ep(s) */
                const locEps = FS.readdirSync(vidPath);

                // 同步所有 ep
                for (const iii of res.data.View.pages) {
                    if (ii.cover === 'http://i0.hdslb.com/bfs/archive/be27fd62c99036dce67efface486fb0a88ffed06.jpg') {
                        if (locVids.some(v => v === ii.id + '.json')) {
                            updateInfos(`已失效 ${ii.id} ${ii.title}`)
                        } else {
                            updateInfos(`无法创建任务：视频已失效 ${ii.id} ${ii.title}`);
                        }
                    } else {
                        // 遍历所有需要的内容，检查缺失的内容
                        const ops = {}
                        for (const iiii of getConfig().sync) {
                            if (!FS.existsSync(PATH.join(favPath, String(ii.id), String(iii.cid), iiii))) {
                                ops[iiii] = true;
                            }
                        }

                        if (Object.keys(ops).length === 0) {
                            updateInfos(`已为最新 ${ii.id} ${iii.cid} ${iii.part}`);
                        } else {
                            updateInfos(`[+] 创建任务 ${ii.id} ${iii.cid} ${iii.part}`);
                            await downloadVideo(
                                ii.id,
                                iii.cid,
                                PATH.join(getLibraryPath(), 'favorites', String(i.id), String(ii.id)),
                                ops
                            );
                            updateInfos(`[√] 任务完成 ${ii.id} ${iii.cid} ${iii.part}`);
                        }


                        // TODO 这里有一个设计问题，视频的封面需要单独处理，这肯定是不行的，起床再说吧
                        // if (ops.cover && !FS.existsSync(PATH.join(favPath, String(ii.id), 'cover'))) {
                        //     const cover_url = new URL(iii.pic);
                        //     await download({
                        //         hostname: cover_url.hostname,
                        //         path: cover_url.pathname + cover_url.search,
                        //         port: cover_url.port
                        //     }, PATH.join(getTempPath(), ii.id + '.png'), PATH.join(vidPath, 'cover'));

                        //     updateInfos('封面下载完成 ' + ii.id);
                        // }
                    }
                }
            }

            // 删除，云端没有本地有 -> 删除本地内容
            for (const ii of locVids) {
                updateInfos('删除 ' + ii);
            }
        }
    })
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

    running = setInterval(syncOnce, 5 * 60 * 1000);
    syncOnce();
}

/** 结束主线程 */
function stop() {
    if (!running) return;
    clearInterval(running);
    updateInfos('[!] 停止同步线程');
}
