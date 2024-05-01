module.exports = {
    getWbiKeys, encWbi,
    downloadEp, downloadVideo
}


const MD5 = require('md5');
const { getLibraryConfig, getLibraryPath } = require('../config/Global');
const { download } = require('./DownloadUtil');
const PATH = require('path');
const FS = require('fs');
const { updateInfos } = require('../UIManager');
const { timeout } = require('./BaseUtil');


/** 内部 */
const mixinKeyEncTab = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52
]

/** 内部，对 `imgKey` 和 `subKey` 进行字符顺序打乱编码 */
const getMixinKey = orig => mixinKeyEncTab.map(n => orig[n]).join('').slice(0, 32)

/**
 * 为请求参数进行 `wbi` 签名
 * @returns {String} 处理好的 query 字符串
 */
function encWbi(params, img_key, sub_key) {
    const mixin_key = getMixinKey(img_key + sub_key),
        curr_time = Math.round(Date.now() / 1000),
        chr_filter = /[!'()*]/g

    Object.assign(params, { wts: curr_time }) // 添加 wts 字段
    // 按照 key 重排参数
    const query = Object
        .keys(params)
        .sort()
        .map(key => {
            // 过滤 value 中的 "!'()*" 字符
            const value = params[key].toString().replace(chr_filter, '')
            return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
        })
        .join('&')

    const wbi_sign = MD5(query + mixin_key) // 计算 w_rid

    return query + '&w_rid=' + wbi_sign
}

/** 获取 `img_key` 和 `sub_key` */
function getWbiKeys(sessdata, user_agent) {
    if (!sessdata) throw new Error('sessdata 字段不能为空');
    if (!user_agent) throw new Error('user_agent 字段不能为空');

    return fetch('https://api.bilibili.com/x/web-interface/nav', {
        headers: {
            // SESSDATA 字段
            Cookie: 'SESSDATA=' + sessdata,
            'User-Agent': user_agent,
            Referer: 'https://www.bilibili.com/'
        }
    })
        .then(res => res.json())
        .then(res => new Promise((resolve, reject) => {
            const img_url = res.data.wbi_img.img_url;
            const sub_url = res.data.wbi_img.sub_url;

            resolve({
                img_key: img_url.slice(
                    img_url.lastIndexOf('/') + 1,
                    img_url.lastIndexOf('.')
                ),
                sub_key: sub_url.slice(
                    sub_url.lastIndexOf('/') + 1,
                    sub_url.lastIndexOf('.')
                )
            });
        }))
}


/**
 * 下载 1p 视频，会将所有内容下载到给定路径的 `<savePath>/<cid>` 下(<cid>由此方法创建)，会覆盖已存在内容
 * @param {Number} aid aid
 * @param {Number} cid cid
 * @param {String} savePath 保存路径，会自动在里面新教一个 cid 文件夹作为工作目录，建议使用绝对路径
 * @param {Object} ops 配置项，用于指定要下载的内容
 * @returns {Promise} promise
 */
function downloadEp(aid, cid, savePath, ops) {
    if (!aid) throw new Error('aid 不能为空');
    if (!cid) throw new Error('cid 不能为空');
    if (!savePath) throw new Error('savePath 不能为空');
    if (!ops) throw new Error('ops 不能为空');


    return new Promise(async (resolve, reject) => {
        savePath = PATH.join(savePath, String(cid));
        if (!FS.existsSync(savePath)) FS.mkdirSync(savePath);
        const tempPath = PATH.join(getLibraryPath(), 'temp');

        // 如果需要音视频流且音视频流有一个不存在
        if (ops.video || ops.audio && (!FS.existsSync(PATH.join(savePath, 'video')) || !FS.existsSync(PATH.join(savePath, 'audio')))) {
            await new Promise(async (resolve, reject) => {
                const res = await fetch(`https://api.bilibili.com/x/player/wbi/playurl?avid=${aid}&cid=${cid}&fnval=4048`, {
                    headers: {
                        Cookie: 'SESSDATA=' + getLibraryConfig().account.token
                    }
                }).then(res => res.json());

                if (ops.video && !FS.existsSync(PATH.join(savePath, 'video'))) {
                    const video_url = new URL(res.data.dash.video[0].base_url);
                    await download({
                        hostname: video_url.hostname,
                        path: video_url.pathname + video_url.search,
                        port: video_url.port,
                        headers: {
                            Referer: 'https://www.bilibili.com/',
                            'User-Agent': getLibraryConfig().account.user_agent
                        }
                    }, PATH.join(tempPath, String(cid) + '.mp4'), PATH.join(savePath, 'video'));

                    updateInfos('视频下载完成 ' + cid);
                }

                if (ops.audio && !FS.existsSync(PATH.join(savePath, 'audio'))) {
                    const audio_url = new URL(res.data.dash.audio[0].base_url);
                    await download({
                        hostname: audio_url.hostname,
                        path: audio_url.pathname + audio_url.search,
                        port: audio_url.port,
                        headers: {
                            Referer: 'https://www.bilibili.com/',
                            'User-Agent': getLibraryConfig().account.user_agent
                        }
                    }, PATH.join(tempPath, String(cid) + '.mp3'), PATH.join(savePath, 'audio'));

                    updateInfos('音频下载完成 ' + cid);
                }

                resolve();
            });
        }

        if (ops.cover && !FS.existsSync(PATH.join(savePath, 'cover'))) {
            const cover_url = await new Promise(async (resolve, reject) => {
                if (ops.cover_url) resolve(ops.cover_url);
                else {
                    const res = await fetch('https://api.bilibili.com/x/web-interface/view/detail?aid=' + aid).then(res => res.json());
                    resolve(new URL(res.data.View.pages.find(v => v.cid === cid).first_frame));
                }
            });
            await download({
                hostname: cover_url.hostname,
                path: cover_url.pathname + cover_url.search,
                port: cover_url.port
            }, PATH.join(tempPath, String(cid) + '.png'), PATH.join(savePath, 'cover'));

            updateInfos('ep 封面下载完成 ' + cid);
        }

        // TODO subtitle... 2
        // TODO danmu... 1

        resolve();
    });
}

/**
 * 下载一个视频，会自动使用 `downloadEp` 方法下载所有 ep
 * @param {Number} aid aid
 * @param {String} savePath 保存路径，会自动在里面新建一个 aid 文件夹作为工作目录，建议使用绝对路径
 * @param {Object} ops 配置项，用于指定要下载的内容
 * @returns {Promise} promise
 */
function downloadVideo(aid, savePath, ops) {
    if (!aid) throw new Error('aid 不能为空');
    if (!savePath) throw new Error('savePath 不能为空');
    if (!ops) throw new Error('ops 不能为空');


    return new Promise(async (resolve, reject) => {
        savePath = PATH.join(savePath, String(aid));
        if (!FS.existsSync(savePath)) FS.mkdirSync(savePath);

        const res = await fetch(`https://api.bilibili.com/x/web-interface/view/detail?aid=${aid}`).then(res => res.json());

        if (ops.cover && !FS.existsSync(PATH.join(savePath, 'cover'))) {
            const cover_url = new URL(res.data.View.pic);
            await download({
                hostname: cover_url.hostname,
                path: cover_url.pathname + cover_url.search,
                port: cover_url.port,
            }, PATH.join(PATH.join(getLibraryPath(), 'temp'), String(aid) + '.png'), PATH.join(savePath, 'cover'));

            updateInfos('封面下载完成：' + aid);
        }

        // 下载所有 ep
        for (const i of res.data.View.pages) {
            updateInfos(`下载 ep：${i.cid} ${i.part}`);

            await timeout(getLibraryConfig().sync.length * 2000);

            ops.cover_url = new URL(i.first_frame);
            await downloadEp(aid, i.cid, savePath, ops);

            updateInfos(`下载完成：${i.cid} ${i.part}`);
        }

        resolve();
    });
}
